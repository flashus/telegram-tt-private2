import type { Token } from './token';

import { TokenType } from './astEnums';

// A set of token types that represent markdown markers we want to “lift”
const MARKDOWN_MARKER_TYPES = new Set([
  TokenType.BOLD_MARKER,
  TokenType.ITALIC_MARKER,
  TokenType.STRIKE_MARKER,
  TokenType.UNDERLINE_MARKER,
  TokenType.SPOILER_MARKER,
  TokenType.QUOTE_MARKER,
  TokenType.CODE_MARKER,
]);

function isMarkdownMarker(token: Token): boolean {
  return MARKDOWN_MARKER_TYPES.has(token.type);
}

/**
 * Given an array of tokens and a start index at an opening HTML tag,
 * try to find the matching closing HTML tag with the same tagName.
 * This helper handles nested HTML tags with the same name.
 * Returns the index of the matching closing tag or -1 if not found.
 */
function findClosingHtmlTag(tokens: Token[], startIndex: number, tagName: string): number {
  let count = 0;
  for (let i = startIndex; i < tokens.length; i++) {
    const t = tokens[i];
    if (
      t.type === TokenType.HTML_TAG
      && t.attributes
      && t.attributes.tagName?.toLowerCase() === tagName
    ) {
      if (!t.attributes.isClosing && !t.attributes.isSelfClosing) {
        count++;
      } else if (t.attributes.isClosing) {
        count--;
        if (count === 0) {
          return i;
        }
      }
    }
  }
  return -1; // matching closing tag not found
}

/**
 * Process boundary markers for an array of tokens.
 *
 * If processing the front boundary (fromFront === true), while the first token is a markdown marker,
 * check if a matching marker appears later in the block. If not, remove it (to be lifted out).
 * Similarly for the back boundary.
 *
 * Returns an object containing:
 *   - moved: the tokens that were removed from the boundary,
 *   - remaining: the tokens that remain inside the block.
 *
 * (Markers that are part of a complete pair remain untouched.)
 */
function processBoundary(tokens: Token[], fromFront: boolean): { moved: Token[]; remaining: Token[] } {
  const moved: Token[] = [];
  if (fromFront) {
    while (tokens.length > 0 && isMarkdownMarker(tokens[0])) {
      const marker = tokens[0];
      // Check if a matching marker appears later in the block.
      const hasPair = tokens.slice(1).some((t) => t.type === marker.type);
      if (!hasPair) {
        moved.push(tokens.shift()!);
      } else {
        break;
      }
    }
  } else {
    while (tokens.length > 0 && isMarkdownMarker(tokens[tokens.length - 1])) {
      const marker = tokens[tokens.length - 1];
      const hasPair = tokens.slice(0, tokens.length - 1).some((t) => t.type === marker.type);
      if (!hasPair) {
        moved.unshift(tokens.pop()!);
      } else {
        break;
      }
    }
  }
  return { moved, remaining: tokens };
}

/**
 * Recursively normalize a token stream so that markdown markers that
 * “leak” across HTML boundaries are repositioned.
 *
 * For each complete HTML block (an opening tag with its matching closing tag),
 * we recursively normalize its content. Then we examine the tokens at the very
 * start and end of that block. If a markdown marker at the boundary is unbalanced
 * within that block (i.e. its matching marker is outside), we remove it from the block
 * and insert it before (or after) the HTML block.
 *
 * This handles cases like:
 *
 *    <i>**Settings</i> … **
 *
 * so that the output becomes:
 *
 *    **<i>Settings</i> … **
 */
export function normalizeTokens(tokens: Token[]): Token[] {
  const normalized: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // If this token is an opening HTML tag (and not self-closing)…
    if (
      token.type === TokenType.HTML_TAG
      && token.attributes
      && !token.attributes.isClosing
      && !token.attributes.isSelfClosing
      && token.attributes.tagName
    ) {
      const tagName = token.attributes.tagName.toLowerCase();
      const closingIndex = findClosingHtmlTag(tokens, i, tagName);
      if (closingIndex !== -1) {
        // Found a complete HTML block.
        const htmlOpeningToken = token;
        const htmlClosingToken = tokens[closingIndex];

        // Extract the tokens inside the HTML block.
        const contentTokens = tokens.slice(i + 1, closingIndex);
        // Recursively normalize the inner tokens.
        const normalizedContent = normalizeTokens(contentTokens);

        // Process the front boundary of the block.
        const { moved: frontMarkers, remaining: frontRemaining } = processBoundary([...normalizedContent], true);
        // Process the back boundary of the block.
        const { moved: backMarkers, remaining: middleTokens } = processBoundary(frontRemaining, false);

        // Insert any unbalanced markers lifted from the front BEFORE the HTML block.
        normalized.push(...frontMarkers);
        normalized.push(htmlOpeningToken);
        // Then insert the inner (normalized) tokens.
        normalized.push(...middleTokens);
        normalized.push(htmlClosingToken);
        // Insert any unbalanced markers lifted from the back AFTER the HTML block.
        normalized.push(...backMarkers);

        // Skip over this entire HTML block.
        i = closingIndex + 1;
        continue;
      }
      // If no matching closing tag is found, fall through.
    }

    // For non-HTML tokens (or if no matching closing tag), pass the token through.
    normalized.push(token);
    i++;
  }

  return normalized;
}
