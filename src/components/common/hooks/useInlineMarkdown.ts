import { useEffect, useRef } from '../../../lib/teact/teact';

import type { Signal } from '../../../util/signals';

import { parseHtmlAsFormattedTextWithSelection } from '../../../util/parseHtmlAsFormattedText';
import { getTextWithEntitiesAsHtml } from '../helpers/renderTextWithEntities';

import useDebouncedCallback from '../../../hooks/useDebouncedCallback';

const getCaretCharacterOffsets = (el: HTMLElement) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { start: 0, end: 0 };

  const range = sel.getRangeAt(0);

  const secondRange = document.createRange();
  secondRange.selectNodeContents(el);
  secondRange.setEnd(range.startContainer, range.startOffset);
  const start = secondRange.toString().length;
  secondRange.setEnd(range.endContainer, range.endOffset);
  const end = secondRange.toString().length;

  return { start, end };
};

const setCaretCharacterOffsets = (el: HTMLElement, start: number, end: number) => {
  let charCount = 0;
  let startNode: Node | undefined;
  let startOffset = 0;
  let endNode: Node | undefined;
  let endOffset = 0;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const nodeLength = node.textContent?.length || 0;

    if (startNode === undefined && charCount + nodeLength >= start) {
      startNode = node;
      startOffset = start - charCount;
    }

    if (endNode === undefined && charCount + nodeLength >= end) {
      endNode = node;
      endOffset = end - charCount;
      break;
    }

    charCount += nodeLength;
  }

  // Fallback to end of element if nodes not found
  if (!startNode) {
    startNode = el;
    startOffset = el.childNodes.length;
  }
  if (!endNode) {
    endNode = el;
    endOffset = el.childNodes.length;
  }

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
};

const getCaretSelection = (el: HTMLElement): { start: number; end: number } => {
  const { start, end } = getCaretCharacterOffsets(el);

  return { start, end };
};

const restoreCaretSelection = (
  el: HTMLElement,
  cursorPosition: { start: number; end: number },
  cb: () => void,
) => {
  const { start, end } = cursorPosition;

  // Wait for DOM updates to complete
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cb();
      setCaretCharacterOffsets(el, start, end);
    });
  });
};

const useInlineMarkdown = ({
  getHtml,
  setHtml,
  editableInputId,
}: {
  getHtml: Signal<string>;
  setHtml: (html: string) => void;
  editableInputId: string;
}) => {
  const restored = useRef(false);

  const handleSelectionChange = useDebouncedCallback(() => {
    if (restored.current === true) {
      restored.current = false;
      return;
    }
    const composerElement = document.getElementById(editableInputId);
    if (!composerElement) {
      return;
    }

    const caretSelection = getCaretSelection(composerElement);

    const currentHtml = getHtml();
    // const parsed = parseHtmlAsFormattedText(currentHtml, 'handleSelectionChange');
    const parsed = parseHtmlAsFormattedTextWithSelection(currentHtml, caretSelection);
    const newHtml = getTextWithEntitiesAsHtml(parsed);

    if (currentHtml !== newHtml) {
      setHtml(newHtml);
      restoreCaretSelection(composerElement, caretSelection, () => {
        restored.current = true;
      });
    }
  }, [getHtml, setHtml, editableInputId], 300, true, false);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);
};

export default useInlineMarkdown;
