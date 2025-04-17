import type { Token } from './token';

import { TokenType } from './astEnums';

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

function isMarkdownMarker(token: Token): boolean {
  return MARKDOWN_MARKER_TYPES.has(token.type);
}

// HTML tags that can be used for formatting and might overlap
const FORMATTING_HTML_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a', 'span',
]);

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
 * Detects and fixes overlapping HTML formatting tags.
 *
 * This function scans the tokens inside an HTML block for any opening HTML formatting tags
 * that don't have matching closing tags within the block. For each such tag, it:
 * 1. Inserts a closing tag just before the outer HTML block's closing tag
 * 2. Inserts a corresponding opening tag right after the outer HTML block
 *
 * This handles cases like:
 *    <b>boldtxt<i>bolt_it</b>just italic</i>
 *
 * which becomes:
 *    <b>boldtxt<i>bolt_it</i></b><i>just italic</i>
 */
function fixOverlappingHtmlTags(
  innerTokens: Token[],
  outerClosingToken: Token,
): { fixedInnerTokens: Token[]; continuationTokens: Token[] } {
  const openTags: Token[] = [];
  const continuationTokens: Token[] = [];

  // Scan for opening tags without matching closing tags
  for (let i = 0; i < innerTokens.length; i++) {
    const token = innerTokens[i];

    if (
      token.type === TokenType.HTML_TAG
      && token.attributes
      && token.attributes.tagName
      && FORMATTING_HTML_TAGS.has(token.attributes.tagName.toLowerCase())
    ) {
      if (token.attributes.isClosing === false && token.attributes.isSelfClosing === false) {
        // Found an opening tag, push it onto our stack
        openTags.push(token);
      } else if (token.attributes.isClosing === true) {
        // Found a closing tag, remove the matching opening tag from our stack
        for (let j = openTags.length - 1; j >= 0; j--) {
          if (
            openTags[j].attributes
            && openTags[j].attributes?.tagName
            && token.attributes.tagName
            && openTags[j].attributes?.tagName.toLowerCase() === token.attributes.tagName.toLowerCase()
          ) {
            openTags.splice(j, 1);
            break;
          }
        }
      }
    }
  }

  // If we have unclosed tags, create closing tags for them
  if (openTags.length > 0) {
    const fixedInnerTokens = [...innerTokens];

    // Create closing tags in reverse order (to properly nest them)
    for (let i = openTags.length - 1; i >= 0; i--) {
      const openTag = openTags[i];
      if (!openTag.attributes || !openTag.attributes.tagName) continue;

      // Create a closing tag to insert before the outer closing tag
      fixedInnerTokens.push({
        type: TokenType.HTML_TAG,
        value: `</${openTag.attributes.tagName}>`,
        start: outerClosingToken.start,
        end: outerClosingToken.start + `</${openTag.attributes.tagName}>`.length,
        attributes: {
          tagName: openTag.attributes.tagName,
          attributes: [],
          isClosing: true,
          isSelfClosing: false,
          endPos: outerClosingToken.start + `</${openTag.attributes.tagName}>`.length,
        },
      });

      // Create an opening tag to continue after the outer block
      const continuationTag: Token = {
        type: TokenType.HTML_TAG,
        value: `<${openTag.attributes.tagName}>`,
        start: outerClosingToken.end,
        end: outerClosingToken.end + `<${openTag.attributes.tagName}>`.length,
        attributes: {
          tagName: openTag.attributes.tagName,
          attributes: [],
          isClosing: false,
          isSelfClosing: false,
          endPos: outerClosingToken.end + `<${openTag.attributes.tagName}>`.length,
        },
      };

      // Add to our continuation tokens (in original order)
      continuationTokens.unshift(continuationTag);
    }

    return { fixedInnerTokens, continuationTokens };
  }

  return { fixedInnerTokens: innerTokens, continuationTokens: [] };
}

