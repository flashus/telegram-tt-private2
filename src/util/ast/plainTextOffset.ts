export type SelectionOffsets = { start: number; end: number };

// --- More robust version attempt using Range ---
export function getPlainTextOffsetFromRange(container: HTMLElement, ignoreMarkers: boolean = true): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) return 0;

  const precedingRange = document.createRange();
  precedingRange.selectNodeContents(container);
  precedingRange.setEnd(range.startContainer, range.startOffset);

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
        if (ignoreMarkers && node instanceof HTMLElement && node.classList.contains('md-marker')) {
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
        // Include emoji and custom emojis
        if (
          node instanceof HTMLElement
        && (node.classList.contains('emoji') || node.classList.contains('custom-emoji'))
        ) {
          return NodeFilter.FILTER_ACCEPT;
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
        || currentNode === precedingRange.startContainer || currentNode === precedingRange.endContainer
      ) {
        plainText += textToAdd;
      }
    } else if (currentNode instanceof HTMLElement) {
      if (currentNode.tagName === 'BR' || getComputedStyle(currentNode).display === 'block') {
        plainText += '\n';
      } else if (currentNode.classList.contains('emoji') || currentNode.classList.contains('custom-emoji')) {
        // Append the actual emoji character(s), assuming it's in textContent or alt
        const emojiChar = currentNode.textContent || currentNode.getAttribute('alt') || ''; // Get actual emoji character
        // Ensure the emoji node is within the range before adding its content
        if (
          precedingRange.intersectsNode(currentNode)
          || currentNode === precedingRange.startContainer
          || currentNode === precedingRange.endContainer
        ) {
          plainText += emojiChar;
        }
      }
    }
  }

  // console.log('Preceding plain text:', JSON.stringify(plainText));
  // Calculate length based on Unicode code points, not UTF-16 units.
  return Array.from(plainText).length;
}

export function getPlainTextOffsetsFromRange(container: HTMLElement, ignoreMarkers: boolean = true): SelectionOffsets {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return { start: 0, end: 0 };

  const range = selection.getRangeAt(0);
  if (
    !container.contains(range.startContainer)
    || !container.contains(range.endContainer)
  ) return { start: 0, end: 0 };

  const precedingRangeStart = document.createRange();
  precedingRangeStart.selectNodeContents(container);
  precedingRangeStart.setEnd(range.startContainer, range.startOffset);

  const precedingRangeEnd = document.createRange();
  precedingRangeEnd.selectNodeContents(container);
  precedingRangeEnd.setEnd(range.endContainer, range.endOffset);

  const walker = document.createTreeWalker(
    container,
    // eslint-disable-next-line no-bitwise
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        // Only accept nodes within the preceding range
        if (
          !precedingRangeEnd.intersectsNode(node)
          && !precedingRangeStart.intersectsNode(node)
          && !(node === precedingRangeStart.startContainer && node === precedingRangeStart.endContainer)
          && !(node === precedingRangeEnd.startContainer && node === precedingRangeEnd.endContainer)
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip marker spans
        if (ignoreMarkers && node instanceof HTMLElement && node.classList.contains('md-marker')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Include text nodes
        if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        }
        // Include elements that represent newlines in plain text (e.g., <br>, maybe block elements)
        if (node instanceof HTMLElement && (node.tagName === 'BR' || getComputedStyle(node).display === 'block')) {
          return NodeFilter.FILTER_ACCEPT;
        }
        // Include emoji and custom emojis
        if (
          node instanceof HTMLElement
          && (node.classList.contains('emoji') || node.classList.contains('custom-emoji'))
        ) {
          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_SKIP; // Skip other elements but traverse children
      },
    },
  );

  let currentNode;
  let plainTextStart = '';
  let plainTextEnd = '';

  // eslint-disable-next-line no-cond-assign
  while ((currentNode = walker.nextNode())) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      // Append only the part of the text node that's within the range
      const textNode = currentNode as Text;
      let textToAdd = textNode.textContent || '';

      if (currentNode === precedingRangeStart.startContainer) {
        textToAdd = textToAdd.substring(precedingRangeStart.startOffset);
      }
      if (currentNode === precedingRangeStart.endContainer) {
        textToAdd = textToAdd.substring(0, precedingRangeStart.endOffset);
      }
      // Ensure we only add text if the node is fully or partially selected by the precedingRange
      if (
        precedingRangeStart.intersectsNode(currentNode)
        || currentNode === precedingRangeStart.startContainer || currentNode === precedingRangeStart.endContainer
      ) {
        plainTextStart += textToAdd;
      }

      textToAdd = textNode.textContent || '';
      if (currentNode === precedingRangeEnd.startContainer) {
        textToAdd = textToAdd.substring(precedingRangeEnd.startOffset);
      }
      if (currentNode === precedingRangeEnd.endContainer) {
        textToAdd = textToAdd.substring(0, precedingRangeEnd.endOffset);
      }
      // Ensure we only add text if the node is fully or partially selected by the precedingRange
      if (
        precedingRangeEnd.intersectsNode(currentNode)
        || currentNode === precedingRangeEnd.startContainer || currentNode === precedingRangeEnd.endContainer
      ) {
        plainTextEnd += textToAdd;
      }
    } else if (currentNode instanceof HTMLElement) {
      if (currentNode.tagName === 'BR' || getComputedStyle(currentNode).display === 'block') {
        plainTextStart += '\n';
        plainTextEnd += '\n';
      } else if (currentNode.classList.contains('emoji') || currentNode.classList.contains('custom-emoji')) {
        const emojiChar = currentNode.textContent || currentNode.getAttribute('alt') || ''; // Get actual emoji character

        // Ensure the emoji node is within the range before adding its content
        if (
          precedingRangeStart.intersectsNode(currentNode)
          || currentNode === precedingRangeStart.startContainer
          || currentNode === precedingRangeStart.endContainer
        ) {
          // Append the actual emoji character(s), assuming it's in textContent or alt
          plainTextStart += emojiChar;
        }

        if (
          precedingRangeEnd.intersectsNode(currentNode)
          || currentNode === precedingRangeEnd.startContainer
          || currentNode === precedingRangeEnd.endContainer
        ) {
          // Append the actual emoji character(s), assuming it's in textContent or alt
          plainTextEnd += emojiChar;
        }
      }
    }
  }

  return {
    start: Array.from(plainTextStart).length,
    end: Array.from(plainTextEnd).length,
  };
}

