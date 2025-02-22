/* eslint-disable max-len */
import type { Token } from './token';

import { NodeType, TokenType } from './astEnums';
import {
  type ASTNode,
  type BoldNode,
  type CodeBlockNode,
  type CodeNode,
  type DocumentNode,
  type EOFNode,
  HTML_TAG_MAPPING,
  type HtmlTagNode,
  type ItalicNode,
  type LinkNode,
  type QuoteNode,
  SPECIAL_HTML_PATTERNS,
  type SpoilerNode,
  type StrikeNode,
  type TextNode,
  type UnderlineNode,
} from './node';

export class Parser {
  private tokens: Token[];

  private pos: number = 0;

  private currentHtmlClosingTag: string | undefined = undefined;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  // Entry point for parsing a document
  parseDocument(): DocumentNode {
    const children: ASTNode[] = [];

    while (!this.isAtEnd()) {
      const node = this.parseInline();
      if (node) {
        children.push(node);
      }
    }

    return { type: NodeType.DOCUMENT, children };
  }

  // Parse inline content (could be text, bold, italic, or code)
  private parseInline(): ASTNode | undefined {
    const token = this.peek();

    if (!token) return undefined;

    switch (token.type) {
      case TokenType.BOLD_MARKER:
        return this.parseBold();
      case TokenType.ITALIC_MARKER:
        return this.parseItalic();
      case TokenType.STRIKE_MARKER:
        return this.parseStrike();
      case TokenType.UNDERLINE_MARKER:
        return this.parseUnderline();
      case TokenType.CODE_BLOCK:
        return this.parseCodeBlock();
      case TokenType.CODE_MARKER:
        return this.parseInlineCode();
      case TokenType.SPOILER_MARKER:
        return this.parseSpoiler();
      case TokenType.LINK_START:
        return this.parseLink();
      case TokenType.QUOTE_MARKER:
        return this.parseQuote();
      case TokenType.HTML_TAG:
        return this.parseHtmlTag();
      case TokenType.TEXT:
        return this.parseText();
      case TokenType.NEWLINE:
        this.advance();
        return this.createPlainTextNode('\n');
      case TokenType.EOF:
        return this.parseEOF();
      default:
        // Fallback: treat as plain text.
        token.type = TokenType.TEXT;
        return this.parseText();
    }
  }

  // Parse a text node until a markdown marker is encountered.
  private parseText(): TextNode {
    const token = this.consume(TokenType.TEXT);
    return this.createPlainTextNode(token.value);
  }

  private parseEOF(): EOFNode {
    const token = this.consume(TokenType.EOF);
    return { type: NodeType.EOF, value: token.value };
  }

  private parseFormattedOrCodeContent<
    T extends
    | NodeType.BOLD
    | NodeType.ITALIC
    | NodeType.STRIKE
    | NodeType.CODE
    | NodeType.SPOILER
    | NodeType.UNDERLINE,
  >(
    type: T,
    markerType: TokenType,
    hasChildren: boolean,
  ): T extends NodeType.CODE ? { type: T; value: string } | TextNode : { type: T; children: ASTNode[] } | TextNode {
    // Remember our starting position
    const startPos = this.pos;
    try {
      // Consume the opening marker.
      this.consume(markerType);

      if (hasChildren) {
        const children: ASTNode[] = [];
        // Parse until we hit a token that is the same as our marker.
        while (!this.isAtEnd() && this.peek()?.type !== markerType) {
          // Detect a newline followed by a blockquote marker.
          if (
            this.peek()?.type === TokenType.NEWLINE
            && this.peek(1)?.type === TokenType.QUOTE_MARKER
          ) {
            // Abort the formatting chain:
            // Revert all the tokens consumed as part of this formatting call to plain text.
            // For example, reset position to startPos, or mark tokens as TEXT.
            this.pos = startPos; // roll back to before we started the formatting
            // Treat the initial marker as plain text.
            return this.createPlainTextNode(this.advance().value) as any;
          }
          const node = this.parseInline();
          if (node) {
            children.push(node);
          }
        }
        // Try to consume the closing marker.
        this.consume(markerType);
        return { type, children } as any;
      } else if (type === NodeType.CODE) {
        const nodes: ASTNode[] = [];
        while (!this.isAtEnd() && this.peek()?.type !== markerType) {
          const customEmojiNode = this.parseCustomEmojiIfPresent();
          if (customEmojiNode) {
            nodes.push(customEmojiNode);
            continue;
          }
          nodes.push(this.createPlainTextNode(this.advance().value));
        }
        this.consume(markerType); // Consume the closing marker.
        if (nodes.every((node) => node.type === NodeType.TEXT)) {
          const content = nodes.map((node) => (node as TextNode).value).join('');
          return { type, value: content } as any;
        } else {
          return { type, children: nodes } as any;
        }
      } else {
        // For non-child nodes (like inline code with no nested content)
        let content = '';
        while (!this.isAtEnd() && this.peek()?.type !== markerType) {
          content += this.advance().value;
        }
        this.consume(markerType);
        return { type, value: content } as any;
      }
    } catch (error) {
      // Error recovery:
      // If we cannot find a proper closing marker or another error occurs,
      // revert to the starting position and treat the marker as plain text.
      this.pos = startPos;
      return this.createPlainTextNode(this.advance().value) as any;
    }
  }

