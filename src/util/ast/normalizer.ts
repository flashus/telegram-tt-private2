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

// A set of token types that represent markdown markers we want to “lift”
const MARKDOWN_TO_LIFT_MARKER_TYPES = new Set([
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
 * Given an array of tokens and a start index at an opening style token,
 * try to find the matching closing token of the same type.
 *
 * Tries to recursively call itself with a helper function to handle continuous style applications
 */
function findClosingStyleToken(tokens: TIntermediateToken[], startIndex: number, style: string): number {
  let count = 0;
  for (let i = startIndex; i < tokens.length; i++) {
    const t = tokens[i];
    if (
      t.type === TokenType.HTML_TAG
      && t.attributes
      && t.attributes.tagName?.toLowerCase() === style
    ) {
      if (!t.attributes.isClosing && !t.attributes.isSelfClosing) {
        count++;
      } else if (t.attributes.isClosing) {
        count--;
        // Found corresponding closing tag! Next, check for continuous style applications
        if (count === 0) {
          return tryRecurseFindClosingStyleToken(tokens, i, style);
        }
      }
    } else if (
      MARKDOWN_TO_HTML_TAG[t.type as keyof typeof MARKDOWN_TO_HTML_TAG] === style
    ) {
      if (!t.isClosing) {
        count++;
      } else {
        count--;
        // Found corresponding closing tag! Next, check for continuous style applications
        if (count === 0) {
          return tryRecurseFindClosingStyleToken(tokens, i, style);
        }
      }
    }
  }
  return -1; // matching closing tag not found
}

function tryRecurseFindClosingStyleToken(tokens: TIntermediateToken[], index: number, style: string): number {
  // There also must be at least one text token before the next style token with this style!
  const foundTextAfterAnotherOpeningIndex = findTextTokenAfterAnotherOpenStyleToken(tokens, index + 1, style);

  if (foundTextAfterAnotherOpeningIndex === -1) {
    return index;
  }

  // Try to call itself recursively with foundTextAfterAnotherOpeningIndex in mind to find another closing tag
  const nextClosingIndex = findClosingStyleToken(tokens, foundTextAfterAnotherOpeningIndex, style);

  // Did we find another closing tag? If so, return it
  if (nextClosingIndex !== -1) {
    return nextClosingIndex;
  }

  // If did not find another closing tag, return the current found closing tag
  return index;
}

/**
 * If there is another opening style token with the same style, find the text token that comes after it.
 */
function findTextTokenAfterAnotherOpenStyleToken(
  tokens: TIntermediateToken[], startIndex: number, style: string,
): number {
  let foundOpen = false;
  for (let i = startIndex; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === TokenType.TEXT) {
      if (foundOpen) {
        // If found a text token after another open style token, return it
        return i;
      } else {
        // If there is a text token before any other open style tokens, then return -1 as if not found
        return -1;
      }
    }

    if (
      t.type === TokenType.HTML_TAG
      && t.attributes
      && t.attributes.tagName?.toLowerCase() === style
    ) {
      if (!t.attributes.isClosing && !t.attributes.isSelfClosing) {
        foundOpen = true;
      }
    } else if (
      MARKDOWN_TO_HTML_TAG[t.type as keyof typeof MARKDOWN_TO_HTML_TAG] === style
    ) {
      if (!t.isClosing) {
        foundOpen = true;
      }
    }
  }

  return -1;
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
    while (tokens.length > 0 && isMarkdownToLiftMarker(tokens[0])) {
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
    while (tokens.length > 0 && isMarkdownToLiftMarker(tokens[tokens.length - 1])) {
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

const getTokenToPush = (
  token: TIntermediateToken,
  shouldBeHtml: boolean,
  style: string,
  isClosing: boolean,
): TIntermediateToken => {
  let tokenToPush = token;

  // if (shouldBeHtml && token.type === TokenType.HTML_TAG) {
  // Token as is
  // }

  if (shouldBeHtml && token.type !== TokenType.HTML_TAG) {
    tokenToPush = markdownToHtmlTag(style, token.value, isClosing, token.start, token.end);
  }

  if (!shouldBeHtml && token.type === TokenType.HTML_TAG) {
    tokenToPush = htmlTagToMarkdown(
      HTML_TAG_TO_MARKDOWN[style as keyof typeof HTML_TAG_TO_MARKDOWN],
      token.value,
      isClosing,
      token.start,
      token.end,
    );
  }

  // if (!shouldBeHtml && token.type !== TokenType.HTML_TAG) {
  // Token as is
  // }

  return tokenToPush;
};

const removeRedundantTokens = (tokens: TIntermediateToken[]): Token[] => {
  const filteredTokens: TIntermediateToken[] = [];

  /** key: style tag name, value: isHtml, closingIndex */
  const activeStylesMap: Map<string, { isHtml: boolean; closingIndex: number }> = new Map();

  const firstStack: {
    isHtml: boolean;
    style: typeof MARKDOWN_TO_HTML_TAG[keyof typeof MARKDOWN_TO_HTML_TAG];
  }[] = [];
  const secondStack: {
    isHtml: boolean;
    style: typeof MARKDOWN_TO_HTML_TAG[keyof typeof MARKDOWN_TO_HTML_TAG];
  }[] = [];

  let i: number;

  for (i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (!token.isStyleToken) {
      filteredTokens.push(token);
      continue;
    }

    const style = token.attributes?.tagName ?? MARKDOWN_TO_HTML_TAG[token.type as keyof typeof MARKDOWN_TO_HTML_TAG];
    const isClosing = token.attributes?.isClosing ?? token.isClosing;
    const activeStyle = activeStylesMap.get(style);

    // Some lonely closing tag - harmless
    if (isClosing && !activeStyle) {
      filteredTokens.push(token);
      continue;
    }

    if (isClosing && activeStyle) {
      const { isHtml, closingIndex } = activeStyle;
      if (closingIndex !== i) {
        // Closing style token does not match opening style token - mark it as ignored
        filteredTokens.push({ ...token, type: TokenType.IGNORE });
        continue;
      }

      const tokenToPush = getTokenToPush(token, isHtml, style, isClosing);

      // Take from the first stack until we find match for the opening style token
      let stackItem = firstStack.pop();
      if (!stackItem) {
        // Throw an Error, I guess. Should never happen!
      }
      while (stackItem && stackItem.style !== style) {
        const newZeroLengthToken = {
          type: stackItem.isHtml ? TokenType.HTML_TAG : HTML_TAG_TO_MARKDOWN[stackItem.style],
          value: '',
          start: tokenToPush.end,
          end: tokenToPush.end,
        };

        filteredTokens.push(newZeroLengthToken);
        // Put all the stack items back to the second stack until we find the opening style token
        secondStack.push(stackItem);
        stackItem = firstStack.pop();
      }

      filteredTokens.push(tokenToPush);
      activeStylesMap.delete(style);

      // Take from the second stack until it is empty
      stackItem = secondStack.pop();
      while (stackItem) {
        const newZeroLengthToken = {
          type: stackItem.isHtml ? TokenType.HTML_TAG : HTML_TAG_TO_MARKDOWN[stackItem.style],
          value: '',
          start: tokenToPush.end,
          end: tokenToPush.end,
        };

        filteredTokens.push(newZeroLengthToken);
        stackItem = secondStack.pop();
      }
      continue;
    }

    // Not is closing === opening
    if (!isClosing && !activeStyle) {
      const closingIndex = findClosingStyleToken(tokens, i, style);
      if (closingIndex !== -1) {
        // Set as active only if there is a closing tag
        activeStylesMap.set(style, { isHtml: token.type === TokenType.HTML_TAG, closingIndex });
        firstStack.push({ isHtml: token.type === TokenType.HTML_TAG, style });
      }
      filteredTokens.push(token);
      continue;
    }

    // Ignore others like opening when active style
    filteredTokens.push({ ...token, type: TokenType.IGNORE });
  }

  return filteredTokens;
};

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

  const isOpenMarkdownTagMap: Record<
  | TokenType.BOLD_MARKER
  | TokenType.ITALIC_MARKER
  | TokenType.STRIKE_MARKER
  | TokenType.UNDERLINE_MARKER
  | TokenType.SPOILER_MARKER,
  boolean
  > = {
    [TokenType.BOLD_MARKER]: true,
    [TokenType.ITALIC_MARKER]: true,
    [TokenType.STRIKE_MARKER]: true,
    [TokenType.UNDERLINE_MARKER]: true,
    [TokenType.SPOILER_MARKER]: true,
  };

  const mappedTokens: TIntermediateToken[] = tokens.map((token) => {
    if (isStyleHtmlToken(token)) {
      return { ...token, isStyleToken: true };
    }
    if (isStyleMarkdownToken(token)) {
      // For style markdown markers, iterate open and close equivalent HTML tags
      const isClosing = !isOpenMarkdownTagMap[token.type as keyof typeof MARKDOWN_TO_HTML_TAG];
      isOpenMarkdownTagMap[token.type as keyof typeof MARKDOWN_TO_HTML_TAG] = isClosing;

      return {
        ...token,
        isClosing,
        isStyleToken: true,
      };
    }

    return token;
  });

  while (i < mappedTokens.length) {
    const token = mappedTokens[i];

    // If this token is an opening HTML tag (and not self-closing)…
    if (
      token.type === TokenType.HTML_TAG
      && token.attributes
      && !token.attributes.isClosing
      && !token.attributes.isSelfClosing
      && token.attributes.tagName
    ) {
      const tagName = token.attributes.tagName.toLowerCase();
      const closingIndex = findClosingHtmlTag(mappedTokens, i, tagName);
      if (closingIndex !== -1) {
        // Found a complete HTML block.
        const htmlOpeningToken = token;
        const htmlClosingToken = mappedTokens[closingIndex];

        // Extract the tokens inside the HTML block.
        const contentTokens = mappedTokens.slice(i + 1, closingIndex);
        // Recursively normalize the inner tokens.
        const normalizedContent = normalizeTokens(contentTokens);

        // Process the front boundary of the block.
        const { moved: frontMarkers, remaining: frontRemaining } = processBoundary([...normalizedContent], true);
        // Process the back boundary of the block.
        const { moved: backMarkers, remaining: middleTokens } = processBoundary(frontRemaining, false);

        // HANDLE MIDDLE TOKENS!
        // const {
        //   addedFront: addedFrontMarkers,
        //   addedMiddleFront: addedMiddleFrontMarkers,
        //   addedMiddleBack: addedMiddleBackMarkers,
        //   addedBack: addedBackMarkers,
        // } = handleMiddleTokens(
        //   middleTokens,
        //   tokens,
        //   i,
        //   closingIndex,
        // );

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

  return removeRedundantTokens(normalized);
  // return normalized;
}
