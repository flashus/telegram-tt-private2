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
    let tempPos = pos;

    const attrNameMatch = this.input.slice(tempPos).match(/^([^\s=<>\/,.]+)/);
    if (!attrNameMatch) return undefined;
    const attrName = attrNameMatch[1];

    tempPos += attrName.length;
    tempPos = this.skipWhitespace(tempPos);

    let attrValue = '';
    if (this.input[tempPos] === '=') {
      tempPos++; // Skip '='
      tempPos = this.skipWhitespace(tempPos);

      if (this.input[tempPos] === '"' || this.input[tempPos] === "'") {
        const quote = this.input[tempPos];
        tempPos++;
        const valueStart = tempPos;

        // { begin escaped processing
        while (tempPos < this.input.length && this.input[tempPos] !== quote) {
          if (this.input[tempPos] === '\\'
            && tempPos + 1 < this.input.length
            && (this.input[tempPos + 1] === '"'
              || this.input[tempPos + 1] === "'"
              || this.input[tempPos + 1] === '\\')) {
            tempPos++;
          }
          tempPos++;
        }
        attrValue = this.input.slice(valueStart, tempPos);
        attrValue = attrValue.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\'); // Handle escaped quotes
        // } end escaped processing

        if (this.input[tempPos] === quote) {
          tempPos++;
        }
      } else {
        const valueMatch = this.input.slice(tempPos).match(/^[^\s>\/]+/);
        if (valueMatch) {
          attrValue = valueMatch[0];
          tempPos += attrValue.length;
        } else {
          return undefined; // Attributes must have values if an equals sign is present.
        }
      }
    }
    return { attrName, attrValue, nextPos: tempPos };
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
    // Regex explanation:
    //   (\n\s*)         - Captures a newline and any following whitespace.
    //   (<\w+[^>]*>)     - Captures an HTML opening tag (e.g. "<i>")
    //   (>)             - Captures a literal '>' immediately following the tag.
    //
    // Replacement:
    //   We put the marker (">") immediately after the newline,
    //   add a space, then insert the HTML tag.
    return input.replace(/(\n\s*)(<\w+[^>]*>)(>)/g, (_, newlineAndSpace, htmlTag, marker) => {
      return `${newlineAndSpace + marker} ${htmlTag}`;
    });
  }
}