/**
 * Pre-process markdown tokens to properly handle overlapping markers of different types.
 * This handles complex overlapping cases like:
 * 1. Pure markdown overlaps: **bold_text**plain text__italic-pretend**bold_text__bold_text_pretend_italic**
 * 2. Markdown-HTML overlaps: __italic-pretend<b>bold_text__bold_text_pretend_italic</b>
 */
function processOverlaps(tokens: Token[]): Token[] {
  const htmlOnlyTokens = preprocessMarkdownTokens(tokens);
  const balancedTokens = balanceHtmlTags(htmlOnlyTokens);
  return balancedTokens;
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

// Extracted helper: handle quote blocks (first pass)
function handleQuoteBlocks(tokens: Token[], isInCodeRegion: (pos: number) => boolean): Token[] {
  const result = [...tokens];
  let inQuote = false; let
    level = 0;
  for (let i = 0; i < result.length;) {
    if (isInCodeRegion(i)) { i++; continue; }
    const tok = result[i];

    // Check for quote markers
    const isQuoteMarker = tok.type === TokenType.QUOTE_MARKER && tok.value === '>';
    const isNewline = tok.type === TokenType.NEWLINE || (tok.type === TokenType.TEXT && tok.value === '\n');
    const isPrevNewline = i > 0 && (result[i - 1].type === TokenType.NEWLINE
      || (result[i - 1].type === TokenType.TEXT && result[i - 1].value === '\n'));
    const isStartOfStream = i === 0;
    const isEOF = tok.type === TokenType.EOF;

    // Mid-text quote marker, convert it to &gt; text - must be checked first
    if (isQuoteMarker && i > 0 && result[i - 1].type !== TokenType.NEWLINE) {
      // Check for consecutive quote markers
      let consecutiveMarkers = 1;
      let j = i + 1;
      while (j < result.length && result[j].type === TokenType.QUOTE_MARKER && result[j].value === '>') {
        consecutiveMarkers++;
        j++;
      }

      // Convert this marker to text with proper HTML entity
      tok.type = TokenType.TEXT;
      tok.value = '>';

      // If there are consecutive markers, handle them too
      if (consecutiveMarkers > 1) {
        // Process consecutive markers
        for (let k = 1; k < consecutiveMarkers; k++) {
          const nextToken = result[i + k];
          nextToken.type = TokenType.TEXT;
          nextToken.value = '>';
        }
        // Skip past the consecutive markers we just processed
        i += consecutiveMarkers;
      } else {
        i++;
      }
      continue;
    }

    // Treat non-formatting HTML tags as boundaries: close any open quote blocks before HTML tag
    if (inQuote && tok.type === TokenType.HTML_TAG && tok.attributes && tok.attributes.tagName) {
      const lowerTag = tok.attributes.tagName.toLowerCase();
      if (!FORMATTING_HTML_TAGS.has(lowerTag) && lowerTag !== 'blockquote') {
        // close current quote block
        for (let lvl = 0; lvl < level; lvl++) {
          const closeVal = '</blockquote>';
          const closeTag: Token = {
            type: TokenType.HTML_TAG,
            value: closeVal,
            start: tok.start,
            end: tok.start + closeVal.length,
            attributes: {
              tagName: 'blockquote',
              attributes: [],
              isClosing: true,
              isSelfClosing: false,
              endPos: tok.start + closeVal.length,
            },
          };
          result.splice(i, 0, closeTag);
          i++;
        }
        inQuote = false;
        level = 0;
        continue;
      }
    }

    // Count consecutive quote markers for nesting level
    let currentNestingLevel = 0;
    if (isQuoteMarker) {
      // Only count consecutive markers if they're at the start of a line
      // (i.e., after a newline or at the start of the stream)
      if (isStartOfStream || isPrevNewline) {
        currentNestingLevel = 1;
        let j = i + 1;
        while (j < result.length && result[j].type === TokenType.QUOTE_MARKER && result[j].value === '>') {
          currentNestingLevel++;
          j++;
        }
      } else {
        // Mid-text quote marker, treat as a single level (not nested)
        currentNestingLevel = 1;
      }
    }

    // Start or continue a quote block
    if (isQuoteMarker && (isStartOfStream || isPrevNewline || inQuote)) {
      // If already in a quote, check for nesting level changes
      if (inQuote) {
        if (currentNestingLevel > level) {
          // Deeper nesting level - add new opening blockquote tags
          for (let lvl = level; lvl < currentNestingLevel; lvl++) {
            // Create an opening blockquote HTML tag
            const openTag: Token = {
              type: TokenType.HTML_TAG,
              value: '<blockquote>',
              start: tok.start,
              end: tok.start + 12, // '<blockquote>'.length
              attributes: {
                tagName: 'blockquote',
                attributes: [],
                isClosing: false,
                isSelfClosing: false,
                endPos: tok.start + 12,
              },
            };

            // Insert the opening tag
            result.splice(i, 0, openTag);
            i++;
          }

          // Remove all quote markers
          result.splice(i, currentNestingLevel);

          // Update the nesting level
          level = currentNestingLevel;

          // Don't increment i since we adjusted the array
          continue;
        } else if (currentNestingLevel < level) {
          // We need to check if there's a newline before the marker of the lower level quote
          // If so, we need to move it outside the closing nested blockquote
          let newlineBeforeMarker = false;
          let newlineToken: Token | undefined;

          // Check if the token before the current quote marker is a newline
          if (i > 0 && result[i - 1].type === TokenType.NEWLINE) {
            newlineBeforeMarker = true;
            newlineToken = { ...result[i - 1] };
            // Remove the newline as we'll reinsert it after the closing tags
            result.splice(i - 1, 1);
            i--; // Adjust position after removing newline
          }

          // Coming back to a less nested level
          // Close the deeper levels
          for (let lvl = level; lvl > currentNestingLevel; lvl--) {
            // Create a closing blockquote HTML tag
            const closeTag: Token = {
              type: TokenType.HTML_TAG,
              value: '</blockquote>',
              start: tok.start,
              end: tok.start + 13, // '</blockquote>'.length
              attributes: {
                tagName: 'blockquote',
                attributes: [],
                isClosing: true,
                isSelfClosing: false,
                endPos: tok.start + 13,
              },
            };

            // Insert the closing tag
            result.splice(i, 0, closeTag);
            i++;
          }

          // If we found a newline before the marker, reinsert it after the closing tags
          if (newlineBeforeMarker && newlineToken) {
            result.splice(i, 0, newlineToken);
            i++;
          }

          // Remove all quote markers
          result.splice(i, currentNestingLevel);

          // Update the nesting level
          level = currentNestingLevel;

          // Don't increment i since we adjusted the array
          continue;
        } else {
          // Same nesting level, just remove the quote markers
          result.splice(i, currentNestingLevel);
          // Don't increment i since we removed elements
          continue;
        }
      } else {
        // Starting a new quote block at a specific nesting level
        inQuote = true;
        level = currentNestingLevel;

        // Add opening tags for each nesting level
        for (let lvl = 0; lvl < currentNestingLevel; lvl++) {
          // Create an opening blockquote HTML tag
          const openTag: Token = {
            type: TokenType.HTML_TAG,
            value: '<blockquote>',
            start: tok.start,
            end: tok.start + 12, // '<blockquote>'.length
            attributes: {
              tagName: 'blockquote',
              attributes: [],
              isClosing: false,
              isSelfClosing: false,
              endPos: tok.start + 12,
            },
          };

          // If first level, replace the first marker, otherwise insert
          if (lvl === 0) {
            result[i] = openTag;
          } else {
            result.splice(i + lvl, 0, openTag);
          }
        }

        // Remove remaining quote markers if any (for nesting > 1)
        if (currentNestingLevel > 1) {
          result.splice(i + 1, currentNestingLevel - 1);
        }

        i += 1; // Move past the opening tags
        continue;
      }
    }

    // End a quote block on newline without following '>' or at end of stream
    if (inQuote && (
      (isNewline && (i === result.length - 1
        || (i + 1 < result.length && result[i + 1].type !== TokenType.QUOTE_MARKER)))
      || i === result.length - 1 || isEOF
    )) {
      // End the current quote block
      inQuote = false;

      // If this is a newline token, preserve it and move it outside the blockquote
      if (isNewline) {
        // Store the newline token to reinsert after the closing tags
        const newlineToken = { ...tok };
        newlineToken.type = TokenType.NEWLINE; // Ensure we preserve the token type as NEWLINE, not TEXT

        // Remove the newline token
        result.splice(i, 1);

        // Add closing tags for each nesting level
        for (let lvl = 0; lvl < level; lvl++) {
          // Create a closing blockquote HTML tag
          const closeTag: Token = {
            type: TokenType.HTML_TAG,
            value: '</blockquote>',
            start: tok.start, // Use token.start for position
            end: tok.start + 13, // '</blockquote>'.length
            attributes: {
              tagName: 'blockquote',
              attributes: [],
              isClosing: true,
              isSelfClosing: false,
              endPos: tok.start + 13,
            },
          };

          // Insert the closing tag
          result.splice(i, 0, closeTag);
          i++;
        }

        // Re-insert the newline token after all closing tags
        result.splice(i, 0, newlineToken);
        i++;

        // Reset nesting level
        level = 0;
        continue;
      } else {
        // For non-newline tokens (EOF or end of stream)
      // Add closing tags for each nesting level
        for (let lvl = 0; lvl < level; lvl++) {
          // Create a closing blockquote HTML tag
          const closeTag: Token = {
            type: TokenType.HTML_TAG,
            value: '</blockquote>',
            start: tok.start, // Use token.start for EOF case
            end: tok.start + 13, // '</blockquote>'.length
            attributes: {
              tagName: 'blockquote',
              attributes: [],
              isClosing: true,
              isSelfClosing: false,
              endPos: tok.start + 13,
            },
          };

          // Special handling for EOF - insert closing tag before EOF
          if (isEOF) {
            result.splice(i, 0, closeTag);
            i += 1;
          } else {
            // Insert the closing tag after the current token
            result.splice(i + 1, 0, closeTag);
            i += 2;
          }
        }

        // Reset nesting level
        level = 0;
        continue;
      }
    }

    i++;
  }

  // If we're still in a quote at the end of the stream, close all nesting levels
  if (inQuote && level > 0) {
    // Find the last non-EOF token
    let lastNonEofIndex = result.length - 1;
    while (lastNonEofIndex >= 0 && result[lastNonEofIndex].type === TokenType.EOF) {
      lastNonEofIndex--;
    }

    if (lastNonEofIndex >= 0) {
      const lastToken = result[lastNonEofIndex];

      // Add closing tags for each nesting level
      for (let lvl = 0; lvl < level; lvl++) {
        // Create a closing blockquote HTML tag
        const closeTag: Token = {
          type: TokenType.HTML_TAG,
          value: '</blockquote>',
          start: lastToken.end,
          end: lastToken.end + 13, // '</blockquote>'.length
          attributes: {
            tagName: 'blockquote',
            attributes: [],
            isClosing: true,
            isSelfClosing: false,
            endPos: lastToken.end + 13,
          },
        };

        // Insert before any EOF tokens
        result.splice(lastNonEofIndex + 1, 0, closeTag);
        lastNonEofIndex++;
      }
    }

    // Reset nesting level
    level = 0;
  }

  return result;
}

// Extracted helper: handle other markdown markers (second pass)
function handleMarkdownMarkers(tokens: Token[], isInCodeRegion: (pos: number) => boolean): Token[] {
  const result = [...tokens];
  // Stack to keep track of open markdown markers
  // For each marker we store: token, position, and type
  const markerStack: Array<{ token: Token; position: number; type: TokenType }> = [];

  // Process tokens in order
  for (let i = 0; i < result.length; i++) {
    const token = result[i];

    // Skip tokens in code regions or HTML tags
    if (isInCodeRegion(i) || token.type === TokenType.HTML_TAG) {
      continue;
    }

    // Check if this is a markdown marker
    if (isMarkdownMarker(token)) {
      // Look for matching marker in the stack (most recent of same type)
      let matchIndex = -1;
      for (let j = markerStack.length - 1; j >= 0; j--) {
        if (markerStack[j].type === token.type && markerStack[j].token.value === token.value) {
          matchIndex = j;
          break;
        }
      }

      if (matchIndex !== -1) {
        // Found matching marker - create HTML tags
        const openMarker = markerStack[matchIndex];
        const { openTag, closeTag } = createHtmlTagsForMarker(
          openMarker.token, token, token.type,
        );

        // Replace the opening marker with HTML tag
        result[openMarker.position] = openTag;

        // Replace the closing marker with HTML tag
        result[i] = closeTag;

        // Remove the marker from stack
        markerStack.splice(matchIndex, 1);
      } else {
        // No matching marker found - add to stack
        markerStack.push({
          token,
          position: i,
          type: token.type,
        });
      }
    }
  }

  return result;
}

/**
 * Create HTML tags from markdown markers
 */
function createHtmlTagsForMarker(
  openToken: Token, closeToken: Token, markerType: TokenType,
): { openTag: Token; closeTag: Token } {
  let tagName = '';
  let entityType = '';

  // Determine appropriate HTML tag based on marker type
  switch (markerType) {
    case TokenType.BOLD_MARKER:
      tagName = 'b';
      break;
    case TokenType.ITALIC_MARKER:
      tagName = 'i';
      break;
    case TokenType.STRIKE_MARKER:
      tagName = 's';
      break;
    case TokenType.UNDERLINE_MARKER:
      tagName = 'u';
      break;
    case TokenType.CODE_MARKER:
      tagName = 'code';
      break;
    case TokenType.SPOILER_MARKER:
      tagName = 'span';
      entityType = 'MessageEntitySpoiler';
      break;
  }

  // Create opening tag
  const openTag: Token = {
    type: TokenType.HTML_TAG,
    value: `<${tagName}${entityType ? ` data-entity-type="${entityType}"` : ''}>`,
    start: openToken.start,
    end: openToken.start + tagName.length + 2 + (entityType ? ` data-entity-type="${entityType}"`.length : 0),
    attributes: {
      tagName,
      attributes: entityType ? [{ key: 'data-entity-type', value: entityType }] : [],
      isClosing: false,
      isSelfClosing: false,
      endPos: openToken.start + tagName.length + 2 + (entityType ? ` data-entity-type="${entityType}"`.length : 0),
    },
  };

  // Create closing tag
  const closeTag: Token = {
    type: TokenType.HTML_TAG,
    value: `</${tagName}>`,
    start: closeToken.start,
    end: closeToken.start + tagName.length + 3,
    attributes: {
      tagName,
      attributes: [],
      isClosing: true,
      isSelfClosing: false,
      endPos: closeToken.start + tagName.length + 3,
    },
  };

  return { openTag, closeTag };
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

/**
 * Balance HTML tags using a stack-based approach to fix nesting.
 * Reconstructs the token stream, ensuring proper tag order.
 */
function balanceHtmlTags(tokens: Token[]): Token[] {
  const stack: Array<{ tagName: string; token: Token }> = [];
  const result: Token[] = [];

  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx];

    if (token.type === TokenType.HTML_TAG && token.attributes) {
      const { tagName, isClosing, isSelfClosing } = token.attributes;

      if (isSelfClosing) {
        result.push(token);
        continue;
      }

      // Treat non-formatting HTML tags (e.g., blockquote) as boundaries:
      // close all open formatting tags, insert the boundary tag, then reopen them
      const lowerTagName = tagName.toLowerCase();
      if (!FORMATTING_HTML_TAGS.has(lowerTagName)) {
        for (let p = stack.length - 1; p >= 0; p--) {
          const info = stack[p];
          const closeVal = `</${info.tagName}>`;
          result.push({
            type: TokenType.HTML_TAG,
            value: closeVal,
            start: token.start,
            end: token.start + closeVal.length,
            attributes: {
              tagName: info.tagName,
              attributes: [],
              isClosing: true,
              isSelfClosing: false,
              endPos: token.start + closeVal.length,
            },
          });
        }
        result.push(token);
        for (const info of stack) {
          result.push(info.token);
        }
        continue;
      }

      if (!isClosing) {
        stack.push({ tagName, token });
        result.push(token);
      } else {
        // Closing tag encountered
        let foundMatch = false;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].tagName === tagName) {
            // Found the matching opening tag at index j
            const tagsToReopen: Token[] = [];

            // Close tags opened *after* the match (from top of stack down to j+1)
            for (let k = stack.length - 1; k > j; k--) {
              const innerTagInfo = stack.pop()!; // Remove from stack
              const innerCloseTag = createClosingTag(innerTagInfo.token);
              result.push(innerCloseTag); // Add closing tag to result
              tagsToReopen.unshift(innerTagInfo.token); // Prepend to reopen list
            }

            // Now, add the current closing tag (which matches stack[j])
            result.push(token);

            // Pop the matched opening tag from stack
            stack.pop();

            // Reopen the tags that were closed, unless immediately closed next
            let shouldReopenTags = true;
            if (tagsToReopen.length === 1) {
              const innerTagName = tagsToReopen[0].attributes!.tagName.toLowerCase();
              const nextToken = tokens[idx + 1];
              if (
                nextToken
                && nextToken.type === TokenType.HTML_TAG
                && nextToken.attributes?.isClosing
                && nextToken.attributes.tagName.toLowerCase() === innerTagName
              ) {
                shouldReopenTags = false;
              }
            }
            if (shouldReopenTags) {
              for (const tagToReopen of tagsToReopen) {
                stack.push({ tagName: tagToReopen.attributes!.tagName, token: tagToReopen }); // Push back onto stack
                result.push(tagToReopen); // Add opening tag back to result
              }
            } else {
              idx++; // Skip the upcoming redundant closing tag
            }

            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) {
          // Unmatched closing tag - convert to text
          result.push({
            type: TokenType.TEXT, value: token.value, start: token.start, end: token.end,
          });
        }
      }
    } else {
      // Non-HTML token, just add to result
      result.push(token);
    }
  }

  // Close any remaining open tags on the stack
  while (stack.length > 0) {
    const openTagInfo = stack.pop()!;
    const closingTag = createClosingTag(openTagInfo.token);
    result.push(closingTag);
  }

  return result;
}

