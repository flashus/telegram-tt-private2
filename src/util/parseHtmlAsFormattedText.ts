import type { ApiFormattedText } from '../api/types';
import { ApiMessageEntityTypes } from '../api/types';

import { parseMarkdownHtmlToEntities } from './ast/parseMdAsFormattedText';

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

export default function parseHtmlAsFormattedText(
  html: string, caller: string,
): ApiFormattedText {
  const now = performance.now();
  console.log('WILL PARSE THIS MUCH: ', html.length);
  console.log('CALLER: ', caller);
  const res = parseMarkdownHtmlToEntities(html);
  console.log('parseHtmlAsFormattedText', performance.now() - now);

  return res;
  // return parseMarkdownHtmlToEntities(html);
}

export function fixImageContent(fragment: HTMLDivElement) {
  fragment.querySelectorAll('img').forEach((node) => {
    if (node.dataset.documentId) { // Custom Emoji
      node.textContent = (node as HTMLImageElement).alt || '';
    } else { // Regular emoji with image fallback
      node.replaceWith(node.alt || '');
    }
  });
}
