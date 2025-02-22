import { ApiMessageEntityTypes } from '../../api/types';

import { NodeType } from './astEnums';

// Base AST Node interface
export interface ASTNode {
  type: string;
  // type: number;
  children?: ASTNode[]; // Some nodes will have children
}

// For plain text
export interface TextNode extends ASTNode {
  type: NodeType.TEXT;
  value: string;
}

export interface EOFNode extends ASTNode {
  type: NodeType.EOF;
  value: string;
}

// For bold text
export interface BoldNode extends ASTNode {
  type: NodeType.BOLD;
  children: ASTNode[];
}

export interface UnderlineNode extends ASTNode {
  type: NodeType.UNDERLINE;
  children: ASTNode[];
}

// For italic text
export interface ItalicNode extends ASTNode {
  type: NodeType.ITALIC;
  children: ASTNode[];
}

export interface StrikeNode extends ASTNode {
  type: NodeType.STRIKE;
  children: ASTNode[];
}

// For inline code text
export interface CodeNode extends ASTNode {
  type: NodeType.CODE;
  value: string;
}

// For code blocks with language specification
export interface CodeBlockNode extends ASTNode {
  type: NodeType.CODE_BLOCK;
  language: string;
  value: string;
}

// For links
export interface LinkNode extends ASTNode {
  type: NodeType.LINK;
  href: string;
  title?: string;
  target?: string;
  children: ASTNode[];
}

export interface SpoilerNode extends ASTNode {
  type: NodeType.SPOILER;
  children: ASTNode[];
}

export interface QuoteNode extends ASTNode {
  type: NodeType.QUOTE;
  children: ASTNode[];
}

export interface HtmlTagNode extends ASTNode {
  type: NodeType.HTML_TAG;
  tagName: string;
  isClosing: Boolean;
  isSelfClosing: Boolean;
  attributes: HtmlTagParseResult | { key: string; value: string }[];
  value: string;
}

interface HtmlTagParseResult {
  tagName: string;
  isClosing: boolean;
  // ...
}

// Top-level document node
export interface DocumentNode extends ASTNode {
  type: NodeType.DOCUMENT;
  children: ASTNode[];
}

export const SPECIAL_HTML_PATTERNS: {
  regex: RegExp;
  nodeType: NodeType;
}[] = [{
  // Matches a <span> with data-entity-type equal to the Spoiler type
  regex: new RegExp(`<span\\s+[^>]*data-entity-type=["']${ApiMessageEntityTypes.Spoiler}["'][^>]*>`, 'i'),
  nodeType: NodeType.SPOILER,
}];

// eslint-disable-next-line max-len
export const HTML_TAG_MAPPING: Record<string, { type: NodeType.BOLD | NodeType.ITALIC | NodeType.UNDERLINE | NodeType.STRIKE | NodeType.LINK | NodeType.SPOILER | NodeType.QUOTE | NodeType.CODE_BLOCK | NodeType.CODE }> = {
  b: { type: NodeType.BOLD },
  strong: { type: NodeType.BOLD },
  i: { type: NodeType.ITALIC },
  em: { type: NodeType.ITALIC },
  u: { type: NodeType.UNDERLINE },
  ins: { type: NodeType.UNDERLINE },
  s: { type: NodeType.STRIKE },
  strike: { type: NodeType.STRIKE },
  del: { type: NodeType.STRIKE },
  a: { type: NodeType.LINK },
  spoiler: { type: NodeType.SPOILER }, // should be <span data-entity-type="${ApiMessageEntityTypes.Spoiler}">
  blockquote: { type: NodeType.QUOTE },
  pre: { type: NodeType.CODE_BLOCK },
  code: { type: NodeType.CODE },
  // div, p should be stripped
};

// eslint-disable-next-line max-len
export const HTML_SELF_CLOSED_TAGS = ['area', 'base', 'col', 'embed', 'param', 'wbr', 'br', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track'];

export const VALID_HTML_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ins',
  's',
  'strike',
  'del',
  'a',
  'spoiler',
  'blockquote',
  'pre',
  'code',
  'div',
  'p',
  'span',
  'img',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'table',
  'tr',
  'td',
  'th',
  'thead',
  'tbody',
  'tfoot',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'input',
];
