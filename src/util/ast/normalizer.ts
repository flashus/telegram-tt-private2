// import type { Token } from './token';

// import { TokenType } from './astEnums';

// // A set of token types that represent markdown markers we want to “lift”
// const MARKDOWN_MARKER_TYPES = new Set([
//   TokenType.BOLD_MARKER,
//   TokenType.ITALIC_MARKER,
//   TokenType.STRIKE_MARKER,
//   TokenType.UNDERLINE_MARKER,
//   TokenType.SPOILER_MARKER,
//   TokenType.QUOTE_MARKER,
//   TokenType.CODE_MARKER,
// ]);

// function isMarkdownMarker(token: Token): boolean {
//   return MARKDOWN_MARKER_TYPES.has(token.type);
// }

// /**
//  * Given an array of tokens and a start index at an opening HTML tag,
//  * try to find the matching closing HTML tag with the same tagName.
//  * This helper handles nested HTML tags with the same name.
//  * Returns the index of the matching closing tag or -1 if not found.
//  */
// function findClosingHtmlTag(tokens: Token[], startIndex: number, tagName: string): number {
//   let count = 0;
//   for (let i = startIndex; i < tokens.length; i++) {
//     const t = tokens[i];
//     if (
//       t.type === TokenType.HTML_TAG
//       && t.attributes
//       && t.attributes.tagName?.toLowerCase() === tagName
//     ) {
//       if (!t.attributes.isClosing && !t.attributes.isSelfClosing) {
//         count++;
//       } else if (t.attributes.isClosing) {
//         count--;
//         if (count === 0) {
//           return i;
//         }
//       }
//     }
//   }
//   return -1; // matching closing tag not found
// }

// /**
//  * Process boundary markers for an array of tokens.
//  *
//  * If processing the front boundary (fromFront === true), while the first token is a markdown marker,
//  * check if a matching marker appears later in the block. If not, remove it (to be lifted out).
//  * Similarly for the back boundary.
//  *
//  * Returns an object containing:
//  *   - moved: the tokens that were removed from the boundary,
//  *   - remaining: the tokens that remain inside the block.
//  *
//  * (Markers that are part of a complete pair remain untouched.)
//  */
// function processBoundary(tokens: Token[], fromFront: boolean): { moved: Token[]; remaining: Token[] } {
//   const moved: Token[] = [];
//   if (fromFront) {
//     while (tokens.length > 0 && isMarkdownMarker(tokens[0])) {
//       const marker = tokens[0];
//       // Check if a matching marker appears later in the block.
//       const hasPair = tokens.slice(1).some((t) => t.type === marker.type);
//       if (!hasPair) {
//         moved.push(tokens.shift()!);
//       } else {
//         break;
//       }
//     }
//   } else {
//     while (tokens.length > 0 && isMarkdownMarker(tokens[tokens.length - 1])) {
//       const marker = tokens[tokens.length - 1];
//       const hasPair = tokens.slice(0, tokens.length - 1).some((t) => t.type === marker.type);
//       if (!hasPair) {
//         moved.unshift(tokens.pop()!);
//       } else {
//         break;
//       }
//     }
//   }
//   return { moved, remaining: tokens };
// }

// /**
//  * Recursively normalize a token stream so that markdown markers that
//  * “leak” across HTML boundaries are repositioned.
//  *
//  * For each complete HTML block (an opening tag with its matching closing tag),
//  * we recursively normalize its content. Then we examine the tokens at the very
//  * start and end of that block. If a markdown marker at the boundary is unbalanced
//  * within that block (i.e. its matching marker is outside), we remove it from the block
//  * and insert it before (or after) the HTML block.
//  *
//  * This handles cases like:
//  *
//  *    <i>**Settings</i> … **
//  *
//  * so that the output becomes:
//  *
//  *    **<i>Settings</i> … **
//  */
// export function normalizeTokens(tokens: Token[]): Token[] {
//   const normalized: Token[] = [];
//   let i = 0;

//   while (i < tokens.length) {
//     const token = tokens[i];

