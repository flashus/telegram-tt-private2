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

const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'ins', 'u', 's', 'strike', 'del', 'code', 'pre', 'blockquote'];
const SANITIZE_SCRIPT_REGEX = /<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const SANITIZE_TAGS_REGEX = /<(\/)?([a-z][a-z0-9]*)(\s[^>]*)?>/gi;

// Simple sanitize: allow only basic markdown HTML tags, strip others and attributes
function sanitizeHtml(input: string): string {
  // remove <script> and <style> blocks
  let output = input.replace(SANITIZE_SCRIPT_REGEX, '');
  // strip disallowed tags and attributes
  output = output.replace(SANITIZE_TAGS_REGEX,
    (_match, slash, tagName) => {
      const tn = tagName.toLowerCase();
      return ALLOWED_TAGS.includes(tn) ? `<${slash || ''}${tn}>` : '';
    });
  return output;
}

export default function parseHtmlAsFormattedText(
  html: string, caller: string,
): ApiFormattedText {
  // Sanitize input HTML
  // const safeHtml = sanitizeHtml(html);
  const safeHtml = html;

  // TODO !!!! remove all logs. process check unnecessary - no console is allowed in prod
  console.log('WILL PARSE LENGTH:', safeHtml.length, 'CALLER:', caller);
  const res = parseMarkdownHtmlToEntities(safeHtml);
  return res;
  // return parseMarkdownHtmlToEntities(safeHtml);
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
