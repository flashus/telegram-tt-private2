/* eslint-disable no-useless-escape */
/* eslint-disable max-len */
import type { HtmlTagParseResult, Token, TokenPattern } from './token';

import { TokenType } from './astEnums';
import { HTML_SELF_CLOSED_TAGS, VALID_HTML_TAGS } from './node';
import { TOKEN_PATTERNS } from './token';

const STRING_PATTERNS_FIRST_CHARS = new Set(
  Object.values(TOKEN_PATTERNS)
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p[0]),
);

const COMPILED_REGEX_PATTERNS = new Map(
  Object.values(TOKEN_PATTERNS)
    .filter((p): p is RegExp => p instanceof RegExp)
    .map((pattern) => [pattern, new RegExp(`^${pattern.source}`)]),
);

export class Lexer {
  private input: string;

  private pos: number = 0;

  constructor(input: string) {
    this.input = this.preprocessRawMarkdown(input);
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (!this.isAtEnd()) {
      tokens.push(this.getNextToken());
    }
    tokens.push(this.createToken(TokenType.EOF, '', this.pos));
    return tokens;
  }

  private getNextToken(): Token {
    const char = this.current;

    if (char === '\n') {
      const token = this.createToken(TokenType.NEWLINE, '\n');
      this.advance();
      return token;
    }

    if (char === '\\') {
      return this.tokenizeEscapedChar();
    }

    const markerToken = this.tokenizeMarker();
    if (markerToken) {
      return markerToken;
    }

    if (char === '<' && this.isHtmlTagAhead()) {
      const htmlToken = this.tryTokenizeHtmlTag();
      if (htmlToken) {
        return htmlToken;
      }
    }

    return this.tokenizeText();
  }

  protected tryTokenizeHtmlTag(): Token | undefined {
    const start = this.pos;
    if (this.current !== '<') return undefined;

    const parseResult = this.parseHtmlTag(this.pos);

    if (!parseResult) {
      return undefined;
    }

    const {
      tagName, attributes, isClosing, isSelfClosing, endPos,
    } = parseResult;

    this.pos = endPos;
    const value = this.input.slice(start, this.pos);

    return this.createToken(TokenType.HTML_TAG, value, start, {
      tagName,
      attributes,
      isClosing,
      isSelfClosing,
    });
  }

  protected isHtmlTagAhead(): boolean {
    return this.isValidHtmlTag(this.pos);
  }

  private isValidHtmlTag(pos: number): boolean {
    const parseResult = this.parseHtmlTag(pos);
    return !!parseResult;
  }

  private parseHtmlTag(startPos: number): HtmlTagParseResult | undefined {
    let tempPos = startPos;
    if (this.input[tempPos] !== '<') return undefined;

    tempPos++; // Skip '<'

    const isClosing = this.input[tempPos] === '/';
    if (isClosing) {
      tempPos++;
    }

    const tagNameMatch = this.input.slice(tempPos).match(/^[a-zA-Z][a-zA-Z0-9-]*/);
    if (!tagNameMatch) return undefined;
    const tagName = tagNameMatch[0];
    tempPos += tagName.length;

    if (!VALID_HTML_TAGS.includes(tagName.toLowerCase())) {
      return undefined;
    }

    tempPos = this.skipWhitespace(tempPos);

    const attributes: { key: string; value: string }[] = [];
    while (
      tempPos < this.input.length
      && this.input[tempPos] !== '>'
      && this.input[tempPos] !== '/'
    ) {
      tempPos = this.skipWhitespace(tempPos);
      if (tempPos >= this.input.length || this.input[tempPos] === '>' || this.input[tempPos] === '/') {
        break;
      }

      // New function call for the additional validation check
      const attributeResult = this.parseHtmlAttribute(tempPos);

      if (!attributeResult) {
        return undefined; // stop tag validation, because attributes has invalid format
      }

      const { attrName, attrValue, nextPos } = attributeResult;

      attributes.push({ key: attrName, value: attrValue });
      tempPos = nextPos;
      tempPos = this.skipWhitespace(tempPos);
    }

    let isSelfClosing = this.input[tempPos] === '/';
    if (isSelfClosing) {
      tempPos++;
    }

    isSelfClosing = HTML_SELF_CLOSED_TAGS.includes(tagName.toLowerCase()) || this.input.slice(tempPos - 1 + tagName.length).trim().startsWith('/>');

    if (tempPos >= this.input.length || this.input[tempPos] !== '>') {
      return undefined;
    }
    tempPos++;

    return {
      tagName,
      attributes,
      isClosing,
      isSelfClosing,
      endPos: tempPos,
    };
  }