//     // If this token is an opening HTML tag (and not self-closing)…
//     if (
//       token.type === TokenType.HTML_TAG
//       && token.attributes
//       && !token.attributes.isClosing
//       && !token.attributes.isSelfClosing
//       && token.attributes.tagName
//     ) {
//       const tagName = token.attributes.tagName.toLowerCase();
//       const closingIndex = findClosingHtmlTag(tokens, i, tagName);
//       if (closingIndex !== -1) {
//         // Found a complete HTML block.
//         const htmlOpeningToken = token;
//         const htmlClosingToken = tokens[closingIndex];

//         // Extract the tokens inside the HTML block.
//         const contentTokens = tokens.slice(i + 1, closingIndex);
//         // Recursively normalize the inner tokens.
//         const normalizedContent = normalizeTokens(contentTokens);

//         // Process the front boundary of the block.
//         const { moved: frontMarkers, remaining: frontRemaining } = processBoundary([...normalizedContent], true);
//         // Process the back boundary of the block.
//         const { moved: backMarkers, remaining: middleTokens } = processBoundary(frontRemaining, false);

//         // Insert any unbalanced markers lifted from the front BEFORE the HTML block.
//         normalized.push(...frontMarkers);
//         normalized.push(htmlOpeningToken);
//         // Then insert the inner (normalized) tokens.
//         normalized.push(...middleTokens);
//         normalized.push(htmlClosingToken);
//         // Insert any unbalanced markers lifted from the back AFTER the HTML block.
//         normalized.push(...backMarkers);

//         // Skip over this entire HTML block.
//         i = closingIndex + 1;
//         continue;
//       }
//       // If no matching closing tag is found, fall through.
//     }

//     // For non-HTML tokens (or if no matching closing tag), pass the token through.
//     normalized.push(token);
//     i++;
//   }

//   return normalized;
// }

import type { Token } from './token';

import { TokenType } from './astEnums';

type TIntermediateToken = Token & { isClosing?: boolean; isStyleToken?: boolean };

const MARKDOWN_TO_HTML_TAG: Record<
| TokenType.BOLD_MARKER
| TokenType.ITALIC_MARKER
| TokenType.STRIKE_MARKER
| TokenType.UNDERLINE_MARKER
| TokenType.SPOILER_MARKER,
string
> = {
  [TokenType.BOLD_MARKER]: 'b',
  [TokenType.ITALIC_MARKER]: 'i',
  [TokenType.STRIKE_MARKER]: 's',
  [TokenType.UNDERLINE_MARKER]: 'u',
  [TokenType.SPOILER_MARKER]: 'span',
};

const markdownToHtmlTag = (
  tagEquivalent: typeof MARKDOWN_TO_HTML_TAG[keyof typeof MARKDOWN_TO_HTML_TAG],
  value: string,
  isClosing: boolean,
  start: number,
  end: number,
) => {
  return {
    type: TokenType.HTML_TAG,
    value,
    start,
    end,
    attributes: {
      tagName: tagEquivalent,
      isClosing,
      isSelfClosing: false,
      attributes: [],
      endPos: end,
    },
  };
};

const HTML_TAG_TO_MARKDOWN: Record<string, TokenType> = {
  b: TokenType.BOLD_MARKER,
  i: TokenType.ITALIC_MARKER,
  s: TokenType.STRIKE_MARKER,
  u: TokenType.UNDERLINE_MARKER,
  span: TokenType.SPOILER_MARKER,
};

const htmlTagToMarkdown = (
  tagEquivalent: typeof HTML_TAG_TO_MARKDOWN[keyof typeof HTML_TAG_TO_MARKDOWN],
  value: string,
  isClosing: boolean,
  start: number,
  end: number,
) => {
  return {
    type: tagEquivalent,
    isClosing,
    value,
    start,
    end,
  };
};

const STYLE_TAGS = new Set(['span', 'b', 'i', 's', 'u']);

const STYLE_MARKER_TYPES = new Set([
  TokenType.BOLD_MARKER,
  TokenType.ITALIC_MARKER,
  TokenType.STRIKE_MARKER,
  TokenType.UNDERLINE_MARKER,
  TokenType.SPOILER_MARKER,
]);

