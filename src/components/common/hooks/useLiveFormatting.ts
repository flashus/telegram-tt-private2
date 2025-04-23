import { useCallback, useEffect, useRef } from '../../../lib/teact/teact';

import type { LiveFormat } from '../../../types';
import type { Signal } from '../../../util/signals';
import { ApiMessageEntityTypes } from '../../../api/types';

import { parseHtmlAsFormattedTextWithCursorSelection } from '../../../util/parseHtmlAsFormattedText';
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

// Map HTML tag names to ApiMessageEntityTypes
// const formattingTagEntityType: Record<string, ApiMessageEntityTypes> = {
//   B: ApiMessageEntityTypes.Bold,
//   STRONG: ApiMessageEntityTypes.Bold,
//   I: ApiMessageEntityTypes.Italic,
//   EM: ApiMessageEntityTypes.Italic,
//   INS: ApiMessageEntityTypes.Underline,
//   U: ApiMessageEntityTypes.Underline,
//   S: ApiMessageEntityTypes.Strike,
//   STRIKE: ApiMessageEntityTypes.Strike,
//   DEL: ApiMessageEntityTypes.Strike,
//   CODE: ApiMessageEntityTypes.Code,
//   PRE: ApiMessageEntityTypes.Pre,
//   BLOCKQUOTE: ApiMessageEntityTypes.Blockquote,
// };

