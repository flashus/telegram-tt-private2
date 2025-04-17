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
        if (count === 0) {
          return i;
        }
      }
    } else if (
      MARKDOWN_TO_HTML_TAG[t.type as keyof typeof MARKDOWN_TO_HTML_TAG] === style
    ) {
      if (!t.isClosing) {
        count++;
      } else {
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

const removeRedundantTokens = (tokens: TIntermediateToken[]): Token[] => {
  const filteredTokens: TIntermediateToken[] = [];

  /** key: style tag name, value: isHtml, closingIndex */
  const activeStylesMap: Map<string, { isHtml: boolean; closingIndex: number }> = new Map();

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
        // Closing style token does not match opening style token - ignore it, harmless
        continue;
      }

      let tokenToPush = token;

      // if (isHtml && token.type === TokenType.HTML_TAG) {
      // Token as is
      // }

      if (isHtml && token.type !== TokenType.HTML_TAG) {
        tokenToPush = markdownToHtmlTag(style, token.value, isClosing, token.start, token.end);
      }

      if (!isHtml && token.type === TokenType.HTML_TAG) {
        tokenToPush = htmlTagToMarkdown(
          HTML_TAG_TO_MARKDOWN[style as keyof typeof HTML_TAG_TO_MARKDOWN],
          token.value,
          isClosing,
          token.start,
          token.end,
        );
      }

      // if (!isHtml && token.type !== TokenType.HTML_TAG) {
      // Token as is
      // }

      filteredTokens.push(tokenToPush);
      activeStylesMap.delete(style);
      continue;
    }

    // Not is closing === opening
    if (!isClosing && !activeStyle) {
      const closingIndex = findClosingStyleToken(tokens, i, style);
      if (closingIndex !== -1) {
        // Set as active only if there is a closing tag
        activeStylesMap.set(style, { isHtml: token.type === TokenType.HTML_TAG, closingIndex });
      }
      filteredTokens.push(token);
      continue;
    }

    // Ignore others like opening when active style
    filteredTokens.push({ ...token, type: TokenType.IGNORE });
  }

  const recombinedTokens: TIntermediateToken[] = [];

  for (i = 0; i < filteredTokens.length; i++) {
    const token = filteredTokens[i];
    const nextToken = filteredTokens[i + 1];

    // Push all non-style tokens as is
    if (!token.isStyleToken || !nextToken || !nextToken.isStyleToken) {
      recombinedTokens.push(token);
      continue;
    }

    // Make it ignored if this token is closing and next one is opening with the same style
  }

  // const recombinedTokens: TIntermediateToken[] = [];

  // for (i = 0; i < filteredTokens.length; i++) {
  //   const token = filteredTokens[i];
  //   const prevToken = filteredTokens[i - 1];

  //   // Push all non-style tokens as is
  //   if (!token.isStyleToken || !prevToken || !prevToken.isStyleToken) {
  //     recombinedTokens.push(token);
  //     continue;
  //   }

  //   // If style token is closing or previous was not closing - leave it as is
  //   if (token.isClosing || !prevToken.isClosing) {
  //     recombinedTokens.push(token);
  //     continue;
  //   }

  //   const style = token.attributes?.tagName
  //     ?? MARKDOWN_TO_HTML_TAG[token.type as keyof typeof MARKDOWN_TO_HTML_TAG];
  //   const prevStyle = prevToken.attributes?.tagName
  //     ?? MARKDOWN_TO_HTML_TAG[prevToken.type as keyof typeof MARKDOWN_TO_HTML_TAG];

  //   // If there is a style change - leave it as is
  //   if (style !== prevStyle) {
  //     recombinedTokens.push(token);
  //     continue;
  //   }

  //   // Otherwise, combine them if there is next closing token with the same style
  //   const nextClosingTokenWithThisStyleIndex = findClosingStyleToken(
  //     filteredTokens,
  //     i + 1,
  //     style,
  //   );

  //   if (nextClosingTokenWithThisStyleIndex === -1) {
  //     recombinedTokens.push(token);
  //     continue;
  //   }

  //   // Everything lower in this loop is designed to make closing token type match the opening one
  //   let lastOpeningTokenWithThisStyle: Token | undefined;
  //   for (let j = i - 1; j >= 0; j--) {
  //     const lookupToken = filteredTokens[j];
  //     if (
  //       lookupToken.isStyleToken
  //       && (lookupToken.attributes?.tagName === style
  //         || MARKDOWN_TO_HTML_TAG[prevToken.type as keyof typeof MARKDOWN_TO_HTML_TAG] === style
  //       )
  //     ) {
  //       lastOpeningTokenWithThisStyle = lookupToken;
  //       break;
  //     }
  //   }

  //   const nextClosingTokenWithThisStyle = filteredTokens[nextClosingTokenWithThisStyleIndex];
  //   if (
  //     nextClosingTokenWithThisStyle.type === TokenType.HTML_TAG
  //     && lastOpeningTokenWithThisStyle!.type !== TokenType.HTML_TAG
  //   ) {
  //     filteredTokens[nextClosingTokenWithThisStyleIndex] = htmlTagToMarkdown(
  //       HTML_TAG_TO_MARKDOWN[style as keyof typeof HTML_TAG_TO_MARKDOWN],
  //       nextClosingTokenWithThisStyle.value,
  //       true,
  //       nextClosingTokenWithThisStyle.start,
  //       nextClosingTokenWithThisStyle.end,
  //     );
  //   }

  //   if (
  //     nextClosingTokenWithThisStyle.type !== TokenType.HTML_TAG
  //     && lastOpeningTokenWithThisStyle!.type === TokenType.HTML_TAG
  //   ) {
  //     filteredTokens[nextClosingTokenWithThisStyleIndex] = markdownToHtmlTag(
  //       style,
  //       nextClosingTokenWithThisStyle.value,
  //       true,
  //       nextClosingTokenWithThisStyle.start,
  //       nextClosingTokenWithThisStyle.end,
  //     );
  //   }
  // }

  // // Reconstruct the token stream after potentially losing some redundant tokens.
  // for (i = 1; i < recombinedTokens.length; i++) {
  //   recombinedTokens[i].start = recombinedTokens[i - 1].end;
  // }

  // const restoredTokens: Token[] = [];

  // for (i = 0; i < recombinedTokens.length; i++) {
  //   // Here, no nesting is allowed anymore. But there could be situations
  //   // like <b><i>...</b>...</i> which must be transformed to <b><i>...</i></b><i>...</i>
  //   // with using of zero-width tokens with '' values
  //   const token = recombinedTokens[i];

  //   // Leave all non-style and closing tokens as is
  //   if (!token.isStyleToken || token.attributes?.isClosing || token.isClosing) {
  //     restoredTokens.push(token);
  //     continue;
  //   }

  //   const style = token.attributes?.tagName
  //     ?? MARKDOWN_TO_HTML_TAG[token.type as keyof typeof MARKDOWN_TO_HTML_TAG];

  // }

  return recombinedTokens;
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
