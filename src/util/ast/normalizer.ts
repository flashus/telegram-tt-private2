import type { Token } from './token';

import { TokenType } from './astEnums';

type TIntermediateToken = Token & {
  isClosing?: boolean;
  isStyleToken?: boolean;
  forceRebalance?: boolean;
  hasClosingToken?: boolean;
};

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
function findClosingToken(tokens: TIntermediateToken[], startIndex: number, tag: string): number {
  let count = 0;
  for (let i = startIndex; i < tokens.length; i++) {
    const t = tokens[i];
    if (
      t.type === TokenType.HTML_TAG
      && t.attributes
      && t.attributes.tagName?.toLowerCase() === tag
    ) {
      if (!t.attributes.isClosing && !t.attributes.isSelfClosing) {
        count++;
      } else if (t.attributes.isClosing) {
        count--;
        // Found corresponding closing tag! Next, check for continuous style applications
        if (count === 0) {
          return tryRecurseFindClosingToken(tokens, i, tag);
        }
      }
    } else if (
      MARKDOWN_TO_HTML_TAG[t.type as keyof typeof MARKDOWN_TO_HTML_TAG] === tag
    ) {
      if (!t.isClosing) {
        count++;
      } else {
        count--;
        // Found corresponding closing tag! Next, check for continuous style applications
        if (count === 0) {
          return tryRecurseFindClosingToken(tokens, i, tag);
        }
      }
    }
  }
  return -1; // matching closing tag not found
}

// /**
//  * Given an array of tokens and a start index at an opening style token,
//  * try to use closingIndex if exists
//  *
//  * Tries to recursively call itself with a helper function to handle continuous style applications
//  */
// function findClosingTokenCached(tokens: TIntermediateToken[], startIndex: number, tag: string): number {
//   const closingIndex = tokens[startIndex].closingIndex;

//   if (closingIndex) {
//     return tryRecurseFindClosingToken(tokens, closingIndex, tag);
//   }

//   return -1; // matching closing tag not found
// }

/**
 * Checks if there is another open token with the same style and if there is one,
 * calls findClosingToken to find the corresponding closing token
 *
 * Effectively recombines style tokens that are continuous in terms of text
 */
function tryRecurseFindClosingToken(tokens: TIntermediateToken[], index: number, style: string): number {
  // There also must be at least one text token before the next style token with this style!
  const foundTextAfterAnotherOpeningIndex = findTextTokenAfterAnotherOpenToken(tokens, index + 1, style);

  if (foundTextAfterAnotherOpeningIndex === -1) {
    return index;
  }

  // Try to call itself recursively with foundTextAfterAnotherOpeningIndex in mind to find another closing tag
  const nextClosingIndex = findClosingToken(tokens, foundTextAfterAnotherOpeningIndex, style);

  // Did we find another closing tag? If so, return it
  if (nextClosingIndex !== -1) {
    return nextClosingIndex;
  }

  // If did not find another closing tag, return the current found closing tag
  return index;
}

/**
 * If there is another opening style token with the same style,
 * find the text token that comes after it.
 */
