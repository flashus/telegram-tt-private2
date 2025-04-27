const MAX_NESTING_PARENTS = 6;

export function isSelectionInsideInput(selectionRange: Range, inputId: string) {
  const { commonAncestorContainer } = selectionRange;
  let parentNode: HTMLElement | null = commonAncestorContainer as HTMLElement;
  let iterations = 1;
  while (parentNode && parentNode.id !== inputId && iterations < MAX_NESTING_PARENTS) {
    parentNode = parentNode.parentElement;
    iterations++;
  }

  return Boolean(parentNode && parentNode.id === inputId);
}

export function isQuoteEnd(range: Range, blockquote: HTMLElement | null | undefined): boolean {
  if (!blockquote) {
    return false;
  }

  let lastTextNode: Node | undefined;
  for (let i = blockquote.childNodes.length - 1; i >= 0; i--) {
    const node = blockquote.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() && node.textContent?.trim() !== '\n') {
      lastTextNode = node;
      break;
    }
  }

  if (!lastTextNode) {
    return false;
  }

  // Create a range representing the end of the blockquote
  const lastTextNodeRange = document.createRange();
  lastTextNodeRange.selectNodeContents(lastTextNode);
  lastTextNodeRange.collapse(false); // Collapse to the end

  // Check if the selection's end matches the blockquote's end
  const isAtQuoteEnd = range.compareBoundaryPoints(Range.END_TO_END, lastTextNodeRange) !== -1;
  return isAtQuoteEnd;
}

/**
 * Checks if the selection end is effectively at the blockquote's end,
 * even if it's inside nested formatting tags or whitespace.
 */
export function isDeepBlockquoteEnd(range: Range, blockquote: HTMLElement): boolean {
  let container: Node = range.endContainer;
  const offset = range.endOffset;
  // Validate at end of current node
  if (container.nodeType === Node.TEXT_NODE) {
    if (offset < (container.textContent?.length || 0)) {
      return false;
    }
  } else if (container.nodeType === Node.ELEMENT_NODE) {
    if (offset < container.childNodes.length) {
      return false;
    }
  } else {
    return false;
  }
  // Ascend to blockquote, ensuring no following siblings at each level
  while (container && container !== blockquote) {
    const parent = container.parentNode;
    if (!parent) break;
    const idx = Array.prototype.indexOf.call(parent.childNodes, container);
    if (idx < parent.childNodes.length - 1) {
      return false;
    }
    container = parent;
  }
  return container === blockquote;
}

export function getExpectedParentElementRecursive(
  expectedTagName: string,
  element: Node | HTMLElement | null | undefined,
  expectedClassName: string = '',
  maxDepth: number = MAX_NESTING_PARENTS,
  iter: number = 1,
) {
  if (element instanceof HTMLElement && element?.tagName === expectedTagName) {
    if (!expectedClassName) {
      return element;
    }
    if (element.classList.contains(expectedClassName)) {
      return element;
    }
  }

  if (iter >= MAX_NESTING_PARENTS || !element) {
    return undefined;
  } else {
    return getExpectedParentElementRecursive(
      expectedTagName, element?.parentElement, expectedClassName, maxDepth, iter + 1,
    );
  }
}
