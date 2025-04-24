import { useCallback, useEffect, useRef } from '../../../lib/teact/teact';

import type { LiveFormat } from '../../../types';
import type { Signal } from '../../../util/signals';

import { computeMarkerVisibility } from '../../../util/ast/markerVisibility';
import {
  parseMarkdownHtmlToEntities,
  parseMarkdownHtmlToEntitiesWithCursorSelection,
} from '../../../util/ast/parseMdAsFormattedText';
import { getPlainTextOffsetFromRange } from '../../../util/ast/plainTextOffset';
import { getTextWithEntitiesAsHtml } from '../helpers/renderTextWithEntities';

const EDIT_KEYS = ['*', '_', '~', '`', '|', '+', '>', '\n', '[', ']', '(', ')'];
const DELETE_KEYS = ['Backspace', 'Delete'];
const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

const COMBO_KEY = 'f';

export const getCaretCharacterOffsets = (el: HTMLElement): { start: number; end: number } => {
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

export const setCaretCharacterOffsets = (el: HTMLElement, start: number, end: number): void => {
  // Clamp start and end to valid range
  const max = el.textContent?.length || 0;
  start = Math.max(0, Math.min(start, max));
  end = Math.max(0, Math.min(end, max));

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

const getCursorSelection = (el: HTMLElement): { start: number; end: number } => {
  const { start, end } = getCaretCharacterOffsets(el);

  return { start, end };
};

const restoreCursorSelection = (
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

const useLiveFormatting = ({
  getHtml,
  setHtml,
  editableInputId,
  liveFormat,
}: {
  getHtml: Signal<string>;
  setHtml: (html: string) => void;
  editableInputId: string;
  liveFormat: LiveFormat;
}) => {
  const restored = useRef(false);
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLElement | null>(null);

  const clearRawMarkersMode = useCallback(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    const cursor = getCursorSelection(el);
    const html = getHtml();
    const { formattedText, newSelection } = parseMarkdownHtmlToEntitiesWithCursorSelection(html, cursor);
    const cleanHtml = getTextWithEntitiesAsHtml(formattedText);
    if (cleanHtml !== html) {
      setHtml(cleanHtml);
      restoreCursorSelection(el, newSelection, () => { restored.current = true; });
    }
  }, [getHtml, setHtml]);

  // Toggle visibility of markers based on caret position
  const showRawMarkers = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel?.isCollapsed || !sel.anchorNode || !el.contains(sel.anchorNode)) return;
    const domCaret = getCaretCharacterOffsets(el);
    const plainTextStartOffset = getPlainTextOffsetFromRange(el);
    const plainTextCaret = { start: plainTextStartOffset, end: plainTextStartOffset };
    const currentHtml = el.innerHTML;
    const { formattedText } = parseMarkdownHtmlToEntitiesWithCursorSelection(currentHtml, domCaret);
    const entities = formattedText.entities ?? [];
    const visibleIndexes = computeMarkerVisibility(entities, plainTextCaret);
    const markerSpans = el.querySelectorAll<HTMLElement>('.md-marker[data-entity-index]');
    markerSpans.forEach((markerSpan) => {
      const idx = Number(markerSpan.dataset.entityIndex);
      // Toggle the '.visible' class based on the computed visibility for this entity index
      markerSpan.classList.toggle('visible', visibleIndexes.includes(idx));
    });
  }, []);

  const applyInlineEdit = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;

    const sel = window.getSelection();
    // Only proceed if selection is collapsed and within the editor
    if (!sel?.isCollapsed || !el.contains(sel.anchorNode)) return;

    // 1. Get current state
    const cursor = getCaretCharacterOffsets(el);
    const currentHtml = el.innerHTML; // Use innerHTML directly for comparison later

    // 2. Parse the current HTML to get the intended formatted text structure
    // parseMarkdownHtmlToEntities internally cleans HTML and parses raw markdown features
    const formattedText = parseMarkdownHtmlToEntities(currentHtml);

    // 3. Render the formatted text back to HTML with markers enabled for all entities
    const entityIndexes = (formattedText.entities ?? []).map((_, i) => i);
    const newHtml = getTextWithEntitiesAsHtml(formattedText, { rawEntityIndexes: entityIndexes });

    // 4. Compare and update if necessary
    if (newHtml !== currentHtml) {
      // Update the state/DOM
      setHtml(newHtml); // Use the provided state setter

      // Restore selection using the cursor position captured *before* parsing/rendering
      // Use a minimal callback for restoreCursorSelection as showRawMarkers is called next
      restoreCursorSelection(el, cursor, () => {});

      // Ensure markers are updated after DOM change and caret restoration
      // Use requestAnimationFrame to ensure DOM is settled before querying markers
      requestAnimationFrame(() => {
        showRawMarkers();
      });
    } else {
      // Even if HTML didn't change, marker visibility might need update based on cursor move
      requestAnimationFrame(() => showRawMarkers());
    }
  }, [setHtml, showRawMarkers]); // Removed getHtml dependency as we use el.innerHTML

  useEffect(() => {
    inputRef.current = document.getElementById(editableInputId);
  }, [editableInputId]);

  useEffect(() => {
    if (liveFormat !== 'on' || !inputRef.current) {
      return;
    }

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (EDIT_KEYS.includes(e.key)) {
        applyInlineEdit();
      } else if (DELETE_KEYS.includes(e.key)) {
        applyInlineEdit();
      } else if (NAV_KEYS.includes(e.key)) {
        // applyInlineEdit();
        showRawMarkers();
      }
    };

    const handleMouseUp = (): void => {
      applyInlineEdit();
      showRawMarkers();
    };

    const handleBlur = (): void => {
      clearRawMarkersMode();
    };

    const handleFocus = (): void => {
      applyInlineEdit();
      showRawMarkers();
    };

    // Handle window focus events to update markdown when returning to the app
    const handleWindowFocus = (): void => {
      if (document.activeElement === inputRef.current) {
        applyInlineEdit();
        showRawMarkers();
      }
    };

    inputRef.current.addEventListener('keyup', handleKeyUp);
    inputRef.current.addEventListener('mouseup', handleMouseUp);
    inputRef.current.addEventListener('blur', handleBlur);
    inputRef.current.addEventListener('focus', handleFocus);
    window.addEventListener('focus', handleWindowFocus);

    // eslint-disable-next-line consistent-return
    return () => {
      if (!inputRef.current) {
        return;
      }
      inputRef.current.removeEventListener('keyup', handleKeyUp);
      inputRef.current.removeEventListener('mouseup', handleMouseUp);
      inputRef.current.removeEventListener('blur', handleBlur);
      inputRef.current.removeEventListener('focus', handleFocus);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [editableInputId, getHtml, setHtml, applyInlineEdit, showRawMarkers, clearRawMarkersMode, liveFormat]);

  useEffect(() => {
    if (liveFormat !== 'combo' || !inputRef.current) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (liveFormat === 'combo' && e.key.toLowerCase() === COMBO_KEY && (e.metaKey || e.ctrlKey) && e.altKey) {
        applyInlineEdit();
      }
    };

    inputRef.current.addEventListener('keydown', handleKeyDown);

    // eslint-disable-next-line consistent-return
    return () => {
      if (!inputRef.current) {
        return;
      }
      inputRef.current.removeEventListener('keydown', handleKeyDown);
    };
  }, [editableInputId, applyInlineEdit, liveFormat]);

  return { applyInlineEdit, clearRawMarkersMode };
};

export default useLiveFormatting;
