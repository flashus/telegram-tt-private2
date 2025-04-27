import { useCallback, useEffect, useRef } from '../../../lib/teact/teact';

import type { ApiMessageEntity, ApiMessageEntityTypes } from '../../../api/types';
import type { ILiveFormatSettings } from '../../../types';
import type { SelectionOffsets } from '../../../util/ast/plainTextOffset';
import type { Signal } from '../../../util/signals';

import { computeMarkerVisibility, computeMarkerVisibilitySelection } from '../../../util/ast/markerVisibility';
import {
  parseMarkdownHtmlToEntities,
  parseMarkdownHtmlToEntitiesWithCaret,
  parseMarkdownHtmlToEntitiesWithSelection,
} from '../../../util/ast/parseMdAsFormattedText';
import {
  getPlainTextOffsetFromRange,
  getPlainTextOffsetsFromRange,
  setCaretByPlainTextOffset,
  setSelectionByPlainTextOffsets,
} from '../../../util/ast/plainTextOffset';
import {
  getTextWithEntitiesAsHtml,
  WRAPPER_CLASS_TO_MARKER_PATTERN,
} from '../helpers/renderTextWithEntities';

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

export type ApplyInlineEditFn = (isDelete?: boolean) => void;
export type ApplyInlineEditForSelectionFn = (
  {
    isDelete,
    knownSelectionOffsets,
    additionalEntities,
    entityTypesToRemoveFromSelection,
    onSelectionRestore,
    forceSelectionRestore,
  } : {
    isDelete?: boolean;
    knownSelectionOffsets?: SelectionOffsets;
    additionalEntities?: ApiMessageEntity[];
    entityTypesToRemoveFromSelection?: ApiMessageEntityTypes[];
    onSelectionRestore?: () => void;
    forceSelectionRestore?: boolean;
  },
) => void;

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

// const getMarkerAccumulatedLength = (
//   entities: ApiMessageEntity[],
//   visibleEntityIndexes: number[],
//   keepMarkerWidth: boolean,
//   caretOffset: number,
// ): number => {
//   // 1. Traverse the entities
//   // 1.1. For each entity, check if caretOffset is on the left of it or inside or right of it
//   // 1.2. If inside, add corresponding entity marker length to accumulated length
//   // 1.3. If on the right, add double entity marker length to accumulated length
//   // 2. Return accumulated length
//   // It is not guaranteed that entities are sorted by offset

//   let accumulatedLength = 0;
//   for (let i = 0; i < entities.length; i++) {
//     if (!keepMarkerWidth && !visibleEntityIndexes.includes(i)) {
//       continue;
//     }
//     const entity = entities[i];
//     const entityStartOffset = entity.offset;
//     const entityEndOffset = entity.offset + entity.length;

//     if (caretOffset < entityStartOffset) {
//       continue;
//     } else if (caretOffset >= entityEndOffset) {
//       const marker = ENTITY_TYPE_TO_MARKER_PATTERN[entity.type];
//       if (marker) {
//         accumulatedLength += marker.length * 2;
//       }
//       continue;
//     // } else if (caretOffset >= entityStartOffset) {
//     } else {
//       const marker = ENTITY_TYPE_TO_MARKER_PATTERN[entity.type];
//       if (marker) {
//         accumulatedLength += marker.length;
//       }
//     }
//   }
//   return accumulatedLength;
// };

class SelectionRestorerSingleton {
  private lastRequestId = 0; // <-- version counter

  public static instance: SelectionRestorerSingleton;

  public static getInstance() {
    if (!this.instance) {
      this.instance = new SelectionRestorerSingleton();
    }
    return this.instance;
  }

  /** Call this to restore caret position */
  public restoreCaretOffset(
    el: HTMLElement,
    caretOffset: number,
    ignoreMarkers = false,
    cb?: () => void,
  ) {
    // Bump the request counter
    const localRequestId = ++this.lastRequestId;

    // Flickering seems fixed by calling setCaretCharacterOffsets in three frames in a row
    setCaretByPlainTextOffset(el, caretOffset, ignoreMarkers);
    cb?.();

    requestAnimationFrame(() => {
      // If there was a new call for restoreCaretOffset - previous calls must be superseded
      if (this.lastRequestId !== localRequestId) return;
      setCaretByPlainTextOffset(el, caretOffset, ignoreMarkers);
      cb?.();

      requestAnimationFrame(() => {
        // If there was a new call for restoreCaretOffset - previous calls must be superseded
        if (this.lastRequestId !== localRequestId) return;
        setCaretByPlainTextOffset(el, caretOffset, ignoreMarkers);
        cb?.();

        this.lastRequestId = 0;
      });
    });
  }

