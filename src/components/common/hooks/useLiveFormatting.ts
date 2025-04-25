import { useCallback, useEffect, useRef } from '../../../lib/teact/teact';

import type { LiveFormat } from '../../../types';
import type { Signal } from '../../../util/signals';

import { computeMarkerVisibility } from '../../../util/ast/markerVisibility';
import {
  parseMarkdownHtmlToEntities,
  parseMarkdownHtmlToEntitiesWithCursorSelection,
} from '../../../util/ast/parseMdAsFormattedText';
import { getPlainTextOffsetFromRange } from '../../../util/ast/plainTextOffset';
import { getTextWithEntitiesAsHtml, WRAPPER_CLASS_TO_MARKER_PATTERN } from '../helpers/renderTextWithEntities';

const EDIT_KEYS = ['*', '_', '~', '`', '|', '+', '>', '\n', '[', ']', '(', ')'];
const DELETE_KEYS = ['Backspace', 'Delete'];
const NAV_KEYS = [
  'ArrowLeft',
  'Left', // IE/Edge
  'ArrowRight',
  'Right', // IE/Edge
  'ArrowUp',
  'Up', // IE/Edge
  'ArrowDown',
  'Down', // IE/Edge
  'Home',
  'End',
  'PageUp',
  'PageDown',
];

const COMBO_KEY = 'f';

/**
 * Call only for some class list that for sure contains md-marker class
 */