const createSetSelectionTreeWalker = (container: HTMLElement, ignoreMarkers: boolean) => {
  // eslint-disable-next-line no-bitwise
  return document.createTreeWalker(container, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      // Skip marker spans
      if (ignoreMarkers && node instanceof HTMLElement && node.classList.contains('md-marker')) {
        return NodeFilter.FILTER_REJECT;
      }
      // Include text nodes
      if (node.nodeType === Node.TEXT_NODE) {
        return NodeFilter.FILTER_ACCEPT;
      }
      // Include elements that represent newlines in plain text (e.g., <br>, maybe block elements)
      if (
        node instanceof HTMLElement
        && (
          node.tagName === 'BR'
          || getComputedStyle(node).display === 'block'
          // Include emoji and custom emojis
          || node.classList.contains('emoji')
          || node.classList.contains('custom-emoji')
        )
      ) {
        return NodeFilter.FILTER_ACCEPT;
      }

      return NodeFilter.FILTER_SKIP; // Skip other elements but traverse children
    },
  });
};

export function setCaretByPlainTextOffset(
  container: HTMLElement,
  targetOffset: number,
  ignoreMarkers: boolean = true,
): void {
  const selection = window.getSelection();
  if (!selection) return;

  // Create a walker to traverse text and relevant elements
  // eslint-disable-next-line no-bitwise
  const walker = createSetSelectionTreeWalker(container, ignoreMarkers);

  let currentOffset = 0;
  // eslint-disable-next-line no-null/no-null
  let targetNode: Node | null = null;
  let targetNodeOffset = 0;
  // eslint-disable-next-line no-null/no-null
  let lastTextNode: Node | null = null;

  // Traverse nodes until we find the one containing our target offset
  while (walker.nextNode()) {
    const currentNode = walker.currentNode;

    // Handle text nodes
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const textLength = currentNode.textContent?.length || 0;
      lastTextNode = currentNode;

      // Check if this node contains our target offset
      if (currentOffset + textLength >= targetOffset) {
        targetNode = currentNode;
        targetNodeOffset = targetOffset - currentOffset;
        break;
      }
      currentOffset += textLength;
    } else if (currentNode instanceof HTMLElement) {
      // Handle <br> - always counts as one newline
      if (currentNode.tagName === 'BR') {
        if (currentOffset === targetOffset) {
          targetNode = currentNode;
          targetNodeOffset = 0;
          break;
        }
        currentOffset += 1; // Always add 1 for <br>
      } else if (currentNode.classList.contains('emoji') || currentNode.classList.contains('custom-emoji')) {
        const emojiChar = currentNode.textContent || currentNode.getAttribute('alt') || ''; // Get actual emoji character
        const emojiLength = emojiChar.length; // Using standard emoji length as baseline
        if (currentOffset === targetOffset) {
          targetNode = currentNode;
          targetNodeOffset = 0;
          break;
        }
        currentOffset += emojiLength;
      }
    }
  }

  // If we haven't found the target node (offset beyond text length)
  // use the last text node or container itself
  if (!targetNode) {
    if (lastTextNode) {
      targetNode = lastTextNode;
      targetNodeOffset = lastTextNode.textContent?.length || 0;
    } else {
      targetNode = container;
      targetNodeOffset = container.childNodes.length;
    }
  }

  // Create and set the range
  const range = document.createRange();
  range.setStart(targetNode, targetNodeOffset);
  range.setEnd(targetNode, targetNodeOffset);

  selection.removeAllRanges();
  selection.addRange(range);
}