  private parseUnderline(): UnderlineNode | TextNode {
    return this.parseFormattedOrCodeContent(NodeType.UNDERLINE, TokenType.UNDERLINE_MARKER, true);
  }

  private parseBold(): BoldNode | TextNode {
    return this.parseFormattedOrCodeContent(NodeType.BOLD, TokenType.BOLD_MARKER, true);
  }

  private parseItalic(): ItalicNode | TextNode {
    return this.parseFormattedOrCodeContent(NodeType.ITALIC, TokenType.ITALIC_MARKER, true);
  }

  private parseStrike(): StrikeNode | TextNode {
    return this.parseFormattedOrCodeContent(NodeType.STRIKE, TokenType.STRIKE_MARKER, true);
  }

  private parseSpoiler(): SpoilerNode | TextNode {
    return this.parseFormattedOrCodeContent(NodeType.SPOILER, TokenType.SPOILER_MARKER, true);
  }

  private parseInlineCode(): CodeNode | TextNode {
    return this.parseFormattedOrCodeContent(NodeType.CODE, TokenType.CODE_MARKER, false);
  }

  // Modified parseQuote() with an optional closingTag parameter.
  private parseQuote(currentLevel: number = 1): QuoteNode | TextNode {
    const children: ASTNode[] = [];
    const nextToken = this.peek();
    if (!(this.pos === 0
      || (this.peek(-1) && (this.peek(-1)?.type === TokenType.NEWLINE
        || this.peek(-1)?.type === TokenType.QUOTE_MARKER))
    ) && nextToken) {
      nextToken.type = TokenType.TEXT;
      return this.parseText() as any;
    }

    if (currentLevel === 1) {
      this.consume(TokenType.QUOTE_MARKER);
    }

    while (!this.isAtEnd()) {
      // If we are at the beginning of a new line (previous token was NEWLINE)
      // and the current token is not a QUOTE_MARKER, then end the quote.
      if (this.pos > 0 && this.peek(-1)?.type === TokenType.NEWLINE && this.peek()?.type !== TokenType.QUOTE_MARKER) {
        break;
      }

      // If we are inside an HTML element (currentHtmlClosingTag is set)
      // and the next token is that HTML closing tag, then break out of the quote.
      if (
        this.currentHtmlClosingTag
        && this.peek()?.type === TokenType.HTML_TAG
        && this.peek()?.attributes?.tagName?.toLowerCase() === this.currentHtmlClosingTag
        && this.peek()?.attributes?.isClosing
      ) {
        break;
      }

      const current = this.peek();
      if (current?.type === TokenType.EOF) break;

      if (current?.type === TokenType.NEWLINE) {
        const next = this.peek(1);
        if (!next || next.type !== TokenType.QUOTE_MARKER) {
          break;
        }
        const node = this.parseInline();
        if (node) {
          children.push(node);
        }

        const nextLevel = this.countQuoteMarkers();
        if (nextLevel === 0) break; // End of quote
        if (nextLevel > currentLevel) {
          children.push(this.parseQuote(nextLevel));
          // Add a newline after the nested quote
          children.push(this.createPlainTextNode('\n'));
        } else if (nextLevel < currentLevel) {
          break;
        }
      } else {
        const node = this.parseInline();
        if (node) {
          children.push(node);
        }
      }
    }

    if (this.peek() && this.peek()?.type === TokenType.NEWLINE) {
      this.consume(TokenType.NEWLINE);
    }

    // Remove trailing newlines
    while (children.length > 0) {
      const lastChild = children[children.length - 1];
      if (lastChild.type === NodeType.TEXT && (lastChild as TextNode).value.trim() === '') {
        children.pop();
      } else {
        break;
      }
    }

    return { type: NodeType.QUOTE, children };
  }

