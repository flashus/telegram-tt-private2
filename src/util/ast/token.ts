import type { TokenType } from './astEnums';

export const TOKEN_PATTERNS: { [key: string]: string } = {
  BOLD_MARKER: '**',
  ITALIC_MARKER: '__',
  STRIKE_MARKER: '~~',
  SPOILER_MARKER: '||',
  UNDERLINE_MARKER: '++',
  LINK_START: '[',
  LINK_END: ']',
  URL_START: '(',
  URL_END: ')',
  CODE_BLOCK: '```',
  DBL_CODE_MARKER: '``',
  CODE_MARKER: '`',
  QUOTEMARK_MARKER: '"',
  NEWLINE: '\n',
  QUOTE_MARKER: '>',
} as const;

export type TokenPattern = typeof TOKEN_PATTERNS[keyof typeof TOKEN_PATTERNS];

// A token is simply an object with a type, value and its location (optional)
export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  // For code block tokens, we store the language (if specified).
  language?: string;
  attributes?: HtmlTagParseResult;
}

export interface HtmlTagParseResult {
  tagName: string;
  attributes: { key: string; value: string }[];
  isClosing: boolean;
  isSelfClosing: boolean;
  endPos: number;
  isCodeContent?: boolean;
}