// Custom-emoji <div> should not be treated as formatting tag boundary
function isCustomEmojiDiv(token: Token): boolean {
  return token.type === TokenType.HTML_TAG
    && token.attributes?.tagName.toLowerCase() === 'div'
    && Array.isArray(token.attributes.attributes)
    && token.attributes.attributes.some((a) => a.key === 'data-entity-type' && a.value === 'MessageEntityCustomEmoji');
}

// A set of token types that represent markdown markers we want to "lift"
const MARKDOWN_MARKER_TYPES = new Set([
  TokenType.BOLD_MARKER,
  TokenType.ITALIC_MARKER,
  TokenType.STRIKE_MARKER,
  TokenType.UNDERLINE_MARKER,
  TokenType.SPOILER_MARKER,
  TokenType.QUOTE_MARKER,
  TokenType.CODE_MARKER,
]);

function isMarkdownToLiftMarker(token: Token): boolean {
  return MARKDOWN_TO_LIFT_MARKER_TYPES.has(token.type);
}

function isStyleMarkdownToken(token: Token): boolean {
  return STYLE_MARKER_TYPES.has(token.type);
}

function isStyleHtmlToken(token: Token): boolean {
  if (!token.attributes) {
    return false;
  }
  return STYLE_TAGS.has(token.attributes.tagName || '');
}

// HTML tags that can be used for formatting and might overlap
const FORMATTING_HTML_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a', 'span',
]);

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
    while (
      tokens.length > 0 && (
        isMarkdownMarker(tokens[0])
        || (tokens[0].type === TokenType.HTML_TAG
          && tokens[0].attributes
          && !tokens[0].attributes.isClosing
          && !tokens[0].attributes.isSelfClosing
          && FORMATTING_HTML_TAGS.has(tokens[0].attributes.tagName.toLowerCase())
          && !isCustomEmojiDiv(tokens[0]))
      )
    ) {
      const marker = tokens[0];
      let hasPair = false;
      if (isMarkdownMarker(marker)) {
        hasPair = tokens.slice(1).some((t) => t.type === marker.type);
      } else {
        const tagName = marker.attributes!.tagName.toLowerCase();
        hasPair = tokens.slice(1).some((t) => t.type === TokenType.HTML_TAG
          && t.attributes?.isClosing
          && t.attributes.tagName.toLowerCase() === tagName);
      }
      if (!hasPair) {
        moved.push(tokens.shift()!);
      } else {
        break;
      }
    }
  } else {
    while (
      tokens.length > 0 && (
        isMarkdownMarker(tokens[tokens.length - 1])
        || (tokens[tokens.length - 1].type === TokenType.HTML_TAG
          && tokens[tokens.length - 1].attributes
          && tokens[tokens.length - 1].attributes?.isClosing
          && !tokens[tokens.length - 1].attributes?.isSelfClosing
          && FORMATTING_HTML_TAGS.has(tokens[tokens.length - 1].attributes!.tagName.toLowerCase()))
      )
    ) {
      const marker = tokens[tokens.length - 1];
      let hasPair = false;
      if (isMarkdownMarker(marker)) {
        hasPair = tokens.slice(0, tokens.length - 1).some((t) => t.type === marker.type);
      } else {
        const tagName = marker.attributes!.tagName.toLowerCase();
        hasPair = tokens.slice(0, tokens.length - 1).some((t) => t.type === TokenType.HTML_TAG
          && !t.attributes?.isClosing
          && !t.attributes?.isSelfClosing
          && t.attributes?.tagName.toLowerCase() === tagName);
      }
      if (!hasPair) {
        moved.unshift(tokens.pop()!);
      } else {
        break;
      }
    }
  }
  return { moved, remaining: tokens };
}