/**
 * Simplified preprocessMarkdownTokens
 */
function preprocessMarkdownTokens(tokens: Token[]): Token[] {
  const codeRegions = detectCodeRegions(tokens);
  const isInCodeRegion = (pos: number) => codeRegions.some((r) => pos >= r.start && pos <= r.end)
    || tokens[pos]?.attributes?.isCodeContent === true;
  let result = [...tokens];
  result = handleQuoteBlocks(result, isInCodeRegion);
  result = handleMarkdownMarkers(result, isInCodeRegion);
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
  // First process all markdown/HTML overlaps to convert markers to HTML tags
  // and ensure proper tag balancing
  tokens = processOverlaps(tokens);

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

        // Fix overlapping HTML tags
        const { fixedInnerTokens, continuationTokens } = fixOverlappingHtmlTags(middleTokens, htmlClosingToken);

        // Insert any unbalanced markers lifted from the front BEFORE the HTML block.
        normalized.push(...frontMarkers);
        normalized.push(htmlOpeningToken);
        // Then insert the inner (normalized) tokens.
        normalized.push(...fixedInnerTokens);
        normalized.push(htmlClosingToken);
        // Insert any continuation tags for overlapping HTML formatting
        normalized.push(...continuationTokens);
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

  // return balanceHtmlTags(normalized);
  return normalized;
}