  private countQuoteMarkers(): number {
    let count = 0;
    while (this.peek()?.type === TokenType.QUOTE_MARKER) {
      count++;
      this.consume(TokenType.QUOTE_MARKER);
    }
    return count;
  }

  private parseCodeBlock(): CodeBlockNode | TextNode {
    // Look ahead: if no closing MARKER is found later,
    // then treat the opening marker as plain text.
    const nextToken = this.peek();
    if (!this.hasClosingToken(TokenType.CODE_BLOCK) && nextToken) {
      // Let parseText() handle the marker and subsequent tokens as plain text.
      nextToken.type = TokenType.TEXT;
      return this.parseText() as any;
    }

    this.consume(TokenType.CODE_BLOCK);

    let language = '';

    // Check if the next two tokens form a language specifier:
    //   - token1 must be a TEXT token with no spaces
    //   - token2 must be a NEWLINE token
    if (!this.isAtEnd() && this.peek()?.type === TokenType.TEXT) {
      const langToken = this.peek();
      if (!langToken?.value.includes(' ')) {
        // Peek ahead to ensure the next token is NEWLINE.
        if (this.tokens[this.pos + 1] && this.tokens[this.pos + 1].type === TokenType.NEWLINE) {
          // Consume the language token and the newline.
          language = this.advance().value; // consume TEXT token (language)
          this.advance(); // consume NEWLINE token
        }
      }
    }

    // Code block processing with custom emoji support
    const nodes: ASTNode[] = [];
    while (!this.isAtEnd() && this.peek()?.type !== TokenType.CODE_BLOCK) {
      const customEmojiNode = this.parseCustomEmojiIfPresent();
      if (customEmojiNode) {
        nodes.push(customEmojiNode);
        continue;
      }
      nodes.push(this.createPlainTextNode(this.advance().value));
    }
    this.consume(TokenType.CODE_BLOCK); // consume closing CODE_BLOCK token

    // If all nodes are plain text, join them into a single string.
    if (nodes.every((node) => node.type === NodeType.TEXT)) {
      const content = nodes.map((node) => (node as TextNode).value).join('');
      return {
        type: NodeType.CODE_BLOCK,
        language,
        value: content.trim(),
      };
    } else {
      while (nodes.length > 0 && nodes[0].type === NodeType.TEXT) {
        const trimmedValue = (nodes[0] as TextNode).value.trimStart();
        if (trimmedValue === '') {
          nodes.shift();
        } else {
          (nodes[0] as TextNode).value = trimmedValue;
          break;
        }
      }
      while (nodes.length > 0 && nodes[nodes.length - 1].type === NodeType.TEXT) {
        const trimmedValue = (nodes[nodes.length - 1] as TextNode).value.trimEnd();
        if (trimmedValue === '') {
          nodes.pop();
        } else {
          (nodes[nodes.length - 1] as TextNode).value = trimmedValue;
          break;
        }
      }

      return {
        type: NodeType.CODE_BLOCK,
        language,
        children: nodes,
      } as any;
    }
  }

