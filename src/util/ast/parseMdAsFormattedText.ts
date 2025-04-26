/* eslint-disable no-useless-escape */
import type { ApiFormattedText } from '../../api/types';
import type {
  ASTNode, DocumentNode, HtmlTagNode, TextNode,
} from './node';
import type { SelectionOffsets } from './plainTextOffset';

import { NodeType } from './astEnums';
import { Lexer } from './lexer';
import { normalizeTokens } from './normalizer';
import { Parser } from './parser';
import { Renderer } from './renderer';
import { EntityRenderer } from './rendererAstAsEntities';

// const MARKER_KEYS_SET = new Set(['*', '_', '~', '`', '|', '+', '>', '\n', '[', ']', '(', ')']);
// const MARKER_CHARS_SET = new Set(['*', '_', '~', '`', '|', '+', '>']);
const MARKER_CHARS_SET = new Set(['*', '_', '~', '`', '|', '+']); // No blockquotes accounted here...

const getNewCaretOffset = (cleanedHtml: string, plainFormattedText: string, caretOffset: number) => {
  // 1. Keep two pointers, advance both of them if chars match.
  // 2. Advance only the cleanedHtml if chars don't match.
  // 3. If they do not match - check if cleanedHtml char is "<" key - at this point, it does not appear in plain text (would be 1 - match)
  //    If so, advance cleanedHtml until it is ">". So, effectively this means - skip all html tags that do not appear in plain text.
  // 4. Remove 1 from the result if the char is an edit key.
  let resultOffset = caretOffset;
  let i = 0;
  let j = 0;
  while (i < resultOffset && j < cleanedHtml.length) {
    if (plainFormattedText[i] === cleanedHtml[j]) {
      i++;
      j++;
    } else {
      if (cleanedHtml[j] === '<') {
        while (cleanedHtml[j] !== '>' && j < cleanedHtml.length) {
          j++;
        }
      }
      if (MARKER_CHARS_SET.has(cleanedHtml[j])) {
        resultOffset--;
      }
      j++;
    }
  }
  return resultOffset;
};

const getNewSelectionOffsets = (
  cleanedHtml: string,
  plainFormattedText: string,
  selectionOffsets: SelectionOffsets,
) => {
  // 1. Keep two pointers, advance both of them if chars match.
  // 2. Advance only the cleanedHtml if chars don't match.
  // 3. If they do not match - check if cleanedHtml char is "<" key - at this point, it does not appear in plain text (would be 1 - match)
  //    If so, advance cleanedHtml until it is ">". So, effectively this means - skip all html tags that do not appear in plain text.
  // 4. Remove 1 from the result if the char is an edit key.
  // 5. Keep track of startFinished flag.
  const resultOffsets = { ...selectionOffsets };
  let i = 0;
  let j = 0;
  let startFinished = false;
  while (i < resultOffsets.end && j < cleanedHtml.length) {
    if (i >= resultOffsets.start) {
      startFinished = true;
    }
    if (plainFormattedText[i] === cleanedHtml[j]) {
      i++;
      j++;
    } else {
      if (cleanedHtml[j] === '<') {
        while (cleanedHtml[j] !== '>' && j < cleanedHtml.length) {
          j++;
        }
      }
      if (MARKER_CHARS_SET.has(cleanedHtml[j])) {
        if (startFinished) {
          resultOffsets.end--;
        }
        resultOffsets.start--;
        resultOffsets.end--;
      }
      j++;
    }
  }
  return resultOffsets;
};

export function cleanHtml(html: string) {
  let cleanedHtml = html.slice(0);

  // Replace marker spans with their raw text content before lexing
  cleanedHtml = cleanedHtml.replace(/<span[^>]*class="[^\"]*\bmd-marker\b[^\"]*"[^>]*>([\s\S]*?)<\/span>/g,
    (_match, markerText) => {
      // Replace the span entirely with its text content (the raw marker)
      // Decode potential HTML entities in markerText just in case
      const decodedMarkerText = markerText.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
      return decodedMarkerText;
    });

  // Strip redundant nbsp's
  cleanedHtml = cleanedHtml.replace(/&nbsp;/g, ' ');

  // Replace <div><br></div> with newline (new line in Safari)
  // cleanedHtml = cleanedHtml.replace(/<div><br([^>]*)?><\/div>/g, '\n');
  // Replace <br> with newline
  cleanedHtml = cleanedHtml.replace(/<br([^>]*)?>/g, '\n');

  // // Strip redundant <div> tags
  // cleanedHtml = cleanedHtml.replace(/<\/div>(\s*)<div>/g, '\n');
  // cleanedHtml = cleanedHtml.replace(/<div>/g, '\n');
  // cleanedHtml = cleanedHtml.replace(/<\/div>/g, '');

  cleanedHtml = cleanedHtml.replace(/&gt;/g, '>');
  cleanedHtml = cleanedHtml.replace(/&lt;/g, '<');
  cleanedHtml = cleanedHtml.replace(/&amp;/g, '&');

  return cleanedHtml;
}

