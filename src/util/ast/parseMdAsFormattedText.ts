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
      document = removeInheritedFormatting(document) as DocumentNode;
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
  return [NodeType.BOLD, NodeType.ITALIC, NodeType.UNDERLINE, NodeType.STRIKE, NodeType.SPOILER].includes(type as any);
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
  // 1) Recursively clean children
  let children = node.children.map(cleanupAST);
  // 2) Flatten nested same‑type formatting
  function flattenSameType(nodes: ASTNode[]): ASTNode[] {
    return nodes.flatMap((n) => {
      if (n.children) {
        n = { ...n, children: flattenSameType(n.children) };
      }
      if (isFormattingNode(n.type) && n.children) {
        const newChildren: ASTNode[] = [];
        for (const c of n.children) {
          if (c.type === n.type && c.children) {
            newChildren.push(...c.children);
          } else {
            newChildren.push(c);
          }
        }
        return [{ ...n, children: newChildren }];
      }
      return [n];
    });
  }
  children = flattenSameType(children);
  // 3) Remove empty formatting nodes
  children = children.filter((c) => !(isFormattingNode(c.type) && (!c.children || c.children.length === 0)));
  // 4) Merge adjacent same‑type siblings
  const merged: ASTNode[] = [];
  for (const c of children) {
    const last = merged[merged.length - 1];
    if (last && last.type === c.type && isFormattingNode(c.type) && (c as FormattingNode).children) {
      (last as FormattingNode).children.push(...(c as FormattingNode).children);
    } else {
      merged.push(c);
    }
  }
  // 5) Bubble‑up & reorder nested chains
  if (isFormattingNode(node.type) && merged.length === 1 && isFormattingNode(merged[0].type)) {
    const chain: string[] = [];
    let curr: FormattingNode = { type: node.type, children: merged };
    chain.push(curr.type);
    while (isFormattingNode(curr.children[0].type) && curr.children.length === 1) {
      curr = curr.children[0] as FormattingNode;
      chain.push(curr.type);
    }
    const unique = Array.from(new Set(chain)).sort((a, b) => FORMAT_PRIORITY[a] - FORMAT_PRIORITY[b]);
    const content = curr.children || [];
    let rebuilt: ASTNode[] = content;
    for (const t of unique) {
      rebuilt = [{ type: t, children: rebuilt } as FormattingNode];
    }
    return rebuilt[0];
  }
  node.children = merged;
  return node;
}

// Remove inherited nested formatting wrappers
function removeInheritedFormatting(node: ASTNode, ancestors: Set<string> = new Set()): ASTNode | ASTNode[] {
  if (!node.children) return node;
  let newAncestors = ancestors;
  if (isFormattingNode(node.type)) {
    if (ancestors.has(node.type)) {
      // drop redundant wrapper, keep children
      return node.children.flatMap((c) => removeInheritedFormatting(c, ancestors) as ASTNode);
    }
    newAncestors = new Set(ancestors);
    newAncestors.add(node.type);
  }
  const newChildren: ASTNode[] = [];
  for (const child of node.children) {
    const processed = removeInheritedFormatting(child, newAncestors);
    if (Array.isArray(processed)) newChildren.push(...processed);
    else newChildren.push(processed);
  }
  node.children = newChildren;
  return node;
}