  public restoreSelectionOffsets(
    el: HTMLElement,
    offsets: SelectionOffsets,
    ignoreMarkers = false,
    cb?: () => void,
  ) {
    // Bump the request counter
    const localRequestId = ++this.lastRequestId;

    setSelectionByPlainTextOffsets(el, offsets, ignoreMarkers);
    cb?.();

    requestAnimationFrame(() => {
      // If there was a new call for restoreSelectionOffsets - previous calls must be superseded
      if (this.lastRequestId !== localRequestId) return;
      setSelectionByPlainTextOffsets(el, offsets, ignoreMarkers);
      cb?.();

      requestAnimationFrame(() => {
        // If there was a new call for restoreSelectionOffsets - previous calls must be superseded
        if (this.lastRequestId !== localRequestId) return;
        setSelectionByPlainTextOffsets(el, offsets, ignoreMarkers);
        cb?.();

        this.lastRequestId = 0;
      });
    });
  }

  /** Call this to prevent restoring caret position - e.g. when focus is lost or another char was typed */
  public preventRestore() {
    this.lastRequestId = 0;
  }
}

// If CaretRestorerSingleton will get buggy someday - using KISS principle,
// use this plain function - it should simple and stupid be enough
// const restoreCaretOffset = (
//   el: HTMLElement,
//   caretOffset: number,
// ) => {
//   // Flickering... seems fixed by calling setCaretCharacterOffsets in three frames in a row...
//   setCaretCharacterOffsets(el, caretOffset);
//   requestAnimationFrame(() => {
//     setCaretCharacterOffsets(el, caretOffset);
//     requestAnimationFrame(() => {
//       setCaretCharacterOffsets(el, caretOffset);
//     });
//   });
// };