export function parseMarkdownToAST(inputText: string, isCleaned = false): DocumentNode | undefined {
  let cleanedHtml = inputText;
  if (!isCleaned) {
    cleanedHtml = cleanHtml(inputText);
  }
  const lexer = new Lexer(cleanedHtml);
  const tokens = lexer.tokenize();

  const normalizedTokens = normalizeTokens(tokens);

  const parser = new Parser(normalizedTokens);
  let document: DocumentNode | undefined;
  try {
    document = parser.parseDocument();
    if (document) {
      document = cleanupAST(document) as DocumentNode;
      document = unwrapDivNodes(document) as DocumentNode;
      document = mergeAdjacentQuoteNodesWithNewline(document) as DocumentNode;
      document = removeInheritedFormatting(document) as DocumentNode;
      // document = unwrapDivNodes(document) as DocumentNode;
      // Merge adjacent same-style formatting nodes (e.g. split by divs)
      document = mergeAdjacentSameStyleNodes(document) as DocumentNode;
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

export function parseMarkdownHtmlToEntitiesWithCaret(
  inputText: string,
  caretOffset: number,
  validOffsetMargin: number = 0,
): {
    formattedText: ApiFormattedText;
    focusedEntityIndexes: number[];
    plainTextCaretOffset: number;
  } {
  const cleanedHtml = cleanHtml(inputText);
  const ast = parseMarkdownToAST(cleanedHtml, true);
  if (!ast) {
    return {
      formattedText: { text: inputText, entities: [] },
      focusedEntityIndexes: [],
      plainTextCaretOffset: 0,
    };
  }
  const formattedText = renderASTToEntities(ast);
  const entitiesList = formattedText.entities ?? [];

  // Caret offset that must be handled here - must be adjusted by the difference between pattern
  // occurencies in input and output text.
  const newPlainTextCaretOffset = getNewCaretOffset(
    cleanedHtml,
    formattedText.text,
    caretOffset,
  );

  const focusedEntityIndexes = entitiesList.reduce<number[]>((acc, e, idx) => {
    if (
      newPlainTextCaretOffset + validOffsetMargin >= e.offset
      && newPlainTextCaretOffset - validOffsetMargin <= e.offset + e.length
    ) {
      acc.push(idx);
    }
    return acc;
  }, []);

  return {
    formattedText,
    focusedEntityIndexes,
    plainTextCaretOffset: newPlainTextCaretOffset,
  };
}

export function parseMarkdownHtmlToEntitiesWithSelection(
  inputText: string,
  selectionOffsets: SelectionOffsets,
  validOffsetMargin: number = 0,
): {
    formattedText: ApiFormattedText;
    focusedEntityIndexes: number[];
    plainTextSelectionOffsets: SelectionOffsets;
  } {
  const cleanedHtml = cleanHtml(inputText);
  const ast = parseMarkdownToAST(cleanedHtml, true);
  if (!ast) {
    return {
      formattedText: { text: inputText, entities: [] },
      focusedEntityIndexes: [],
      plainTextSelectionOffsets: { start: 0, end: 0 },
    };
  }
  const formattedText = renderASTToEntities(ast);
  const entitiesList = formattedText.entities ?? [];

  // Caret offset that must be handled here - must be adjusted by the difference between pattern
  // occurencies in input and output text.
  const newPlainTextSelectionOffsets = getNewSelectionOffsets(
    cleanedHtml,
    formattedText.text,
    selectionOffsets,
  );

  const focusedEntityIndexes = entitiesList.reduce<number[]>((acc, e, idx) => {
    if (
      // Check if entity overlaps with selection range
      newPlainTextSelectionOffsets.start - validOffsetMargin <= e.offset + e.length
      && newPlainTextSelectionOffsets.end + validOffsetMargin >= e.offset
    ) {
      acc.push(idx);
    }
    return acc;
  }, []);

  return {
    formattedText,
    focusedEntityIndexes,
    plainTextSelectionOffsets: newPlainTextSelectionOffsets,
  };
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
      rebuilt = [{ type: t, children: rebuilt } as ASTNode];
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

function mergeAdjacentQuoteNodesWithNewline(ast: DocumentNode): DocumentNode {
  if (!ast.children) return ast;
  const newChildren: ASTNode[] = [];
  let i = 0;
  while (i < ast.children.length) {
    const node = ast.children[i];
    if (node.type === NodeType.QUOTE) {
      // accumulate a run of adjacent quotes separated by newlines
      const accumulated: ASTNode[] = [...(node.children || [])];
      let j = i + 1;
      while (j < ast.children.length) {
        // newline-separated quote
        if (
          ast.children[j].type === NodeType.TEXT
          && (ast.children[j] as TextNode).value === '\n'
          && j + 1 < ast.children.length
          && ast.children[j + 1].type === NodeType.QUOTE
        ) {
          const nextQuote = ast.children[j + 1] as ASTNode;
          accumulated.push(ast.children[j]);
          accumulated.push(...(nextQuote.children || []));
          j += 2;
          continue;
        }
        // directly adjacent quote, insert a newline
        if (ast.children[j].type === NodeType.QUOTE) {
          const nextQuote = ast.children[j] as ASTNode;
          accumulated.push({ type: NodeType.TEXT, value: '\n' } as TextNode);
          accumulated.push(...(nextQuote.children || []));
          j++;
          continue;
        }
        break;
      }
      newChildren.push({ ...node, children: accumulated });
      i = j;
    } else {
      newChildren.push(node);
      i++;
    }
  }
  return { ...ast, children: newChildren };
}

// Unwrap <div> AST nodes: emit newline before content for normal divs, but preserve custom emoji divs
function unwrapDivNodes(ast: DocumentNode): DocumentNode {
  const process = (nodes: ASTNode[]): ASTNode[] => {
    const result: ASTNode[] = [];
    for (const node of nodes) {
      if (
        node.type === NodeType.HTML_TAG
        && (node as HtmlTagNode).tagName.toLowerCase() === 'div'
      ) {
        const htmlTag = node as HtmlTagNode;
        const attrs = Array.isArray(htmlTag.attributes)
          ? (htmlTag.attributes as { key: string; value: string }[])
          : [];
        const entityType = attrs.find((a) => a.key === 'data-entity-type')?.value;
        if (entityType === 'MessageEntityCustomEmoji') {
          // Preserve custom emoji div
          const clone: ASTNode = {
            ...node,
            children: htmlTag.children ? process(htmlTag.children) : [],
          };
          result.push(clone);
        } else {
          // Unwrap normal div: emit newline and recurse
          result.push({ type: NodeType.TEXT, value: '\n' } as TextNode);
          result.push(...process(htmlTag.children || []));
        }
      } else if (node.children) {
        // Recurse into other nodes, preserving wrappers
        const clone: ASTNode = { ...node, children: process(node.children) };
        result.push(clone);
      } else {
        // Leaf node
        result.push(node);
      }
    }
    return result;
  };
  return { ...ast, children: process(ast.children) };
}

// // Helper: compare two chains
// function arraysEqual(a: string[], b: string[]): boolean {
//   if (a.length !== b.length) return false;
//   for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
//   return true;
// }

// // Extract nested formatting chain from a node
// function getStyleChain(node: ASTNode): string[] {
//   const chain: string[] = [];
//   let curr: ASTNode | undefined = node;
//   while (isFormattingNode(curr.type) && curr.children && curr.children.length === 1) {
//     chain.push(curr.type);
//     curr = curr.children[0];
//   }
//   return chain;
// }

// // Extract leaf children under formatting wrappers
// function getLeafChildren(node: ASTNode): ASTNode[] {
//   let curr: ASTNode = node;
//   while (isFormattingNode(curr.type) && curr.children && curr.children.length === 1) {
//     curr = curr.children[0];
//   }
//   return curr.children ?? [curr];
// }

/** Merge adjacent formatting nodes with identical style chains */
export function mergeAdjacentSameStyleNodes(ast: DocumentNode): DocumentNode {
  function process(nodes: ASTNode[]): ASTNode[] {
    const result: ASTNode[] = [];
    let i = 0;
    while (i < nodes.length) {
      const node = nodes[i];
      // if this is a formatting wrapper (e.g. BOLD, ITALIC, UNDERLINE, etc.)
      if (isFormattingNode(node.type) && node.children) {
        const style = node.type;
        const isNewline = (n: ASTNode): boolean => n.type === NodeType.TEXT && (n as TextNode).value === '\n';
        // gather a run of the same wrapper type
        let j = i + 1;
        // include style wrappers, allowing intermediate newlines only if followed by style
        while (j < nodes.length) {
          if (nodes[j].type === style) {
            j++;
            continue;
          }
          if (isNewline(nodes[j]) && j + 1 < nodes.length && nodes[j + 1].type === style) {
            j++;
            continue;
          }
          break;
        }
        if (j - i > 1) {
          // merge all children of that run
          let combined: ASTNode[] = [];
          for (let k = i; k < j; k++) {
            if (nodes[k].type === style) {
              combined.push(...nodes[k].children!);
            } else if (isNewline(nodes[k])) {
              combined.push(nodes[k]);
            }
          }
          // recurse into the merged content
          combined = process(combined);
          result.push({ type: style, children: combined });
          i = j;
          continue;
        }
        // single wrapper—just recurse inside it
        node.children = process(node.children);
        result.push(node);
        i++;
      } else {
        // leaf or non‑formatting node
        if (node.children) node.children = process(node.children);
        result.push(node);
        i++;
      }
    }
    return result;
  }
  return { ...ast, children: process(ast.children) };
}