function findTextTokenAfterAnotherOpenToken(
  tokens: TIntermediateToken[], startIndex: number, style: string,
): number {
  let foundOpen = false;
  for (let i = startIndex; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === TokenType.TEXT || t.type === TokenType.NEWLINE) {
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
 * Given an array of tokens and a start index at an opening token,
 * try to find the closest closing token of the same type.
 */
function findNextClosingToken(tokens: TIntermediateToken[], startIndex: number, type: TokenType): number {
  for (let i = startIndex; i < tokens.length; i++) {
    if (tokens[i].type === type && tokens[i].isClosing) {
      return i;
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

const getCorrectTokenToPush = (
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

type StyleStackItem = {
  isHtml: boolean;
  style: typeof MARKDOWN_TO_HTML_TAG[keyof typeof MARKDOWN_TO_HTML_TAG];
  closingIndex: number;
};

const HTML_TAGS_TO_FORCE_REBALANCE_AROUND = new Set([
  'spoiler',
  'blockquote',
  'pre',
  'code',
]);

const MARKDOWN_TO_FORCE_REBALANCE_AROUND = new Set([
  TokenType.CODE_MARKER,
  TokenType.CODE_BLOCK,
  // TokenType.QUOTE_MARKER,
]);

// const TOKEN_TYPES_TO_PREVENT_REBALANCE_AROUND = new Set([
//   TokenType.TEXT,
//   TokenType.EOF,
// ]);

const createZeroLengthToken = (
  styleStackItem: StyleStackItem,
  position: number,
  isClosing: boolean,
): TIntermediateToken => ({
  type: styleStackItem.isHtml ? TokenType.HTML_TAG : HTML_TAG_TO_MARKDOWN[styleStackItem.style],
  value: '',
  start: position,
  end: position,
  isClosing,
  attributes: styleStackItem.isHtml ? {
    tagName: styleStackItem.style,
    isClosing,
    isSelfClosing: false,
    attributes: [],
    endPos: position,
  } : undefined,
});

/**
 * Rebalance the style markers around some token based on active style
 */
const rebalanceStyleTokensAroundStyle = (
  checkedToken: TIntermediateToken,
  activeStyleStack: StyleStackItem[],
  checkedTokenStyle: string,
): { rebalancedTokens: TIntermediateToken[]; newActiveStyleStack: StyleStackItem[] } => {
  const firstActiveStyleStack: StyleStackItem[] = [];
  const secondActiveStyleStack: StyleStackItem[] = [];
  const rebalancedTokens: TIntermediateToken[] = [];

  // const position = checkedToken.isClosing ? checkedToken.end : checkedToken.start;

  // Take from the first stack until we find match for the opening style token
  let stackItem = activeStyleStack.pop();
  while (stackItem && stackItem.style !== checkedTokenStyle) {
    rebalancedTokens.push(createZeroLengthToken(stackItem, checkedToken.start, true));
    // Put all the stack items back to the second stack until we find the opening style token
    secondActiveStyleStack.push(stackItem);
    stackItem = activeStyleStack.pop();
  }

  rebalancedTokens.push(checkedToken);

  // Take from the second stack until it is empty
  stackItem = secondActiveStyleStack.pop();
  while (stackItem) {
    // Put all the stack items back to the first stack
    firstActiveStyleStack.push(stackItem);
    rebalancedTokens.push(createZeroLengthToken(stackItem, checkedToken.end, false));
    stackItem = secondActiveStyleStack.pop();
  }

  return { rebalancedTokens, newActiveStyleStack: firstActiveStyleStack };
};

/**
 * Rebalance the style markers around some token based on active style
 *
 * Does not return the new active style stack
 */
const rebalanceStyleTokens = (
  checkedToken: TIntermediateToken,
  activeStyleStack: StyleStackItem[],
): TIntermediateToken[] => {
  const secondActiveStyleStack: StyleStackItem[] = [];
  const rebalancedTokens: TIntermediateToken[] = [];

  // const position = checkedToken.isClosing ? checkedToken.end : checkedToken.start;

  // Just iterate over the first stack
  let stackItem;
  for (let i = activeStyleStack.length - 1; i >= 0; i--) {
    stackItem = activeStyleStack[i];
    rebalancedTokens.push(createZeroLengthToken(stackItem, checkedToken.start, true));
    // Put all the stack items back to the second stack until we find the opening style token
    secondActiveStyleStack.push(stackItem);
  }

  rebalancedTokens.push(checkedToken);

  // Take from the second stack until it is empty
  stackItem = secondActiveStyleStack.pop();
  while (stackItem) {
    rebalancedTokens.push(createZeroLengthToken(stackItem, checkedToken.end, false));
    stackItem = secondActiveStyleStack.pop();
  }

  return rebalancedTokens;
};

const ignoreRedundantTokens = (tokens: TIntermediateToken[]): Token[] => {
  let filteredTokens: TIntermediateToken[] = [];

  /** Set of html tags to watch for rebalancing */
  const openHtmlTags: Set<string> = new Set();

  let activeStyleStack: StyleStackItem[] = [];

  const skipRebalanceAround: Map<number, string[]> = new Map();

  let i: number;

  for (i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // If this token is not a style token - start //
    if (!token.isStyleToken) {
      if (
        token.type === TokenType.HTML_TAG
        && token.attributes
        && !token.attributes.isSelfClosing
      ) {
        // Handle all the html tags that are not style
        if (token.attributes.isClosing) {
          const wasOpen = openHtmlTags.delete(token.attributes.tagName);
          // Rebalance style tags around the closing tag only if it was open before
          if (wasOpen) {
            // Rebalance all active styles except for skipped
            const skipRebalance = skipRebalanceAround.get(i);
            const styleStackToRebalance = skipRebalance ? activeStyleStack.filter(
              (stackItem) => !skipRebalance?.includes(stackItem.style),
            ) : activeStyleStack;
            const rebalancedTokens = rebalanceStyleTokens(token, styleStackToRebalance);
            filteredTokens = filteredTokens.concat(rebalancedTokens);
          }
        } else {
          // Check if it must be rebalanced around open tag - only if it will close
          if (token.hasClosingToken) {
            const tagClosingIndex = findClosingHtmlTag(tokens, i, token.attributes.tagName);
            // Will have to keep track of the closing tag and those specific style items that have to be rebalanced specifically for this tag
            let styleStackToRebalance: StyleStackItem[] = [];
            if (HTML_TAGS_TO_FORCE_REBALANCE_AROUND.has(token.attributes.tagName)) {
              styleStackToRebalance = activeStyleStack;
            } else {
              /** These tokens will not be rebalanced around corresponding closing html tag */
              const skipRebalance: string[] = [];
              for (let j = 0; j < activeStyleStack.length; j++) {
                const stackItem = activeStyleStack[j];
                if (stackItem.closingIndex > tagClosingIndex) {
                  // If this style token is closing after the closing tag,
                  // it must not be rebalanced - this tag is entirely inside of style token coverage
                  skipRebalance.push(stackItem.style);
                  continue;
                }
                styleStackToRebalance.push(stackItem);
              }

              skipRebalanceAround.set(tagClosingIndex, skipRebalance);
            }

            const rebalancedTokens = rebalanceStyleTokens(token, styleStackToRebalance);

            filteredTokens = filteredTokens.concat(rebalancedTokens);
          } else {
            // If there is no closing tag, just push the token
            filteredTokens.push(token);
          }
          openHtmlTags.add(token.attributes.tagName);
        }

        continue;
      }

      if (MARKDOWN_TO_FORCE_REBALANCE_AROUND.has(token.type)) {
        // Handle all the html tokens that are not style
        if (token.isClosing) {
          // Rebalance style tokens around the closing md tag or open that has a corresponding closing marker
          // Rebalance all active styles except for skipped
          const skipRebalance = skipRebalanceAround.get(i);
          const styleStackToRebalance = skipRebalance ? activeStyleStack.filter(
            (stackItem) => !skipRebalance?.includes(stackItem.style),
          ) : activeStyleStack;
          const rebalancedTokens = rebalanceStyleTokens(token, styleStackToRebalance);
          filteredTokens = filteredTokens.concat(rebalancedTokens);
        } else if (token.hasClosingToken) {
          const closingIndex = findNextClosingToken(tokens, i, token.type);
          const styleStackToRebalance: StyleStackItem[] = [];
          /** These tokens will not be rebalanced around corresponding closing html tag */
          const skipRebalance: string[] = [];
          for (let j = 0; j < activeStyleStack.length; j++) {
            const stackItem = activeStyleStack[j];
            if (stackItem.closingIndex > closingIndex) {
              // If this style token is closing after the closing tag,
              // it must not be rebalanced - this tag is entirely inside of style token coverage
              skipRebalance.push(stackItem.style);
              continue;
            }
            styleStackToRebalance.push(stackItem);
          }

          skipRebalanceAround.set(closingIndex, skipRebalance);
          const rebalancedTokens = rebalanceStyleTokens(token, styleStackToRebalance);
          filteredTokens = filteredTokens.concat(rebalancedTokens);
        } else {
          // If there is no closing token, just push the token
          filteredTokens.push(token);
        }

        continue;
      }

      // Just push all non-style non-html non-rebalancing-around tokens
      filteredTokens.push(token);
      continue;
    }
    // If this token is not a style token - end //

    const style = token.attributes?.tagName ?? MARKDOWN_TO_HTML_TAG[token.type as keyof typeof MARKDOWN_TO_HTML_TAG];
    const isClosing = token.attributes?.isClosing ?? token.isClosing;
    const activeStyle = activeStyleStack.find((item) => item.style === style);

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

      const tokenToPush = getCorrectTokenToPush(token, isHtml, style, isClosing);

      // Rebalance tokens around the closing tag - it was for sure open because of activeStyle
      const { rebalancedTokens, newActiveStyleStack } = rebalanceStyleTokensAroundStyle(
        tokenToPush, activeStyleStack, style,
      );

      filteredTokens = filteredTokens.concat(rebalancedTokens);
      activeStyleStack = newActiveStyleStack;
      continue;
    }

    // Not is closing === opening
    if (!isClosing && !activeStyle) {
      const closingIndex = findClosingToken(tokens, i, style);
      if (closingIndex !== -1) {
        // Set as active only if there is a closing tag
        activeStyleStack.push({
          isHtml: token.type === TokenType.HTML_TAG,
          closingIndex,
          style,
        });
      }
      // Do not rebalance around opening style tags
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
export function liftTokensRecursively(tokens: TIntermediateToken[]): TIntermediateToken[] {
  let i = 0;
  const lifted: TIntermediateToken[] = [];

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
        const normalizedContent = liftTokensRecursively(contentTokens);

        // Process the front boundary of the block.
        const { moved: frontMarkers, remaining: frontRemaining } = processBoundary([...normalizedContent], true);
        // Process the back boundary of the block.
        const { moved: backMarkers, remaining: middleTokens } = processBoundary(frontRemaining, false);

        // Insert any unbalanced markers lifted from the front BEFORE the HTML block.
        lifted.push(...frontMarkers);
        lifted.push({ ...htmlOpeningToken, hasClosingToken: true });
        // Then insert the inner (normalized) tokens.
        lifted.push(...middleTokens);
        lifted.push(htmlClosingToken);
        // Insert any unbalanced markers lifted from the back AFTER the HTML block.
        lifted.push(...backMarkers);

        // Skip over this entire HTML block.
        i = closingIndex + 1;
        continue;
      }
      // If no matching closing tag is found, fall through.
    }

    // For non-HTML tokens (or if no matching closing tag), pass the token through.
    lifted.push(token);
    i++;
  }

  return lifted;
}

export function normalizeTokens(tokens: Token[]): Token[] {
  const isOpenMarkdownTagMap: Record<string | number, {
    lastIndex: number;
    isClosing: boolean;
  }> = {};

  const mappedTokens: TIntermediateToken[] = tokens.map((token, index) => {
    if (isStyleHtmlToken(token)) {
      return { ...token, isStyleToken: true };
    }
    if (isStyleMarkdownToken(token)) {
      // For style markdown markers, iterate open and close equivalent HTML tags
      const isClosing = isOpenMarkdownTagMap[token.type]?.isClosing ?? false;
      isOpenMarkdownTagMap[token.type] = {
        lastIndex: index, isClosing: !isClosing,
      };
      return {
        ...token,
        isClosing,
        isStyleToken: true,
        hasClosingToken: !isClosing ? true : undefined, // assume that it has a closing token
      };
    }

    if (token.type === TokenType.CODE_BLOCK || token.type === TokenType.CODE_MARKER) {
      // For markdown markers that must be forced rebalanced around, iterate open and close equivalent HTML tags
      const isClosing = isOpenMarkdownTagMap[token.type]?.isClosing ?? false;
      isOpenMarkdownTagMap[token.type] = {
        lastIndex: index, isClosing: !isClosing,
      };
      return {
        ...token,
        isClosing,
        hasClosingToken: !isClosing ? true : undefined, // assume that it has a closing token
      };
    }

    // HANDLE BLOCKQUOTES

    return token;
  });

  Object.values(isOpenMarkdownTagMap).forEach(({ isClosing, lastIndex }) => {
    if (!isClosing) {
      // Now for sure it has no closing token
      mappedTokens[lastIndex].hasClosingToken = false;
    }
  });

  const lifted = liftTokensRecursively(mappedTokens);

  return ignoreRedundantTokens(lifted);
}
