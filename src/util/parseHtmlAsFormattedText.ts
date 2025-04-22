import type { ApiFormattedText } from '../api/types';
import { ApiMessageEntityTypes } from '../api/types';

import {
  parseMarkdownHtmlToEntities,
  parseMarkdownHtmlToEntitiesWithCursorSelection,
} from './ast/parseMdAsFormattedText';

export const ENTITY_CLASS_BY_NODE_NAME: Record<string, ApiMessageEntityTypes> = {
  B: ApiMessageEntityTypes.Bold,
  STRONG: ApiMessageEntityTypes.Bold,
  I: ApiMessageEntityTypes.Italic,
  EM: ApiMessageEntityTypes.Italic,
  INS: ApiMessageEntityTypes.Underline,
  U: ApiMessageEntityTypes.Underline,
  S: ApiMessageEntityTypes.Strike,
  STRIKE: ApiMessageEntityTypes.Strike,
  DEL: ApiMessageEntityTypes.Strike,
  CODE: ApiMessageEntityTypes.Code,
  PRE: ApiMessageEntityTypes.Pre,
  BLOCKQUOTE: ApiMessageEntityTypes.Blockquote,
};

// Simple sanitize: allow only basic markdown HTML tags, strip others and attributes
function sanitizeHtml(input: string): string {
  const allowedTags = ['b', 'strong', 'i', 'em', 'ins', 'u', 's', 'strike', 'del', 'code', 'pre', 'blockquote'];
  // remove <script> and <style> blocks
  let output = input.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  // strip disallowed tags and attributes
  output = output.replace(/<(\/)?([a-z][a-z0-9]*)(\s[^>]*)?>/gi,
    (_match, slash, tagName) => {
      const tn = tagName.toLowerCase();
      return allowedTags.includes(tn) ? `<${slash || ''}${tn}>` : '';
    });
  return output;
}

export default function parseHtmlAsFormattedText(
  html: string, caller: string,
): ApiFormattedText {
  // Sanitize input HTML
  // const safeHtml = sanitizeHtml(html);
  const safeHtml = html;
  if (process.env.NODE_ENV === 'development') {
    console.log('WILL PARSE LENGTH:', safeHtml.length, 'CALLER:', caller);
  }
  const res = parseMarkdownHtmlToEntities(safeHtml);
  if (process.env.NODE_ENV === 'development') {
    console.log('parseHtmlAsFormattedText took', performance.now() - (performance.now() || 0));
  }
  return res;
}

export const parseHtmlAsFormattedTextWithCursorSelection = (
  html: string,
  cursorSelection: { start: number; end: number },
): ReturnType<typeof parseMarkdownHtmlToEntitiesWithCursorSelection> => {
  const safeHtml = sanitizeHtml(html);
  return parseMarkdownHtmlToEntitiesWithCursorSelection(safeHtml, cursorSelection);
};

export function fixImageContent(fragment: HTMLDivElement) {
  fragment.querySelectorAll('img').forEach((node) => {
    if (node.dataset.documentId) { // Custom Emoji
      node.textContent = (node as HTMLImageElement).alt || '';
    } else { // Regular emoji with image fallback
      node.replaceWith(node.alt || '');
    }
  });
}