// Extracted helper: detect code and pre/code HTML regions
function detectCodeRegions(tokens: Token[]): { start: number; end: number }[] {
  const regions: { start: number; end: number }[] = [];
  let inBlock = false; let blockStart = -1;
  let inInline = false; let inlineStart = -1;
  let inCodeTag = false; let codeTagStart = -1;
  let inPreTag = false; let preTagStart = -1;

  tokens.forEach((tok, i) => {
    if (tok.type === TokenType.CODE_BLOCK && tok.value === '```') {
      if (!inBlock) {
        inBlock = true; blockStart = i;
      } else {
        inBlock = false; regions.push({ start: blockStart, end: i });
      }
    } else if (tok.type === TokenType.CODE_MARKER && tok.value === '`') {
      if (!inInline) {
        inInline = true; inlineStart = i;
      } else {
        inInline = false; regions.push({ start: inlineStart, end: i });
      }
    } else if (tok.type === TokenType.HTML_TAG && tok.attributes) {
      const name = tok.attributes.tagName?.toLowerCase();
      const opening = !tok.attributes.isClosing && !tok.attributes.isSelfClosing;
      const closing = tok.attributes.isClosing;
      if (name === 'code') {
        if (opening) {
          inCodeTag = true; codeTagStart = i;
        } else if (closing && inCodeTag) {
          inCodeTag = false; regions.push({ start: codeTagStart, end: i });
        }
      } else if (name === 'pre') {
        if (opening) {
          inPreTag = true; preTagStart = i;
        } else if (closing && inPreTag) {
          inPreTag = false; regions.push({ start: preTagStart, end: i });
        }
      }
    }
  });
  if (inBlock) regions.push({ start: blockStart, end: tokens.length - 1 });
  if (inInline) regions.push({ start: inlineStart, end: tokens.length - 1 });
  if (inCodeTag) regions.push({ start: codeTagStart, end: tokens.length - 1 });
  if (inPreTag) regions.push({ start: preTagStart, end: tokens.length - 1 });
  return regions;
}

/**
 * Helper function to create a basic closing tag token from an opening tag token.
 * Note: Position information (start/end) will need adjustment based on context.
 */
function createClosingTag(openTagToken: Token): Token {
  if (!openTagToken.attributes) {
    // Should not happen for valid HTML tags, but handle defensively
    return {
      type: TokenType.TEXT, value: '', start: openTagToken.end, end: openTagToken.end,
    };
  }
  const { tagName } = openTagToken.attributes;
  const value = `</${tagName}>`;
  // Initial position is set to follow the open tag, but might be inaccurate
  // The balancing logic should place it correctly.
  const start = openTagToken.end;
  const end = start + value.length;
  return {
    type: TokenType.HTML_TAG,
    value,
    start,
    end,
    attributes: {
      tagName,
      attributes: [],
      isClosing: true,
      isSelfClosing: false,
      endPos: end,
    },
  };
}