  private parseHtmlAttribute(pos: number): { attrName: string; attrValue: string; nextPos: number } | undefined {
    let i = pos;
    // parse attribute name
    const nameMatch = this.input.slice(i).match(/^([A-Za-z][A-Za-z0-9_-]*)/);
    if (!nameMatch) return undefined;
    const attrName = nameMatch[1];
    i += attrName.length;

    // detect '=' (immediate or after spaces)
    const nameEnd = i;
    let eqPos: number | undefined;
    if (this.input[nameEnd] === '=') {
      eqPos = nameEnd;
    } else {
      const skipPos = this.skipWhitespace(nameEnd);
      if (this.input[skipPos] === '=') eqPos = skipPos;
    }
    if (eqPos === undefined) {
      // no value
      return { attrName, attrValue: '', nextPos: nameEnd };
    }
    // process '='
    const spacedBefore = eqPos !== nameEnd;
    i = eqPos + 1;
    if (spacedBefore) {
      // require quoted if spaces before '='
      i = this.skipWhitespace(i);
    }

    // parse value
    if (this.input[i] === '"' || this.input[i] === "'") {
      const quote = this.input[i++];
      const startVal = i;
      while (i < this.input.length && this.input[i] !== quote) {
        if (this.input[i] === '\\' && i + 1 < this.input.length && (this.input[i + 1] === quote || this.input[i + 1] === '\\')) {
          i++;
        }
        i++;
      }
      const raw = this.input.slice(startVal, i);
      if (this.input[i] === quote) i++;
      const attrValue = raw.replace(/\\(["'\\])/g, '$1');
      return { attrName, attrValue, nextPos: i };
    }
    // unquoted allowed only if immediate '=' (no spaces)
    if (!spacedBefore) {
      const match = this.input.slice(i).match(/^[^\s>\/]+/);
      if (match) {
        const attrValue = match[0];
        i += attrValue.length;
        return { attrName, attrValue, nextPos: i };
      }
    }
    // invalid syntax
    return undefined;
  }

  private skipWhitespace(pos: number): number {
    while (pos < this.input.length && /\s/.test(this.input[pos])) {
      pos++;
    }
    return pos;
  }

  private isMarker(char: string): boolean {
    // Quick check if char could be start of a string pattern
    if (!STRING_PATTERNS_FIRST_CHARS.has(char)) {
      return false; // Early return since char isn't a valid marker start
    }

    // Check all patterns since we know char is a potential marker start
    return Object.entries(TOKEN_PATTERNS).some(([, pattern]) => {
      if (typeof pattern === 'string') {
        return pattern.startsWith(char) && this.input.startsWith(pattern, this.pos);
      } else if (pattern instanceof RegExp) {
        if (pattern.source.startsWith('^')) {
          return pattern.test(this.input.slice(this.pos));
        } else {
          const compiledRegex = COMPILED_REGEX_PATTERNS.get(pattern);
          return compiledRegex!.test(this.input.slice(this.pos));
        }
      }
      return false;
    });
  }

  private tokenizeMarker(): Token | undefined {
    const start = this.pos;
    for (const [type, pattern] of Object.entries(TOKEN_PATTERNS)) {
      if (typeof pattern === 'string') {
        if (this.match(pattern)) {
          return this.createToken(
            TokenType[type as keyof typeof TokenType],
            pattern,
            start,
          );
        }
      }
    }
    return undefined;
  }

  private tokenizeText(): Token {
    const start = this.pos;
    while (
      !this.isAtEnd()
      && this.current !== '\n'
      && !(this.current === '<' && this.isHtmlTagAhead())
      && !this.isMarker(this.current)
    ) {
      if (this.current === '\\') {
        this.advance();
        if (!this.isAtEnd()) {
          this.advance();
          continue;
        }
      }
      this.advance();
    }
    return this.createToken(TokenType.TEXT, this.input.slice(start, this.pos), start);
  }

  private tokenizeEscapedChar(): Token {
    const start = this.pos;
    this.advance();
    if (!this.isAtEnd()) {
      const escapedChar = this.current;
      this.advance();
      return this.createToken(TokenType.TEXT, escapedChar, start);
    }
    return this.createToken(TokenType.TEXT, '\\', start);
  }

  private match(pattern: TokenPattern): boolean {
    if (typeof pattern === 'string') {
      if (this.input.startsWith(pattern, this.pos)) {
        this.advance(pattern.length);
        return true;
      }
    }
    return false;
  }

  private createToken(
    type: TokenType,
    value: string,
    start?: number,
    attributes?: any,
  ): Token {
    start = start ?? this.pos;
    const end = start + value.length;
    return {
      type, value, start, end, attributes,
    };
  }

  private advance(n: number = 1): void {
    this.pos += n;
  }

  private get current(): string {
    return this.input[this.pos];
  }

  private isAtEnd(): boolean {
    return this.pos >= this.input.length;
  }

  /**
   * preprocessRawMarkdown runs before lexing.
   *
   * It searches for occurrences where a newline (with optional whitespace)
   * is immediately followed by an HTML tag that is “swallowing” a markdown marker.
   * For example, it converts:
   *
   *     "\n<i>>"
   *
   * into:
   *
   *     "\n> <i>"
   *
   * This ensures that the ">" appears at the start of the line and will be
   * recognized by your lexer as a quote marker.
   *
   * You can easily extend this approach for other markers (like "**" for bold)
   * by adjusting the regex.
   *
   * @param input The raw markdown input.
   * @returns The preprocessed markdown string.
   */
  // eslint-disable-next-line class-methods-use-this
  private preprocessRawMarkdown(input: string): string {
    // Regex matches:
    //   1. (\n\s*) - newline and spaces
    //   2. (</blockquote>) - closing blockquote
    // Both followed by (<\w+[^>]*>) and (>)
    return input.replace(
      /(\n\s*|<\/blockquote>\s*)(<\w+[^>]*>)?(>)/g,
      (_, prefix, htmlTag, marker) => {
        if (prefix.startsWith('</blockquote>')) {
          // Add newline after </blockquote>
          return `${prefix}\n${marker}${htmlTag || ''}`;
        } else {
          // Normal newline case
          return `${prefix}${marker}${htmlTag || ''}`;
        }
      },
    );
  }
}