const getPatternByClassList = (classList: DOMTokenList): string => {
  for (const className of classList) {
    const pattern = WRAPPER_CLASS_TO_MARKER_PATTERN[className];
    if (pattern) return pattern;
  }

  // Should never happen if called after finding out that some marker is present
  return '';
};

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
    if (!el) return;
    const cursor = getCursorSelection(el);
    const html = getHtml();
    const { formattedText, newSelection } = parseMarkdownHtmlToEntitiesWithCursorSelection(html, cursor);
    const cleanedHtml = getTextWithEntitiesAsHtml(formattedText);
    if (cleanedHtml !== html) {
      setHtml(cleanedHtml);
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
      const visible = visibleIndexes.includes(idx);
      markerSpan.classList.toggle('visible', visible);

      // TODO HERE! Change text content from "zero-length spaces" to marker specific chars
      // const pattern = getPatternByClassList(markerSpan.classList);
      // if (visible) {
      //   markerSpan.textContent = pattern;
      // } else {
      //   markerSpan.textContent = '';
      // }
    });
  }, []);

  // If selection is inside of a ".md-marker[data-entity-index]" marker, move caret in the same direction as the key
  const moveAroundNavWrapperMarkers = useCallback((event?: KeyboardEvent) => {
    const el = inputRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel?.isCollapsed || !sel.anchorNode || !el.contains(sel.anchorNode)) return;

    const isKeyboardEvent = event && 'key' in event;

    if (sel.anchorNode.parentElement?.classList.contains('md-marker')) {
      // Return early if it's on the edge of the marker
      const anchorTextLength = sel.anchorNode.textContent?.length || 0;
      if (sel.anchorOffset === 0 || sel.anchorOffset === anchorTextLength || !anchorTextLength) return;

      // Move the selection caret in the same direction as the key
      let newNodePosition: number;
      if (!isKeyboardEvent) {
        newNodePosition = 0;
      } else {
        switch (event.key) {
          case 'ArrowUp':
          case 'ArrowLeft':
          case 'PageUp':
          case 'Home':
            newNodePosition = 0;
            break;
          case 'ArrowDown':
          case 'ArrowRight':
          case 'PageDown':
          case 'End':
            newNodePosition = anchorTextLength;
            break;
          default:
            return;
        }
      }

      const range = document.createRange();
      range.setStart(sel.anchorNode, newNodePosition);
      range.setEnd(sel.anchorNode, newNodePosition);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, []);

  const applyInlineEdit = useCallback((isDelete?: boolean) => {
    const el = inputRef.current;
    if (!el) return;

    const sel = window.getSelection();
    // Only proceed if selection is collapsed and within the editor
    if (!sel?.isCollapsed || !el.contains(sel.anchorNode)) return;

    // 1. Get current state
    const cursor = getCaretCharacterOffsets(el);
    const currentHtml = el.innerHTML; // Use innerHTML directly for comparison later
    console.log('ApplyInlineEdit - Initial HTML:', currentHtml); // DEBUG

    // 2. Parse the current HTML to get the intended formatted text structure
    // parseMarkdownHtmlToEntities internally cleans HTML and parses raw markdown features
    const formattedText = parseMarkdownHtmlToEntities(currentHtml);
    let entities = formattedText.entities;
    console.log('ApplyInlineEdit - Parsed Text:', formattedText.text); // DEBUG
    console.log('ApplyInlineEdit - Parsed Entities:', JSON.stringify(entities)); // DEBUG

    // 3. If delete, process delete - if the deleted char is a part of a marker, remove corresponding entity
    if (isDelete && entities) {
      // Keep track of the status of start/end spans for each entity index found in the DOM
      const spanStatus = new Map<number, { startOk?: boolean; endOk?: boolean }>();

      // Traverse the current DOM state AFTER deletion
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
      let currentNode;
      // eslint-disable-next-line no-cond-assign
      while (currentNode = walker.nextNode()) {
        if (
          currentNode instanceof HTMLElement
          && currentNode.classList.contains('md-marker')
          && currentNode.dataset.entityIndex
        ) {
          const entityIndex = Number(currentNode.dataset.entityIndex);
          if (Number.isNaN(entityIndex)) continue; // Skip if index is invalid

          const pattern = getPatternByClassList(currentNode.classList);
          const isOk = currentNode.textContent === pattern;
          const position = currentNode.dataset.pos; // 'start' or 'end'

          if (!spanStatus.has(entityIndex)) {
            spanStatus.set(entityIndex, {});
          }
          const status = spanStatus.get(entityIndex)!;

          if (position === 'start') {
            status.startOk = isOk;
          } else if (position === 'end') {
            status.endOk = isOk;
          }
        }
      }

      // Filter entities: Keep only those where BOTH spans were found and OK
      entities = entities.filter((_entity, index) => {
        const status = spanStatus.get(index);
        // Keep if status exists AND both startOk and endOk are true
        // (Assumes entities without marker spans like links should always be kept here)
        // TODO: Need to handle entities that don't render marker spans (like links, emails, mentions) -
        // they should probably always be kept by this deletion logic.
        // For now, only filter if status is found (i.e., it's an entity with markers)
        if (status) {
          return status.startOk === true && status.endOk === true;
        } else {
          // If no status found (e.g. link, or spans were totally deleted), keep it for now.
          // A more robust solution might involve checking entity type here.
          return true;
        }
      });

      console.log('ApplyInlineEdit - Span Status after delete:', Object.fromEntries(spanStatus)); // DEBUG
      console.log('ApplyInlineEdit - Filtered Entities (new logic):', JSON.stringify(entities)); // DEBUG
    }

    // 4. Render the formatted text back to HTML with markers enabled for all entities
    const entityIndexes = (entities ?? []).map((_, i) => i);

    const newHtml = getTextWithEntitiesAsHtml(
      { text: formattedText.text, entities }, { rawEntityIndexes: entityIndexes },
    );
    console.log('ApplyInlineEdit - New HTML for setHtml:', newHtml); // DEBUG
    const htmlChanged = newHtml !== currentHtml;

    if (htmlChanged) {
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
        applyInlineEdit(true);
      } else if (NAV_KEYS.includes(e.key)) {
        // Could move this to onkeyDown, but handling would be a lot more complicated
        moveAroundNavWrapperMarkers(e);
        showRawMarkers();
      }
    };

    const handleMouseUp = (): void => {
      moveAroundNavWrapperMarkers();
      applyInlineEdit();
    };

    const handleBlur = (): void => {
      clearRawMarkersMode();
    };

    const handleFocus = (): void => {
      moveAroundNavWrapperMarkers();
      applyInlineEdit();
    };

    // Handle window focus events to update markdown when returning to the app
    const handleWindowFocus = (): void => {
      if (document.activeElement === inputRef.current) {
        moveAroundNavWrapperMarkers();
        applyInlineEdit();
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
  }, [editableInputId, getHtml, setHtml, applyInlineEdit,
    showRawMarkers, clearRawMarkersMode, moveAroundNavWrapperMarkers, liveFormat]);

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