export function setSelectionByPlainTextOffsets(
  container: HTMLElement,
  targetOffsets: SelectionOffsets,
  ignoreMarkers: boolean = true,
  startAfterOpeningMarker: boolean = true,
): void {
  const selection = window.getSelection();
  if (!selection) return;

  // Create a walker to traverse text and relevant elements
  const walker = createSetSelectionTreeWalker(container, ignoreMarkers);

  let currentOffset = 0;
  // eslint-disable-next-line no-null/no-null
  let startNode: Node | null = null;
  let startNodeOffset = 0;
  // eslint-disable-next-line no-null/no-null
  let endNode: Node | null = null;
  let endNodeOffset = 0;
  // eslint-disable-next-line no-null/no-null
  let lastTextNode: Node | null = null;

  // Traverse nodes until we find both target offsets
  while (walker.nextNode()) {
    const currentNode = walker.currentNode;

    // Handle text nodes
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const textLength = currentNode.textContent?.length || 0;
      lastTextNode = currentNode;

      // Check if this node contains our start offset
      if (!startNode && currentOffset + textLength >= targetOffsets.start) {
        startNode = currentNode;
        startNodeOffset = targetOffsets.start - currentOffset;
      }
      // Check if this node contains our end offset
      if (!endNode && currentOffset + textLength >= targetOffsets.end) {
        endNode = currentNode;
        endNodeOffset = targetOffsets.end - currentOffset;
        break; // We found both nodes, we can stop
      }
      currentOffset += textLength;
    } else if (currentNode instanceof HTMLElement) {
      // Handle <br> - always counts as one newline
      if (currentNode.tagName === 'BR') {
        if (!startNode && currentOffset === targetOffsets.start) {
          startNode = currentNode;
          startNodeOffset = 0;
        }
        if (!endNode && currentOffset === targetOffsets.end) {
          endNode = currentNode;
          endNodeOffset = 0;
          break;
        }
        currentOffset += 1; // Always add 1 for <br>
      } else if (currentNode.classList.contains('emoji') || currentNode.classList.contains('custom-emoji')) {
        const emojiChar = currentNode.textContent || currentNode.getAttribute('alt') || ''; // Get actual emoji character
        const emojiLength = emojiChar.length; // Using standard emoji length as baseline
        if (!startNode && currentOffset === targetOffsets.start) {
          startNode = currentNode;
          startNodeOffset = 0;
        }
        if (!endNode && currentOffset === targetOffsets.end) {
          endNode = currentNode;
          endNodeOffset = 0;
          break;
        }
        currentOffset += emojiLength;
      }
    }
  }

  // If we haven't found the nodes (offsets beyond text length)
  // use the last text node or container itself
  if (!startNode || !endNode) {
    if (lastTextNode) {
      if (!startNode) {
        startNode = lastTextNode;
        startNodeOffset = lastTextNode.textContent?.length || 0;
      }
      if (!endNode) {
        endNode = lastTextNode;
        endNodeOffset = lastTextNode.textContent?.length || 0;
      }
    } else {
      if (!startNode) {
        startNode = container;
        startNodeOffset = container.childNodes.length;
      }
      if (!endNode) {
        endNode = container;
        endNodeOffset = container.childNodes.length;
      }
    }
  }

  // Handle startAfterOpeningMarker logic
  if (startAfterOpeningMarker && startNode && endNode) {
    // Determine which node comes first in the DOM
    const nodeComparison = startNode.compareDocumentPosition(endNode);
    let nodeToAdjust: Node;
    let offsetToAdjust: number;

    // eslint-disable-next-line no-bitwise
    if (nodeComparison & Node.DOCUMENT_POSITION_FOLLOWING) {
      // startNode comes first
      nodeToAdjust = startNode;
      offsetToAdjust = startNodeOffset;
    } else {
      // endNode comes first
      nodeToAdjust = endNode;
      offsetToAdjust = endNodeOffset;
    }

    // Only proceed if we're not already at the start of a text node
    if (offsetToAdjust !== 0 || nodeToAdjust.nodeType !== Node.TEXT_NODE) {
      // Create a walker to traverse text and relevant elements
      const correctionWalker = createSetSelectionTreeWalker(container, ignoreMarkers);
      // Position walker at our current node
      correctionWalker.currentNode = nodeToAdjust;

      // Get the next text node
      const nextTextNode = correctionWalker.nextNode();

      if (nextTextNode) {
        // Update the appropriate node and offset
        // eslint-disable-next-line no-bitwise
        if (nodeComparison & Node.DOCUMENT_POSITION_FOLLOWING) {
          startNode = nextTextNode;
          startNodeOffset = 0;
        } else {
          endNode = nextTextNode;
          endNodeOffset = 0;
        }
      }
    }
  }

  // Create and set the range
  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);

  selection.removeAllRanges();
  selection.addRange(range);
}