function balanceHtmlMdTags(tokens: Token[], isInCodeRegion: (pos: number) => boolean): Token[] {
  type StackEntry = { type: 'html' | 'md'; tagName?: string; markerType?: TokenType; token: Token };
  const stack: StackEntry[] = [];
  const result: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (isInCodeRegion(i)) {
      result.push(token);
      continue;
    }
    // mid-line '>' is not a blockquote: emit as text
    if (token.type === TokenType.QUOTE_MARKER
      && !(
        i === 0
        || tokens[i - 1].type === TokenType.NEWLINE
        || tokens[i - 1].type === TokenType.QUOTE_MARKER)) {
      result.push({
        type: TokenType.TEXT, value: token.value, start: token.start, end: token.end,
      });
      continue;
    }
    // On encountering a blockquote marker, break open MD/HTML tags around it
    if (token.type === TokenType.QUOTE_MARKER) {
      // handle newline before quote as a unit: pop and reinsert around closures
      let newlineTok: Token | undefined;
      if (result.length > 0 && (result[result.length - 1].type === TokenType.NEWLINE
          || (result[result.length - 1].type === TokenType.TEXT && result[result.length - 1].value === '\n'))) {
        newlineTok = result.pop();
      }
      const savedStack = [...stack];
      // close all open tags and markers before newline+quote
      for (let k = stack.length - 1; k >= 0; k--) {
        const ent = stack[k];
        if (ent.type === 'html') {
          result.push(createClosingTag(ent.token));
        } else {
          result.push(ent.token);
        }
      }
      // reinsert newline before emitting quote
      if (newlineTok) {
        result.push(newlineTok);
      }
      // emit quote marker and reopen markers
      result.push(token);
      for (const ent of savedStack) {
        result.push(ent.token);
      }
      continue;
    }
    // Markdown marker
    if (isMarkdownMarker(token)) {
      const mType = token.type;
      let matchIdx = -1;
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].type === 'md' && stack[j].markerType === mType) { matchIdx = j; break; }
      }
      if (matchIdx !== -1) {
        const overlap = stack.slice(matchIdx + 1);
        // Special-case: a single markdown marker overlaps this HTML boundary and its closing marker follows
        if (overlap.length === 1 && overlap[0].type === 'md' && tokens[i + 1]?.type === overlap[0].markerType) {
          // Remove both HTML and markdown entries from stack
          stack.splice(matchIdx, overlap.length + 1);
          // Emit the closing markdown marker before closing the HTML tag
          result.push(tokens[i + 1]);
          // Emit the HTML closing tag
          result.push(token);
          // Skip the upcoming markdown closing marker
          i++;
          continue;
        }
        // Close overlap
        for (let k = overlap.length - 1; k >= 0; k--) {
          const ent = overlap[k];
          if (ent.type === 'html') {
            result.push(createClosingTag(ent.token));
          } else {
            result.push(ent.token);
          }
        }
        // Close current md marker
        result.push(token);
        // Pop matched and overlap
        stack.splice(matchIdx);
        // Reopen overlap
        for (const ent of overlap) {
          result.push(ent.token);
          stack.push(ent);
        }
      } else {
        // Opening md marker
        stack.push({ type: 'md', markerType: mType, token });
        result.push(token);
      }
      continue;
    }
    // HTML formatting tag
    if (
      token.type === TokenType.HTML_TAG
      && token.attributes
      && FORMATTING_HTML_TAGS.has(token.attributes.tagName.toLowerCase())
    ) {
      const tagName = token.attributes.tagName.toLowerCase();
      if (token.attributes.isSelfClosing) {
        result.push(token);
      } else if (!token.attributes.isClosing) {
        // Opening HTML tag
        stack.push({ type: 'html', tagName, token });
        result.push(token);
      } else {
        // Closing HTML tag
        let matchIdx = -1;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].type === 'html' && stack[j].tagName === tagName) { matchIdx = j; break; }
        }
        if (matchIdx !== -1) {
          const overlap = stack.slice(matchIdx + 1);
          // Special-case: a single markdown marker overlaps this HTML boundary and its closing marker follows
          if (overlap.length === 1 && overlap[0].type === 'md' && tokens[i + 1]?.type === overlap[0].markerType) {
            // Remove both HTML and markdown entries from stack
            stack.splice(matchIdx, overlap.length + 1);
            // Emit the closing markdown marker before closing the HTML tag
            result.push(tokens[i + 1]);
            // Emit the HTML closing tag
            result.push(token);
            // Skip the upcoming markdown closing marker
            i++;
            continue;
          }
          // Close overlapping entries
          for (let k = overlap.length - 1; k >= 0; k--) {
            const ent = overlap[k];
            if (ent.type === 'html') {
              result.push(createClosingTag(ent.token));
            } else {
              result.push(ent.token);
            }
          }
          // Close tag
          result.push(token);
          // Pop matched and overlap
          stack.splice(matchIdx);
          // Reopen overlap
          for (const ent of overlap) {
            result.push(ent.token);
            stack.push(ent);
          }
        } else {
          // Unmatched closing HTML tag -> text
          result.push({
            type: TokenType.TEXT, value: token.value, start: token.start, end: token.end,
          });
        }
      }
      continue;
    }
    // Treat <div> as block boundary: close and reopen all open tags/markers
    if (token.type === TokenType.HTML_TAG
      && token.attributes?.tagName.toLowerCase() === 'div'
      && !token.attributes.isSelfClosing
    ) {
      const savedStack = [...stack];
      // close all open entries
      for (let k = stack.length - 1; k >= 0; k--) {
        const ent = stack[k];
        if (ent.type === 'html') {
          result.push(createClosingTag(ent.token));
        } else {
          result.push(ent.token);
        }
      }
      // emit the div tag
      result.push(token);
      // reopen saved entries
      for (const ent of savedStack) {
        result.push(ent.token);
      }
      continue;
    }
    // Other tokens
    result.push(token);
  }
  // Close any remaining open entries (only HTML tags; drop unmatched markdown markers)
  for (let j = stack.length - 1; j >= 0; j--) {
    const ent = stack[j];
    if (ent.type === 'html') {
      // generate closing tag for unmatched HTML
      result.push(createClosingTag(ent.token));
    }
    // skip unmatched markdown markers (treated as plain text)
  }
  return result;
}