  private parseLink(): LinkNode | TextNode {
    // Consume the LINK_START token: "["
    this.consume(TokenType.LINK_START);

    // Parse the link text.
    // For simplicity we assume the link text is contained in one or more inline elements until a LINK_END is found.
    const children: ASTNode[] = [];
    while (!this.isAtEnd() && this.peek()?.type !== TokenType.LINK_END) {
      const node = this.parseInline();
      if (node) {
        children.push(node);
      }
    }

    // If we've reached the end without finding LINK_END, treat it as plain text
    if (this.isAtEnd()) {
      return this.createPlainTextNode(`[${children.map((child) => (child as TextNode).value).join('')}`);
    }

    // Consume the LINK_END token: "]"
    this.consume(TokenType.LINK_END);

    // Check if the next token is URL_START
    if (!this.peek() || this.peek()?.type !== TokenType.URL_START) {
      // If not, return it as plain text
      return this.createPlainTextNode(`[${children.map((child) => (child as TextNode).value).join('')}]`);
    }

    // Now, expect the URL part, which starts with URL_START "("
    this.consume(TokenType.URL_START);

    // The URL is expected to be a TEXT token.
    let href = '';
    if (!this.isAtEnd() && this.peek()?.type === TokenType.TEXT) {
      href = this.consume(TokenType.TEXT).value.trim();
    }

    let title = '';
    if (this.peek()?.type === TokenType.QUOTEMARK_MARKER) {
      this.consume(TokenType.QUOTEMARK_MARKER);

      title = this.consume(TokenType.TEXT).value;

      if (this.isAtEnd() || (this.peek()?.type !== TokenType.QUOTEMARK_MARKER)) {
        return this.createPlainTextNode(`[${children.map((child) => (child as TextNode).value).join('')}](${href} "${title}`);
      }
      this.consume(TokenType.QUOTEMARK_MARKER);
    }

    // If we've reached the end without finding URL_END, treat it as plain text
    if (this.isAtEnd() || (this.peek()?.type !== TokenType.URL_END)) {
      return this.createPlainTextNode(`[${children.map((child) => (child as TextNode).value).join('')}](${href}`);
    }

    // Consume the URL_END token: ")"
    this.consume(TokenType.URL_END);

    return {
      type: NodeType.LINK,
      href,
      title,
      children,
    };
  }

  private parseHtmlTag(): ASTNode {
    // Consume the HTML_TAG token.
    const token = this.consume(TokenType.HTML_TAG);

    // First, check for any special HTML patterns.
    const special = this.handleSpecialHtmlPattern(token);
    if (special !== undefined) return special;

    // Ensure the token has HTML attributes with a tag name.
    if (!token.attributes || !token.attributes.tagName) {
      return this.createPlainTextNode(token.value);
    }
    const {
      tagName, isClosing, isSelfClosing, attributes,
    } = token.attributes;
    const lowerTag = tagName.toLowerCase();

    // Special handling for <code> and <pre> tags.
    if (lowerTag === 'code' || lowerTag === 'pre') {
      return this.handleCodeOrPreTag(token, lowerTag);
    }

    // If the tag is not closing/self-closing and no closing tag exists, treat it as text.
    if (!isClosing && !isSelfClosing && !this.hasClosingHtmlTag(lowerTag)) {
      return this.createPlainTextNode(token.value);
    }

    // Check if the tag maps to a known type.
    const mapping = HTML_TAG_MAPPING[lowerTag];

    // For unmapped tags, use our helper.
    if (!mapping) {
      return this.handleUnmappedTag(token, lowerTag);
    }

    // For mapped tags: if it's a closing tag, render as plain text.
    if (isClosing) {
      return this.createPlainTextNode(token.value);
    }

    // If self-closing, handle LINK mapping specially.
    if (isSelfClosing) {
      if (mapping.type === NodeType.LINK) {
        return {
          type: NodeType.HTML_TAG,
          tagName,
          attributes: attributes || [],
          isClosing: Boolean(isClosing),
          isSelfClosing: Boolean(isSelfClosing),
          value: token.value,
        } as HtmlTagNode;
      }
      return { type: mapping.type, children: [] } as ASTNode;
    }

    // For non-self-closing mapped tags, delegate to the helper.
    return this.handleMappedTag(token, lowerTag, mapping);
  }

