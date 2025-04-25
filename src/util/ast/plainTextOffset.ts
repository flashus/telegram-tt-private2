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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const tempDiv = document.createElement('div');

  const walker = document.createTreeWalker(
    precedingRange.commonAncestorContainer,
    // eslint-disable-next-line no-bitwise
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
      // Only accept nodes within the preceding range
        if (
          !precedingRange.intersectsNode(node)
          && !(node === precedingRange.startContainer && node === precedingRange.endContainer)
        ) {
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
    },
  );

  let currentNode;
  let plainText = '';
  // eslint-disable-next-line no-cond-assign
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
      if (
        precedingRange.intersectsNode(currentNode)
        || currentNode === precedingRange.startContainer
        || currentNode === precedingRange.endContainer
      ) {
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

  return plainText.length;
}