// // Determine focused entities directly from DOM to avoid offset mismatches caused by existing raw markers
// const detectFocusedEntities = (selection: Selection, inputElement: HTMLElement): ApiMessageEntityTypes[] => {
//   if (!selection?.anchorNode) return [];
//   let node: Node | null = selection.anchorNode;
//   // If caret is inside a marker span – treat as outside any entity
//   if ((node as HTMLElement).parentElement?.classList.contains('md-marker')) {
//     return [];
//   }
//   // If caret is exactly at the start of wrapper (<span class="md-wrapper">) consider it outside
//   // if ((node as HTMLElement).parentElement?.classList.contains('md-wrapper') && selection.anchorOffset === 0) {
//   //   return [];
//   // }
//   const types: ApiMessageEntityTypes[] = [];
//   // Walk up until we reach the editable element
//   while (node && node !== inputElement) {
//     if (node.nodeType === Node.ELEMENT_NODE) {
//       const tag = (node as HTMLElement).tagName;
//       switch (tag) {
//         case 'B':
//         case 'STRONG':
//           types.push(ApiMessageEntityTypes.Bold);
//           break;
//         case 'I':
//         case 'EM':
//           types.push(ApiMessageEntityTypes.Italic);
//           break;
//         case 'U':
//         case 'INS':
//           types.push(ApiMessageEntityTypes.Underline);
//           break;
//         case 'S':
//         case 'STRIKE':
//         case 'DEL':
//           types.push(ApiMessageEntityTypes.Strike);
//           break;
//         case 'CODE':
//           types.push(ApiMessageEntityTypes.Code);
//           break;
//         case 'PRE':
//           types.push(ApiMessageEntityTypes.Pre);
//           break;
//         case 'BLOCKQUOTE':
//           types.push(ApiMessageEntityTypes.Blockquote);
//           break;
//         default:
//       }
//     }
//     node = node.parentNode;
//   }
//   return types;
// };

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
  const lastFocusedEntitiesRef = useRef<ApiMessageEntityTypes[]>([]);
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLElement | null>(null);

  const clearRawMarkersMode = useCallback(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    const cursor = getCursorSelection(el);
    const html = getHtml();
    const { formattedText, newSelection } = parseHtmlAsFormattedTextWithCursorSelection(html, cursor);
    const cleanHtml = getTextWithEntitiesAsHtml(formattedText);
    if (cleanHtml !== html) {
      setHtml(cleanHtml);
      restoreCursorSelection(el, newSelection, () => { restored.current = true; });
    }
  }, [getHtml, setHtml]);

  const applyInlineEdit = useCallback(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    const sel = window.getSelection();
    if (!sel?.isCollapsed || !el.contains(sel.anchorNode)) {
      return;
    }
    const cursor = getCaretCharacterOffsets(el);
    const html = getHtml();
    const { formattedText, newSelection, focusedEntities } = parseHtmlAsFormattedTextWithCursorSelection(html, cursor);
    const newHtml = getTextWithEntitiesAsHtml(formattedText, { rawMarkersFor: focusedEntities });
    if (newHtml !== html) {
      // Replace entire content
      setHtml(newHtml);
      // Detect whether raw markers are being added or removed to adjust caret accordingly
      const hadMarkers = html.includes('class="md-marker"');
      const willHaveMarkers = newHtml.includes('class="md-marker"');

      const markerLengths: Record<ApiMessageEntityTypes, number> = {
        [ApiMessageEntityTypes.Bold]: 2,
        [ApiMessageEntityTypes.Italic]: 2,
        [ApiMessageEntityTypes.Underline]: 2,
        [ApiMessageEntityTypes.Strike]: 2,
        [ApiMessageEntityTypes.Spoiler]: 2,
        [ApiMessageEntityTypes.Code]: 1,
        [ApiMessageEntityTypes.Blockquote]: 1,
        [ApiMessageEntityTypes.Pre]: 3,
        [ApiMessageEntityTypes.BotCommand]: 0,
        [ApiMessageEntityTypes.Cashtag]: 0,
        [ApiMessageEntityTypes.Email]: 0,
        [ApiMessageEntityTypes.Hashtag]: 0,
        [ApiMessageEntityTypes.Mention]: 0,
        [ApiMessageEntityTypes.MentionName]: 0,
        [ApiMessageEntityTypes.Phone]: 0,
        [ApiMessageEntityTypes.Url]: 0,
        [ApiMessageEntityTypes.CustomEmoji]: 0,
        [ApiMessageEntityTypes.Timestamp]: 0,
        [ApiMessageEntityTypes.Unknown]: 0,
        [ApiMessageEntityTypes.TextUrl]: 0,
      };

      let shift = 0;
      if (!hadMarkers && willHaveMarkers) { // Markers are being added
        shift = focusedEntities.reduce((sum, type) => sum + (markerLengths[type] || 0), 0);
      } else if (hadMarkers && !willHaveMarkers) { // Markers are being removed
        shift = -lastFocusedEntitiesRef.current.reduce((sum, type) => sum + (markerLengths[type] || 0), 0);
      }
      // Persist last focused entities for future shift calculations
      lastFocusedEntitiesRef.current = willHaveMarkers ? focusedEntities : [];

      const adjustedSelection = { start: newSelection.start + shift, end: newSelection.end + shift };
      // Restore selection at adjusted position
      restoreCursorSelection(el, adjustedSelection, () => {});
    }
  }, [getHtml, setHtml]);

  const showRawMarkers = useCallback(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    const sel = window.getSelection();
    if (!sel?.isCollapsed || !el.contains(sel.anchorNode)) {
      return;
    }
    const cursor = getCaretCharacterOffsets(el);
    const html = getHtml();

    // Parse formatted text and detect focused entities using cursor selection
    const parseRes = parseHtmlAsFormattedTextWithCursorSelection(html, cursor);
    let focusedEntities = parseRes.focusedEntities;
    const { formattedText, newSelection } = parseRes;
    // If caret remains inside a raw-marker wrapper, retain previous focus to keep markers
    const wrapper = sel.anchorNode?.parentElement?.closest('.md-wrapper');
    if (wrapper) {
      focusedEntities = lastFocusedEntitiesRef.current;
    }

    const newHtml = getTextWithEntitiesAsHtml(formattedText, { rawMarkersFor: focusedEntities });
    if (newHtml !== html) {
      setHtml(newHtml);
      // Detect addition/removal of markers between previous and next HTML
      const hadMarkers = html.includes('class="md-marker"');
      const willHaveMarkers = newHtml.includes('class="md-marker"');

      const markerLengths: Record<ApiMessageEntityTypes, number> = {
        [ApiMessageEntityTypes.Bold]: 2,
        [ApiMessageEntityTypes.Italic]: 2,
        [ApiMessageEntityTypes.Underline]: 2,
        [ApiMessageEntityTypes.Strike]: 2,
        [ApiMessageEntityTypes.Spoiler]: 2,
        [ApiMessageEntityTypes.Code]: 1,
        [ApiMessageEntityTypes.Blockquote]: 1,
        [ApiMessageEntityTypes.Pre]: 3,
        [ApiMessageEntityTypes.BotCommand]: 0,
        [ApiMessageEntityTypes.Cashtag]: 0,
        [ApiMessageEntityTypes.Email]: 0,
        [ApiMessageEntityTypes.Hashtag]: 0,
        [ApiMessageEntityTypes.Mention]: 0,
        [ApiMessageEntityTypes.MentionName]: 0,
        [ApiMessageEntityTypes.Phone]: 0,
        [ApiMessageEntityTypes.Url]: 0,
        [ApiMessageEntityTypes.CustomEmoji]: 0,
        [ApiMessageEntityTypes.Timestamp]: 0,
        [ApiMessageEntityTypes.Unknown]: 0,
        [ApiMessageEntityTypes.TextUrl]: 0,
      };

      let shift = 0;
      if (!hadMarkers && willHaveMarkers) {
        shift = focusedEntities.reduce((sum, type) => sum + (markerLengths[type] || 0), 0);
      } else if (hadMarkers && !willHaveMarkers) {
        shift = -lastFocusedEntitiesRef.current.reduce((sum, type) => sum + (markerLengths[type] || 0), 0);
      }
      // Persist last focused entities for future shift calculations
      lastFocusedEntitiesRef.current = willHaveMarkers ? focusedEntities : [];

      const adjustedSelection = { start: newSelection.start + shift, end: newSelection.end + shift };
      restoreCursorSelection(el, adjustedSelection, () => {});
    }
  }, [getHtml, setHtml]);

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
        const el = inputRef.current;
        if (!el) {
          return;
        }
        const sel = window.getSelection();
        if (!sel?.isCollapsed || !sel.anchorNode || !el.contains(sel.anchorNode)) {
          return;
        }
        const node = sel.anchorNode;
        const offset = sel.anchorOffset;
        // Deleting at end of a formatted segment: remove its wrapper directly
        if (
          node.nodeType === Node.TEXT_NODE
          && node.parentElement
          && offset === (node.textContent?.length ?? 0)
        ) {
          const wrapper = (node.parentElement as HTMLElement).closest('.md-wrapper');
          if (wrapper) {
            // Extract only the formatted text (inner <b>,<i>, etc.)
            const fmtEl = wrapper.querySelector('b,strong,i,em,u,ins,s,strike,del,code,pre,blockquote');
            const txt = fmtEl?.textContent ?? wrapper.textContent ?? '';
            const txtNode = document.createTextNode(txt);
            wrapper.parentNode!.replaceChild(txtNode, wrapper);
            // Persist updated HTML and restore caret
            setHtml(el.innerHTML);
            const pos = getCaretCharacterOffsets(el).start;
            setCaretCharacterOffsets(el, pos, pos);
            return;
          }
        }
        // Default deletion: update formatting and refresh markers
        applyInlineEdit();
        showRawMarkers();
      } else if (NAV_KEYS.includes(e.key)) {
        showRawMarkers();
      }
    };

    const handleMouseUp = (): void => {
      applyInlineEdit();
    };

    const handleBlur = (): void => {
      clearRawMarkersMode();
    };

    inputRef.current.addEventListener('keyup', handleKeyUp);
    inputRef.current.addEventListener('mouseup', handleMouseUp);
    inputRef.current.addEventListener('blur', handleBlur);
    // eslint-disable-next-line consistent-return
    return () => {
      if (!inputRef.current) {
        return;
      }
      inputRef.current.removeEventListener('keyup', handleKeyUp);
      inputRef.current.removeEventListener('mouseup', handleMouseUp);
      inputRef.current.removeEventListener('blur', handleBlur);
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