  /**
   * Checks for and handles any special HTML patterns.
   * Returns an AST node if a special pattern is detected, or undefined otherwise.
   */
  private handleSpecialHtmlPattern(token: Token): ASTNode | undefined {
    for (const pattern of SPECIAL_HTML_PATTERNS) {
      if (pattern.regex.test(token.value)) {
        if (!token.attributes || !token.attributes.tagName) {
          return this.createPlainTextNode(token.value);
        }
        const lowerTag = token.attributes.tagName.toLowerCase();
        if (token.attributes.isClosing) {
          return this.createPlainTextNode(token.value);
        }
        const specialNode: ASTNode = { type: pattern.nodeType, children: [] };
        if (!token.attributes.isSelfClosing) {
          while (!this.isAtEnd()) {
            if (
              this.peek()?.type === TokenType.HTML_TAG
              && this.peek()?.attributes?.tagName?.toLowerCase() === lowerTag
              && this.peek()?.attributes?.isClosing
            ) {
              this.consume(TokenType.HTML_TAG);
              break;
            }
            const child = this.parseInline();
            if (child) {
              specialNode.children?.push(child);
            }
          }
        }
        return specialNode;
      }
    }
    return undefined;
  }

  /**
   * Handles <code> and <pre> tags.
   */
  private handleCodeOrPreTag(token: Token, lowerTag: string): ASTNode {
    if (!token.attributes?.isClosing) {
      let innerText = '';
      while (!this.isAtEnd()) {
        const nextToken = this.peek();
        if (
          nextToken?.type === TokenType.HTML_TAG
          && nextToken.attributes
          && nextToken.attributes.tagName?.toLowerCase() === lowerTag
          && nextToken.attributes.isClosing
        ) {
          this.consume(TokenType.HTML_TAG);
          break;
        }
        innerText += this.advance().value;
      }
      innerText = innerText.trim();
      const dataLanguage = token.attributes?.attributes?.find((attr) => attr.key === 'data-language')?.value;

      return lowerTag === 'code'
        ? ({ type: NodeType.CODE, value: innerText } as CodeNode)
        : ({ type: NodeType.CODE_BLOCK, value: innerText, language: dataLanguage } as CodeBlockNode);
    } else {
      return this.createPlainTextNode(token.value);
    }
  }

  /**
   * Handles HTML tags that do not have a mapping.
   */
  private handleUnmappedTag(token: Token, lowerTag: string): ASTNode {
    const {
      tagName, isClosing, isSelfClosing, attributes,
    } = token.attributes!;
    const htmlTagNode: HtmlTagNode = {
      type: NodeType.HTML_TAG,
      tagName,
      attributes: attributes || [],
      isClosing: Boolean(isClosing),
      isSelfClosing: Boolean(isSelfClosing),
      value: token.value,
      children: [],
    };
    if (!isClosing && !isSelfClosing) {
      const previousClosingTag = this.currentHtmlClosingTag;
      this.currentHtmlClosingTag = lowerTag;
      while (!this.isAtEnd()) {
        if (
          this.peek()?.type === TokenType.HTML_TAG
          && this.peek()?.attributes?.tagName?.toLowerCase() === lowerTag
          && this.peek()?.attributes?.isClosing
        ) {
          break;
        }
        const child = this.parseInline();
        if (child) {
          htmlTagNode.children?.push(child);
        }
      }
      if (
        !this.isAtEnd()
        && this.peek()?.type === TokenType.HTML_TAG
        && this.peek()?.attributes?.tagName?.toLowerCase() === lowerTag
        && this.peek()?.attributes?.isClosing
      ) {
        this.consume(TokenType.HTML_TAG);
      }
      this.currentHtmlClosingTag = previousClosingTag;
    }
    return htmlTagNode;
  }

