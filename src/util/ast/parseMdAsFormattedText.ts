/* eslint-disable no-useless-escape */
import type { ApiFormattedText } from '../../api/types';
import type { ASTNode, DocumentNode } from './node';

import { NodeType } from './astEnums';
import { Lexer } from './lexer';
import { normalizeTokens } from './normalizer';
import { Parser } from './parser';
import { Renderer } from './renderer';
import { EntityRenderer } from './rendererAstAsEntities';

export function cleanHtml(html: string) {
  let cleanedHtml = html.slice(0);

  // Strip redundant nbsp's
  cleanedHtml = cleanedHtml.replace(/&nbsp;/g, ' ');

  // Replace <div><br></div> with newline (new line in Safari)
  cleanedHtml = cleanedHtml.replace(/<div><br([^>]*)?><\/div>/g, '\n');
  // Replace <br> with newline
  cleanedHtml = cleanedHtml.replace(/<br([^>]*)?>/g, '\n');

  // Strip redundant <div> tags
  cleanedHtml = cleanedHtml.replace(/<\/div>(\s*)<div>/g, '\n');
  // cleanedHtml = cleanedHtml.replace(/<div>/g, '\n');
  // cleanedHtml = cleanedHtml.replace(/<\/div>/g, '');

  cleanedHtml = cleanedHtml.replace(/&gt;/g, '>');
  cleanedHtml = cleanedHtml.replace(/&lt;/g, '<');
  cleanedHtml = cleanedHtml.replace(/&amp;/g, '&');

  return cleanedHtml;
}

export function parseMarkdownToAST(inputText: string): DocumentNode | undefined {
  const cleanedHtml = cleanHtml(inputText);
  const lexer = new Lexer(cleanedHtml);
  const tokens = lexer.tokenize();

  const normalizedTokens = normalizeTokens(tokens);

  const parser = new Parser(normalizedTokens);
  let document: DocumentNode | undefined;
  try {
    document = parser.parseDocument();
    if (document) {
      document = cleanupAST(document) as DocumentNode;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
  }
  return document;
}

export function renderASTToHTML(ast: DocumentNode): string {
  const renderer = new Renderer();
  return renderer.render(ast);
}

export function markdownToHTML(inputText: string): string {
  const ast = parseMarkdownToAST(inputText);
  if (!ast) {
    return inputText;
  }
  return renderASTToHTML(ast);
}

export function renderASTToEntities(ast: DocumentNode): ApiFormattedText {
  const renderer = new EntityRenderer();
  return renderer.render(ast);
}

export function parseMarkdownHtmlToEntities(inputText: string): ApiFormattedText {
  const ast = parseMarkdownToAST(inputText);
  if (!ast) {
    return { text: inputText, entities: [] };
  }
  return renderASTToEntities(ast);
}

// AST cleanup: flatten nested formatting, merge duplicates, and reorder formatting chains
type FormattingNode = ASTNode & { children: ASTNode[] };
function isFormattingNode(type: string): boolean {
  return [NodeType.BOLD, NodeType.ITALIC, NodeType.UNDERLINE, NodeType.STRIKE].includes(type as any);
}
// Formatting priority (lower = inner)
const FORMAT_PRIORITY: Record<string, number> = {
  [NodeType.STRIKE]: 0,
  [NodeType.UNDERLINE]: 1,
  [NodeType.ITALIC]: 2,
  [NodeType.BOLD]: 3,
  [NodeType.SPOILER]: 4,
};

function cleanupAST(node: ASTNode): ASTNode {
  if (!node.children) return node;
  // 1) Recursively clean
  let children = node.children.map(cleanupAST);
  // 2) Flatten parent-child same-type
  function flattenSameType(nodes: ASTNode[]): ASTNode[] {
    return nodes.flatMap((n) => {
      if (isFormattingNode(n.type) && n.children?.length === 1 && n.children[0].type === n.type) {
        return flattenSameType((n.children[0] as FormattingNode).children);
      }
      return [{ ...n, children: n.children ? flattenSameType(n.children) : undefined }];
    });
  }
  children = flattenSameType(children);
  // 3) Merge adjacent same-type siblings
  const merged: ASTNode[] = [];
  for (const c of children) {
    const last = merged[merged.length - 1];
    if (last && last.type === c.type && isFormattingNode(c.type)) {
      (last as FormattingNode).children.push(...(c as FormattingNode).children);
    } else {
      merged.push(c);
    }
  }
  // 4) Bubble-up & reorder nested chains
  if (isFormattingNode(node.type) && merged.length === 1 && isFormattingNode(merged[0].type)) {
    const chain: string[] = [];
    let curr: FormattingNode = { type: node.type, children: merged };
    while (isFormattingNode(curr.type) && curr.children.length === 1 && isFormattingNode(curr.children[0].type)) {
      chain.push(curr.type);
      curr = curr.children[0] as FormattingNode;
    }
    chain.push(curr.type);
    // dedupe & sort by priority inner->outer
    const unique = Array.from(new Set(chain)).sort((a, b) => FORMAT_PRIORITY[a] - FORMAT_PRIORITY[b]);
    // rebuild
    let content = curr.children || [];
    for (const t of unique) {
      content = [{ type: t, children: content } as FormattingNode];
    }
    return content[0];
  }
  node.children = merged;
  return node;
}