/**
 * Recursively normalize a token stream so that markdown markers and HTML tags that
 * "leak" across HTML boundaries are repositioned.
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
 *
 * It also handles overlapping HTML tags like:
 *
 *    <b>boldtxt<i>bolt_it</b>just italic</i>
 *
 * which becomes:
 *
 *    <b>boldtxt<i>bolt_it</i></b><i>just italic</i>
 */
export function normalizeTokens(tokens: Token[]): Token[] {
  // unwrap plain <div>…</div> pairs into newline + content, depth-aware
  tokens = (() => {
    const out: Token[] = [];
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (
        tok.type === TokenType.HTML_TAG
        && tok.attributes?.tagName.toLowerCase() === 'div'
        && !tok.attributes.isClosing
        && Array.isArray(tok.attributes.attributes)
        && tok.attributes.attributes.length === 0
      ) {
        // found plain <div> open
        let depth = 1;
        const inner: Token[] = [];
        let j = i + 1;
        for (; j < tokens.length; j++) {
          const t2 = tokens[j];
          if (
            t2.type === TokenType.HTML_TAG
            && t2.attributes?.tagName.toLowerCase() === 'div'
          ) {
            if (t2.attributes.isClosing) {
              depth--;
              if (depth === 0) { j++; break; } // skip this closing
            } else {
              depth++;
            }
            inner.push(t2);
          } else {
            inner.push(t2);
          }
        }
        // emit newline + inner tokens, skip wrapper tags
        out.push({ type: TokenType.NEWLINE, value: '\n', start: tok.start, end: tok.end });
        out.push(...inner);
        i = j;
        continue;
      }
      out.push(tok);
      i++;
    }
    return out;
  })();

  // Only convert singleton paired markdown markers (** __ ++ ~~ etc.) to plain text
  const PAIR_MARKER_TYPES = new Set<TokenType>([
    TokenType.BOLD_MARKER,
    TokenType.ITALIC_MARKER,
    TokenType.STRIKE_MARKER,
    TokenType.UNDERLINE_MARKER,
    TokenType.SPOILER_MARKER,
    TokenType.CODE_MARKER,
  ]);
  const markerCounts: Partial<Record<TokenType, number>> = {};
  tokens.forEach((tok) => {
    if (PAIR_MARKER_TYPES.has(tok.type)) {
      markerCounts[tok.type] = (markerCounts[tok.type] || 0) + 1;
    }
  });
  const filteredTokens = tokens.map((tok) => (PAIR_MARKER_TYPES.has(tok.type) && markerCounts[tok.type] === 1
    ? {
      type: TokenType.TEXT, value: tok.value, start: tok.start, end: tok.end, attributes: tok.attributes,
    }
    : tok));

  // 1. Lift unpaired markdown & HTML tags from block boundaries
  const { moved: frontMarkers, remaining: afterFront } = processBoundary([...filteredTokens], true);
  const { moved: backMarkers, remaining: coreTokens } = processBoundary(afterFront, false);

  // 2. Identify code regions within core content
  const codeRegions = detectCodeRegions(coreTokens);
  const isInCodeRegion = (pos: number) => codeRegions.some((r) => pos >= r.start && pos <= r.end)
    || coreTokens[pos]?.attributes?.isCodeContent === true;

  // 3. Balance interleaved HTML tags and markdown markers in core
  const balanced = balanceHtmlMdTags(coreTokens, isInCodeRegion);

  // 4. Reassemble with lifted boundary markers
  return [...frontMarkers, ...balanced, ...backMarkers];
}
