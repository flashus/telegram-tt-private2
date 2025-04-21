import type {
  ApiFormattedText,
  ApiMessageEntityBlockquote,
  ApiMessageEntityCustomEmoji,
  ApiMessageEntityDefault,
  ApiMessageEntityPre,
  ApiMessageEntityTextUrl,
} from '../../api/types';
import { ApiMessageEntityTypes } from '../../api/types';

import { NodeType } from './astEnums';
import {
  type ASTNode,
  type BoldNode,
  type CodeBlockNode,
  type CodeNode,
  type DocumentNode,
  type HtmlTagNode,
  type ItalicNode,
  type LinkNode,
  type QuoteNode,
  type SpoilerNode,
  type StrikeNode,
  type TextNode,
  type UnderlineNode,
} from './node';

export class EntityRenderer {
  /**
   * Recursively render an AST node into plain text plus API entities.
   */
  render(node: ASTNode): ApiFormattedText {
    switch (node.type) {
      case NodeType.DOCUMENT: {
        const doc = node as DocumentNode;
        const result: ApiFormattedText = { text: '', entities: [] };
        for (const child of doc.children) {
          const childResult = this.render(child);
          // Adjust child entity offsets relative to the current text length.
          childResult.entities?.forEach((entity) => {
            entity.offset += result.text.length;
          });
          result.text += childResult.text;
          result.entities?.push(...(childResult.entities ?? []));
        }
        return result;
      }
      case NodeType.TEXT: {
        const textNode = node as TextNode;
        return { text: textNode.value, entities: [] };
      }
      case NodeType.BOLD: {
        const boldNode = node as BoldNode;
        const childResult = this.renderChildren(boldNode.children);
        const boldEntity: ApiMessageEntityDefault = {
          type: ApiMessageEntityTypes.Bold as ApiMessageEntityDefault['type'],
          offset: 0,
          length: childResult.text.length,
        };
        return { text: childResult.text, entities: [boldEntity, ...(childResult.entities ?? [])] };
      }
      case NodeType.ITALIC: {
        const italicNode = node as ItalicNode;
        const childResult = this.renderChildren(italicNode.children);
        const italicEntity: ApiMessageEntityDefault = {
          type: ApiMessageEntityTypes.Italic as ApiMessageEntityDefault['type'],
          offset: 0,
          length: childResult.text.length,
        };
        return { text: childResult.text, entities: [italicEntity, ...(childResult.entities ?? [])] };
      }
      case NodeType.UNDERLINE: {
        const underlineNode = node as UnderlineNode;
        const childResult = this.renderChildren(underlineNode.children);
        const underlineEntity: ApiMessageEntityDefault = {
          type: ApiMessageEntityTypes.Underline as ApiMessageEntityDefault['type'],
          offset: 0,
          length: childResult.text.length,
        };
        return { text: childResult.text, entities: [underlineEntity, ...(childResult.entities ?? [])] };
      }
      case NodeType.STRIKE: {
        const strikeNode = node as StrikeNode;
        const childResult = this.renderChildren(strikeNode.children);
        const strikeEntity: ApiMessageEntityDefault = {
          type: ApiMessageEntityTypes.Strike as ApiMessageEntityDefault['type'],
          offset: 0,
          length: childResult.text.length,
        };
        return { text: childResult.text, entities: [strikeEntity, ...(childResult.entities ?? [])] };
      }
      case NodeType.CODE: {
        const codeNode = node as CodeNode;
        // Render CODE node with children support
        if (codeNode.children && codeNode.children.length > 0) {
          const childResult = this.renderChildren(codeNode.children);
          const codeEntity: ApiMessageEntityDefault = {
            type: ApiMessageEntityTypes.Code as ApiMessageEntityDefault['type'],
            offset: 0,
            length: childResult.text.length,
          };
          return { text: childResult.text, entities: [codeEntity, ...(childResult.entities ?? [])] };
        } else {
          const codeEntity: ApiMessageEntityDefault = {
            type: ApiMessageEntityTypes.Code as ApiMessageEntityDefault['type'],
            offset: 0,
            length: codeNode.value.length,
          };
          return { text: codeNode.value, entities: [codeEntity] };
        }
      }
      case NodeType.CODE_BLOCK: {
        const codeBlockNode = node as CodeBlockNode;
        // Render CODE_BLOCK node with children support
        if (codeBlockNode.children && codeBlockNode.children.length > 0) {
          const childResult = this.renderChildren(codeBlockNode.children);
          const preEntity: ApiMessageEntityPre = {
            type: ApiMessageEntityTypes.Pre as ApiMessageEntityPre['type'],
            offset: 0,
            length: childResult.text.length,
            language: codeBlockNode.language,
          };
          return { text: childResult.text, entities: [preEntity, ...(childResult.entities ?? [])] };
        } else {
          const preEntity: ApiMessageEntityPre = {
            type: ApiMessageEntityTypes.Pre as ApiMessageEntityPre['type'],
            offset: 0,
            length: codeBlockNode.value.length,
            language: codeBlockNode.language,
          };
          return { text: codeBlockNode.value, entities: [preEntity] };
        }
      }
      case NodeType.LINK: {
        const linkNode = node as LinkNode;
        const childResult = this.renderChildren(linkNode.children);
        const hasTextChildOrTitle = linkNode.children.some((child) => child.type === NodeType.TEXT) || linkNode.title;
        if (hasTextChildOrTitle) {
          const textUrlEntity: ApiMessageEntityTextUrl = {
            type: ApiMessageEntityTypes.TextUrl as ApiMessageEntityTextUrl['type'],
            offset: 0,
            length: childResult.text.length,
            url: linkNode.href,
          };
          return { text: childResult.text, entities: [textUrlEntity, ...(childResult.entities ?? [])] };
        } else {
          const urlEntity: ApiMessageEntityDefault = {
            type: ApiMessageEntityTypes.Url as ApiMessageEntityDefault['type'],
            offset: 0,
            length: childResult.text.length,
          };
          return { text: childResult.text, entities: [urlEntity, ...(childResult.entities ?? [])] };
        }
      }
      case NodeType.QUOTE: {
        const quoteNode = node as QuoteNode;
        const childResult = this.renderChildren(quoteNode.children);
        const quoteEntity: ApiMessageEntityBlockquote = {
          type: ApiMessageEntityTypes.Blockquote as ApiMessageEntityBlockquote['type'],
          offset: 0,
          length: childResult.text.length,
        };
        return { text: childResult.text, entities: [quoteEntity, ...(childResult.entities ?? [])] };
      }
      case NodeType.SPOILER: {
        const spoilerNode = node as SpoilerNode;
        const childResult = this.renderChildren(spoilerNode.children);
        const spoilerEntity: ApiMessageEntityDefault = {
          type: ApiMessageEntityTypes.Spoiler as ApiMessageEntityDefault['type'],
          offset: 0,
          length: childResult.text.length,
        };
        return { text: childResult.text, entities: [spoilerEntity, ...(childResult.entities ?? [])] };
      }
      case NodeType.HTML_TAG: {
        const htmlTagNode = node as HtmlTagNode;
        return this.renderHtmlTag(htmlTagNode);
      }
      default:
        return { text: '', entities: [] };
    }
  }

