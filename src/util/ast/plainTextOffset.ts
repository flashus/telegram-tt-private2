/**
 * Calculates the caret offset within the equivalent plain text representation of a DOM node,
 * ignoring specific elements like markdown markers.
 */
export function getPlainTextOffset(container: Node, domOffset: number): number {
  let plainTextOffset = 0;
  let currentDomOffset = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      // Skip marker spans entirely
      if (node instanceof HTMLElement && node.classList.contains('md-marker')) {
        return NodeFilter.FILTER_REJECT;
      }
      // Potentially skip other non-content elements if needed
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node: Node | null;
  while ((node = walker.nextNode()) && currentDomOffset < domOffset) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeLength = node.textContent?.length ?? 0;
      const remainingOffsetInNode = domOffset - currentDomOffset;

      if (remainingOffsetInNode <= nodeLength) {
        // Caret is within this text node
        plainTextOffset += remainingOffsetInNode;
        currentDomOffset += remainingOffsetInNode;
        break; // Found the offset
      } else {
        // Caret is after this text node
        plainTextOffset += nodeLength;
        currentDomOffset += nodeLength;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // For elements that contribute to offset (like <br> potentially -> newline),
      // increment currentDomOffset if the browser counts them in its offset calculation.
      // For simplicity here, we assume only text nodes contribute directly to the plain text offset.
      // We might need to refine this if elements like <br> affect DOM offset calculation.
      // The TreeWalker already skips markers based on the filter.
    }

    // Approximation: If the node itself is the anchorNode or its parent,
    // use the passed domOffset relative to this node.
    // This part needs careful implementation based on how domOffset is derived initially.
    // For now, we rely on text node traversal.
  }

  // If domOffset points exactly at the end of the container or after the last text node
  if (currentDomOffset < domOffset) {
    // This might happen if offset is at the very end, or points within/after non-text nodes
    // that were processed. Need a robust way to handle this.
    // For now, return the accumulated offset.
  }

  // Fallback / Refinement needed: The direct mapping isn't perfect yet,
  // especially around block elements or the exact end.
  // Consider using a Range object comparison for more precision if needed.
  return plainTextOffset;
}

// --- More robust version attempt using Range ---
export function getPlainTextOffsetFromRange(container: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) return 0;

  const precedingRange = document.createRange();
  precedingRange.selectNodeContents(container);
  precedingRange.setEnd(range.startContainer, range.startOffset);

  // Create a temporary div to render the *plain text* of the preceding range
  const tempDiv = document.createElement('div');

  const walker = document.createTreeWalker(precedingRange.commonAncestorContainer, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      // Only accept nodes within the preceding range
      if (!precedingRange.intersectsNode(node) && !(node === precedingRange.startContainer && node === precedingRange.endContainer)) {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip marker spans
      if (node instanceof HTMLElement && node.classList.contains('md-marker')) {
        return NodeFilter.FILTER_REJECT;
      }
      // Include text nodes
      if (node.nodeType === Node.TEXT_NODE) {
        return NodeFilter.FILTER_ACCEPT;
      }
      // Include elements that represent newlines in plain text (e.g., <br>, maybe block elements)
      if (node instanceof HTMLElement && (node.tagName === 'BR' || getComputedStyle(node).display === 'block')) {
        // Check if it's the *start* of the range to avoid double counting if range starts/ends mid-element
        if (precedingRange.startContainer === node || precedingRange.endContainer === node) {
          // Handle partial inclusion if necessary - complex
        } else {
          return NodeFilter.FILTER_ACCEPT;
        }
      }

      return NodeFilter.FILTER_SKIP; // Skip other elements but traverse children
    },
  });

  let currentNode;
  let plainText = '';
  while ((currentNode = walker.nextNode())) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      // Append only the part of the text node that's within the range
      const textNode = currentNode as Text;
      let textToAdd = textNode.textContent || '';
      if (currentNode === precedingRange.startContainer) {
        textToAdd = textToAdd.substring(precedingRange.startOffset);
      }
      if (currentNode === precedingRange.endContainer) {
        textToAdd = textToAdd.substring(0, precedingRange.endOffset);
      }
      // Ensure we only add text if the node is fully or partially selected by the precedingRange
      if (precedingRange.intersectsNode(currentNode) || currentNode === precedingRange.startContainer || currentNode === precedingRange.endContainer) {
        plainText += textToAdd;
      }
    } else if (currentNode instanceof HTMLElement) {
      if (currentNode.tagName === 'BR' || getComputedStyle(currentNode).display === 'block') {
        // Add newline if it's not the very start and not immediately after another block/br
        if (plainText.length > 0 && !plainText.endsWith('\n')) {
          plainText += '\n';
        }
      }
    }
  }

  // console.log('Preceding plain text:', JSON.stringify(plainText));
  return plainText.length;
}
