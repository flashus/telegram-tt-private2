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

export function getExpectedParentElementRecursive(
  expectedTagName: string,
  element: Node | HTMLElement | null | undefined,
  maxDepth: number = MAX_NESTING_PARENTS,
  iter: number = 1,
) {
  if (element instanceof HTMLElement && element?.tagName === expectedTagName) {
    return element;
  }

  if (iter >= MAX_NESTING_PARENTS || !element) {
    return undefined;
  } else {
    return getExpectedParentElementRecursive(
      expectedTagName, element?.parentElement, maxDepth, iter + 1,
    );
  }
}