  /**
   * Handles mapped HTML tags that are not self-closing.
   */
  private handleMappedTag(token: Token, lowerTag: string, mapping: any): ASTNode {
    const { attributes } = token.attributes!;
    const node: ASTNode = { type: mapping.type, children: [] };
    const previousClosingTag = this.currentHtmlClosingTag;
    this.currentHtmlClosingTag = lowerTag;
    while (!this.isAtEnd()) {
      if (
        this.peek()?.type === TokenType.HTML_TAG
        && this.peek()?.attributes?.tagName?.toLowerCase() === lowerTag
        && this.peek()?.attributes?.isClosing
      ) {
        break;
      }
      const child = this.parseInline();
      if (child) {
        node.children?.push(child);
      }
    }
    if (
      !this.isAtEnd()
      && this.peek()?.type === TokenType.HTML_TAG
      && this.peek()?.attributes?.tagName?.toLowerCase() === lowerTag
      && this.peek()?.attributes?.isClosing
    ) {
      this.consume(TokenType.HTML_TAG);
    } else {
      this.currentHtmlClosingTag = previousClosingTag;
      return this.createPlainTextNode(token.value);
    }
    this.currentHtmlClosingTag = previousClosingTag;

    // If the mapping is for a link, extract additional attributes.
    if (mapping.type === NodeType.LINK) {
      let href = '';
      let title: string | undefined;
      let target: string | undefined;
      if (attributes && Array.isArray(attributes)) {
        for (const attr of attributes) {
          const key = attr.key.toLowerCase();
          if (key === 'href') {
            href = attr.value;
          } else if (key === 'title') {
            title = attr.value;
          } else if (key === 'target') {
            target = attr.value;
          }
        }
      }
      return {
        type: NodeType.LINK, href, title, target, children: node.children,
      } as LinkNode;
    } else {
      return { type: mapping.type, children: node.children } as ASTNode;
    }
  }

  private hasClosingHtmlTag(lowerTag: string): boolean {
    // Look ahead from the current position to see if there is a closing HTML tag with the given tag name.
    return this.tokens.slice(this.pos).some(
      (t) => t.type === TokenType.HTML_TAG
        && t.attributes?.tagName?.toLowerCase() === lowerTag
        && t.attributes.isClosing,
    );
  }

  // Helper: look ahead for a closing token of a given type.
  private hasClosingToken(tokenType: TokenType): boolean {
    // Look ahead from the current position (skipping the current token)
    const remainingTokens = this.tokens.slice(this.pos + 1);
    return remainingTokens.some((token) => token.type === tokenType);
  }

  // Helper: Return the current token without advancing.
  private peek(offset: number = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  // Helper: Consume a token of the expected type.
  private consume(expectedType: TokenType): Token {
    const token = this.peek();
    if (!token || token.type !== expectedType) {
      throw new Error(`Expected token ${expectedType} but found ${token ? token.type : 'none'} at position ${this.pos}`);
    }
    return this.advance();
  }

  // Helper: Advance the pointer and return the current token.
  private advance(): Token {
    return this.tokens[this.pos++];
  }

  // Helper: Check if we have reached the end.
  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  // eslint-disable-next-line class-methods-use-this
  private createPlainTextNode(content: string): TextNode {
    return {
      type: NodeType.TEXT,
      value: content,
    };
  }

  // New helper function to parse custom emojis
  private parseCustomEmojiIfPresent(): ASTNode | undefined {
    const token = this.peek();
    if (
      token
      && token.type === TokenType.HTML_TAG
      && token.attributes?.attributes
      && Array.isArray(token.attributes.attributes)
    ) {
      const isCustomEmoji = token.attributes.attributes.some(
        (attr) => attr.key === 'data-entity-type'
          && attr.value === 'MessageEntityCustomEmoji',
      );
      if (isCustomEmoji) {
        return this.parseHtmlTag();
      }
    }
    return undefined;
  }
}