  /**
   * Helper method to recursively render child nodes.
   */
  private renderChildren(children: ASTNode[]): ApiFormattedText {
    const result: ApiFormattedText = { text: '', entities: [] };
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childResult = this.render(child);
      // Adjust each entity’s offset relative to current text
      childResult.entities?.forEach((entity) => { entity.offset += result.text.length; });
      result.text += childResult.text;
      result.entities?.push(...(childResult.entities ?? []));
      // If this child is a nested quote, add a newline when not the last child
      if (child.type === NodeType.QUOTE && i < children.length - 1) {
        if (!childResult.text.endsWith('\n')) {
          result.text += '\n';
        }
      }
    }
    return result;
  }

  /**
   * Process an HTML tag node.
   *
   * - For an <img> tag with a data-entity-type of CustomEmoji, extract its alt text and document ID.
   * - For <br>, return a newline.
   * - Otherwise, recursively process its children.
   */
  private renderHtmlTag(node: HtmlTagNode): ApiFormattedText {
    const tagName = node.tagName.toLowerCase();

    if (tagName === 'img' || (tagName === 'div')) {
      const entityType = this.getHtmlTagAttribute(node, 'data-entity-type');
      if (
        entityType === ApiMessageEntityTypes.CustomEmoji
        || entityType === 'MessageEntityCustomEmoji'
      ) {
        const alt = this.getHtmlTagAttribute(node, 'alt') || '';
        const documentId = this.getHtmlTagAttribute(node, 'data-document-id') || '';
        const customEmojiEntity: ApiMessageEntityCustomEmoji = {
          type: ApiMessageEntityTypes.CustomEmoji as ApiMessageEntityCustomEmoji['type'],
          offset: 0,
          length: alt.length,
          documentId,
        };
        return { text: alt, entities: [customEmojiEntity] };
      } else {
        const alt = this.getHtmlTagAttribute(node, 'alt');
        if (alt) {
          return { text: alt, entities: [] };
        }
      }
    }

    if (tagName === 'br') {
      return { text: '\n', entities: [] };
    }

    if (node.children && node.children.length > 0) {
      return this.renderChildren(node.children);
    }
    return { text: '', entities: [] };
  }

  /**
   * Helper method to retrieve an attribute’s value from an HtmlTagNode.
   */
  // eslint-disable-next-line class-methods-use-this
  private getHtmlTagAttribute(node: HtmlTagNode, key: string): string | undefined {
    if (Array.isArray(node.attributes)) {
      for (const attr of node.attributes as { key: string; value: string }[]) {
        if (attr.key === key) {
          return attr.value;
        }
      }
    }
    return undefined;
  }
}