const useLiveFormatting = ({
  getHtml,
  setHtml,
  editableInputId,
  liveFormat,
  synchronizeCustomEmojis,
}: {
  getHtml: Signal<string>;
  setHtml: (html: string) => void;
  editableInputId: string | undefined;
  liveFormat: ILiveFormatSettings;
  synchronizeCustomEmojis: () => void;
}) => {
  const {
    mode: liveFormatMode,
    validOffsetMargin,
    keepMarkerWidth,
  } = liveFormat;

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLElement | null>(null);

  const clearRawMarkersMode = useCallback((preventRestore?: boolean) => {
    const el = inputRef.current;
    if (!el) return;
    const caretOffset = getPlainTextOffsetFromRange(el, false);
    const html = getHtml();
    const {
      formattedText,
    } = parseMarkdownHtmlToEntitiesWithCaret(html, caretOffset, validOffsetMargin);
    const cleanedHtml = getTextWithEntitiesAsHtml(formattedText);
    if (cleanedHtml !== html) {
      setHtml(cleanedHtml);
      if (!preventRestore) {
        const caretRestorer = SelectionRestorerSingleton.getInstance();
        caretRestorer.restoreCaretOffset(el, caretOffset, false);
      }
    }
  }, [getHtml, setHtml, validOffsetMargin]);

  // Toggle visibility of markers based on caret position
  const showRawMarkers = useCallback((plainCaretOffset?: number) => {
    const el = inputRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel?.isCollapsed || !sel.anchorNode || !el.contains(sel.anchorNode)) return;

    const plainTextCaretOffset = plainCaretOffset ?? getPlainTextOffsetFromRange(el);
    const currentHtml = el.innerHTML;
    const formattedText = parseMarkdownHtmlToEntities(currentHtml);
    const entities = formattedText.entities ?? [];
    const visibleIndexes = computeMarkerVisibility(entities, plainTextCaretOffset, validOffsetMargin);
    const markerSpans = el.querySelectorAll<HTMLElement>('.md-marker[data-entity-index]');
    markerSpans.forEach((markerSpan) => {
      const idx = Number(markerSpan.dataset.entityIndex);
      // Toggle the '.visible' class based on the computed visibility for this entity index
      const visible = visibleIndexes.includes(idx);
      markerSpan.classList.toggle('visible', visible);

      const pattern = getPatternByClassList(markerSpan.classList);
      if (visible && markerSpan.textContent !== pattern) {
        markerSpan.textContent = pattern;
      } else if (!visible && markerSpan.textContent !== '' && !keepMarkerWidth) {
        markerSpan.textContent = '';
      }
    });

    // Intuitive action - feels like this prevents cursor moving when typing. Remove if needed
    const caretRestorer = SelectionRestorerSingleton.getInstance();
    caretRestorer.preventRestore();
  }, [validOffsetMargin, keepMarkerWidth]);

  // Toggle visibility of markers based on caret position
  const showRawMarkersSelection = useCallback((plainSelectionOffsets?: SelectionOffsets) => {
    const el = inputRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return;

    const plainTextCaretOffset = plainSelectionOffsets ?? getPlainTextOffsetsFromRange(el);
    const currentHtml = el.innerHTML;
    const formattedText = parseMarkdownHtmlToEntities(currentHtml);
    const entities = formattedText.entities ?? [];
    const visibleIndexes = computeMarkerVisibilitySelection(entities, plainTextCaretOffset, validOffsetMargin);
    const markerSpans = el.querySelectorAll<HTMLElement>('.md-marker[data-entity-index]');
    markerSpans.forEach((markerSpan) => {
      const idx = Number(markerSpan.dataset.entityIndex);
      // Toggle the '.visible' class based on the computed visibility for this entity index
      const visible = visibleIndexes.includes(idx);
      markerSpan.classList.toggle('visible', visible);

      const pattern = getPatternByClassList(markerSpan.classList);
      if (visible && markerSpan.textContent !== pattern) {
        markerSpan.textContent = pattern;
      } else if (!visible && markerSpan.textContent !== '' && !keepMarkerWidth) {
        markerSpan.textContent = '';
      }
    });

    // Intuitive action - feels like this prevents cursor moving when typing. Remove if needed
    const caretRestorer = SelectionRestorerSingleton.getInstance();
    caretRestorer.preventRestore();
  }, [validOffsetMargin, keepMarkerWidth]);

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
          case 'Up':
          case 'ArrowLeft':
          case 'Left':
          case 'PageUp':
          case 'Home':
            newNodePosition = 0;
            break;
          case 'ArrowDown':
          case 'Down':
          case 'ArrowRight':
          case 'Right':
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

  const applyInlineEdit: ApplyInlineEditFn = useCallback((isDelete?: boolean) => {
    const el = inputRef.current;
    if (!el) return;

    const sel = window.getSelection();
    // Only proceed if selection is collapsed and within the editor
    if (!sel?.isCollapsed || !el.contains(sel.anchorNode)) return;
    console.log('ApplyInlineEdit - START ------------------');
    // 1. Get current state
    const caretOffset = getPlainTextOffsetFromRange(el, false);
    const currentHtml = el.innerHTML; // Use innerHTML directly for comparison later

    // 2. Parse the current HTML to get the intended formatted text structure
    // parseMarkdownHtmlToEntities internally cleans HTML and parses raw markdown features
    const {
      formattedText,
      focusedEntityIndexes,
      plainTextCaretOffset,
    } = parseMarkdownHtmlToEntitiesWithCaret(
      currentHtml, caretOffset, validOffsetMargin,
    );
    let entities = formattedText.entities;

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

          if (!currentNode.classList.contains('visible')) {
            // Set as ok if not visible
            if (!spanStatus.has(entityIndex)) {
              spanStatus.set(entityIndex, { startOk: true, endOk: true });
            }
            continue;
          }

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
    }

    // 4. Render the formatted text back to HTML with markers enabled for all entities
    const entityIndexes = (entities ?? []).map((_, i) => i);

    const newHtml = getTextWithEntitiesAsHtml(
      { text: formattedText.text, entities },
      {
        rawEntityIndexes: entityIndexes,
        visibleEntityIndexes: focusedEntityIndexes,
        liveFormatMode,
        keepMarkerWidth,
      },
    );

    const htmlChanged = newHtml !== currentHtml;

    console.log('ApplyInlineEdit - END --------------------');

    if (htmlChanged) {
      // Update the state/DOM
      setHtml(newHtml); // Use the provided state setter

      // Restore selection using the cursor position captured *before* parsing/rendering
      const caretRestorer = SelectionRestorerSingleton.getInstance();
      caretRestorer.restoreCaretOffset(el, plainTextCaretOffset, true); // Ignore markers here!

      // Show raw markers is not needed here - it is now handled
      // in getTextWithEntitiesAsHtml that gets the visible entity indexes from parseMarkdownHtmlToEntitiesWithCursorSelection
    } else {
      // Even if HTML didn't change, marker visibility might need update based on cursor move
      // We do not use requestAnimationFrame here because DOM is not updated here
      showRawMarkers(plainTextCaretOffset);
    }
  }, [setHtml, showRawMarkers, liveFormatMode, validOffsetMargin, keepMarkerWidth]); // Removed getHtml dependency as we use el.innerHTML

  const applyInlineEditForSelection: ApplyInlineEditForSelectionFn = useCallback((
    {
      isDelete,
      knownSelectionOffsets,
      additionalEntities,
      entityTypesToRemoveFromSelection,
      onSelectionRestore,
      forceSelectionRestore,
    } : {
      isDelete?: boolean;
      knownSelectionOffsets?: SelectionOffsets;
      additionalEntities?: ApiMessageEntity[];
      entityTypesToRemoveFromSelection?: ApiMessageEntityTypes[];
      onSelectionRestore?: () => void;
      forceSelectionRestore?: boolean;
    } = {},
  ) => {
    const el = inputRef.current;
    if (!el) return;

    const sel = window.getSelection();
    // Only proceed if selection is within the editor
    if (!sel || !el.contains(sel.anchorNode)) return;

    // 1. Get current state
    const selectionOffsets = knownSelectionOffsets ?? getPlainTextOffsetsFromRange(el, false);
    const currentHtml = el.innerHTML; // Use innerHTML directly for comparison later

    // 2. Parse the current HTML to get the intended formatted text structure
    // parseMarkdownHtmlToEntities internally cleans HTML and parses raw markdown features
    const {
      formattedText,
      focusedEntityIndexes,
      plainTextSelectionOffsets,
    } = parseMarkdownHtmlToEntitiesWithSelection(
      currentHtml, selectionOffsets, validOffsetMargin, additionalEntities, entityTypesToRemoveFromSelection,
    );
    let entities = formattedText.entities;

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

          if (!currentNode.classList.contains('visible')) {
            // Set as ok if not visible
            if (!spanStatus.has(entityIndex)) {
              spanStatus.set(entityIndex, { startOk: true, endOk: true });
            }
            continue;
          }

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
    }

    // 4. Render the formatted text back to HTML with markers enabled for all entities
    const entityIndexes = (entities ?? []).map((_, i) => i);

    const newHtml = getTextWithEntitiesAsHtml(
      { text: formattedText.text, entities },
      {
        rawEntityIndexes: entityIndexes,
        visibleEntityIndexes: focusedEntityIndexes,
        liveFormatMode,
        keepMarkerWidth,
      },
    );
    const htmlChanged = newHtml !== currentHtml;

    if (htmlChanged) {
      // Update the state/DOM
      setHtml(newHtml); // Use the provided state setter

      // Restore selection using the cursor position captured *before* parsing/rendering
      const caretRestorer = SelectionRestorerSingleton.getInstance();
      caretRestorer.restoreSelectionOffsets(el, plainTextSelectionOffsets, true, onSelectionRestore); // Ignore markers here!

      // Show raw markers is not needed here - it is now handled
      // in getTextWithEntitiesAsHtml that gets the visible entity indexes from parseMarkdownHtmlToEntitiesWithCursorSelection
    } else {
      // Even if HTML didn't change, marker visibility might need update based on cursor move
      // We do not use requestAnimationFrame here because DOM is not updated here
      showRawMarkersSelection(plainTextSelectionOffsets);

      if (forceSelectionRestore) {
        const caretRestorer = SelectionRestorerSingleton.getInstance();
        caretRestorer.restoreSelectionOffsets(el, plainTextSelectionOffsets, true, onSelectionRestore); // Ignore markers here!
      }
    }
  }, [setHtml, showRawMarkersSelection, liveFormatMode, validOffsetMargin, keepMarkerWidth]); // Removed getHtml dependency as we use el.innerHTML

  const checkForMarkerEdit = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel?.isCollapsed || !sel.anchorNode || !el.contains(sel.anchorNode)) return;

    if (sel.anchorNode.parentElement?.classList.contains('md-marker')) {
      // If we try to edit something inside of a marker - pass it through the parser grinder
      applyInlineEdit();
    } else {
      requestAnimationFrame(() => showRawMarkers());
    }
  }, [applyInlineEdit, showRawMarkers]);

  useEffect(() => {
    if (!editableInputId) return;
    inputRef.current = document.getElementById(editableInputId);
  }, [editableInputId]);

  useEffect(() => {
    if (liveFormatMode !== 'on' || !inputRef.current) {
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
        requestAnimationFrame(() => showRawMarkers());
        requestAnimationFrame(() => synchronizeCustomEmojis());
      } else {
        checkForMarkerEdit();
      }
    };

    const handleMouseUp = (): void => {
      moveAroundNavWrapperMarkers();
      applyInlineEdit();
    };

    const handleBlur = (): void => {
      clearRawMarkersMode(true);
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
  }, [editableInputId, getHtml, setHtml, applyInlineEdit, showRawMarkers, synchronizeCustomEmojis,
    clearRawMarkersMode, moveAroundNavWrapperMarkers, liveFormatMode, checkForMarkerEdit]);

  useEffect(() => {
    if (liveFormatMode !== 'combo' || !inputRef.current) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (liveFormatMode === 'combo' && e.key.toLowerCase() === COMBO_KEY && (e.metaKey || e.ctrlKey) && e.altKey) {
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
  }, [editableInputId, applyInlineEdit, liveFormatMode]);

  const getLiveFormatInputRef = useCallback(() => {
    return inputRef.current;
  }, [inputRef]);

  return {
    applyInlineEdit,
    applyInlineEditForSelection,
    clearRawMarkersMode,
    getLiveFormatInputRef,
  };
};

export default useLiveFormatting;
