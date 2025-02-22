/* eslint-disable max-len */
import { ApiMessageEntityTypes } from '../../api/types';

import { NodeType } from './astEnums';
import {
  type ASTNode,
  type BoldNode, type CodeBlockNode, type CodeNode, type DocumentNode, type HtmlTagNode, type ItalicNode, type LinkNode,
  type QuoteNode, type SpoilerNode, type StrikeNode, type TextNode,
  type UnderlineNode,
} from './node';

export class Renderer {
  // Recursively render an AST node to HTML.
  render(node: ASTNode): string {
    switch (node.type) {
      case NodeType.DOCUMENT:
        return (node as DocumentNode).children.map((child) => this.render(child)).join('');
      case NodeType.HTML_TAG:
        return this.renderHtmlTag(node as HtmlTagNode);
      case NodeType.TEXT:
        return this.renderText(node as TextNode);
      case NodeType.BOLD:
        return `<b>${(node as BoldNode).children.map((child) => this.render(child)).join('')}</b>`;
      case NodeType.ITALIC:
        return `<i>${(node as ItalicNode).children.map((child) => this.render(child)).join('')}</i>`;
      case NodeType.UNDERLINE:
        return `<u>${(node as UnderlineNode).children.map((child) => this.render(child)).join('')}</u>`;
      case NodeType.CODE_BLOCK: {
        const codeBlock = node as CodeBlockNode;
        const langClass = codeBlock.language ? ` data-language="${codeBlock.language}"` : '';

        let codeContent = '';
        if (typeof codeBlock.value === 'string') {
          codeContent = this.escapeHtml(codeBlock.value);
        } else if (codeBlock.children) {
          codeContent = codeBlock.children.map((child) => {
            if (child.type === NodeType.TEXT) {
              return (child as TextNode).value;
            } else if (child.type === NodeType.HTML_TAG) {
              return (child as HtmlTagNode).value;
            } else {
              return this.render(child);
            }
          }).join('');
        }

        return `<pre${langClass}>${codeContent}</pre>`;
      }
      case NodeType.CODE: {
        const codeNode = node as CodeNode;

        let codeContent = '';
        if (typeof codeNode.value === 'string') {
          codeContent = this.escapeHtml(codeNode.value);
        } else if (codeNode.children) {
          codeContent = codeNode.children.map((child) => {
            if (child.type === NodeType.TEXT) {
              return (child as TextNode).value;
            } else if (child.type === NodeType.HTML_TAG) {
              return (child as HtmlTagNode).value;
            } else {
              return this.render(child);
            }
          }).join('');
        }

        return `<code>${codeContent}</code>`;
      }
      case NodeType.STRIKE:
        return `<s>${(node as StrikeNode).children.map((child) => this.render(child)).join('')}</s>`;
      case NodeType.LINK:
        return this.renderLink(node as LinkNode);
      case NodeType.QUOTE:
        return this.renderQuote(node as QuoteNode);
      case NodeType.SPOILER:
        return `<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">${(node as SpoilerNode).children.map((child) => this.render(child)).join('')}</span>`;
      default:
        return '';
    }
  }

  private renderHtmlTag(node: HtmlTagNode): string {
    const {
      tagName, attributes, isClosing, isSelfClosing, children,
    } = node;

    let attributeString = '';
    if (attributes && Array.isArray(attributes)) {
      attributeString = attributes
        .map((attr) => ` ${attr.key}="${this.escapeHtml(attr.value)}"`)
        .join('');
    }

    if (isClosing) {
      return `</${tagName}>`;
    }

    const openingTag = `<${tagName}${attributeString}${isSelfClosing ? '/' : ''}>`;

    if (isSelfClosing) {
      return openingTag;
    }

    const closingTag = `</${tagName}>`;
    const renderedChildren = (children || []).map((child) => this.render(child)).join('');

    return `${openingTag}${renderedChildren}${closingTag}`;
  }

  private renderLink(node: LinkNode): string {
    const targetAttr = node.target ? ` target="${node.target}"` : '';
    const result = node.title
      ? `<a href="${node.href}" title="${node.title}"${targetAttr}>${node.children.map((child) => this.render(child)).join('')}</a>`
      : `<a href="${node.href}"${targetAttr}>${node.children.map((child) => this.render(child)).join('')}</a>`;
    return result;
  }

  private renderQuote(node: QuoteNode): string {
    let html: string = '<blockquote class="quote quote-like quote-like-border quote-like-icon" dir="auto">\n';
    html += '::before\n';
    html += `${node.children.map((child) => this.render(child)).join('')}\n`;
    html += '::after\n';
    html += '</blockquote>';
    return html;
  }

  private renderText(node: TextNode): string {
    return this.escapeHtml(node.value);
  }

  // eslint-disable-next-line class-methods-use-this
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
