import {
  useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

export function useUndoRedo(
  getHtml: () => string,
  setHtml: (html: string) => void,
  editableInputId: string,
) {
  const [undoHistory, setUndoHistory] = useState<string[]>([getHtml()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const skipHistoryRef = useRef(false);
  const debounceTimerRef = useRef<number | undefined>(undefined);
  const lastRecordedTextRef = useRef(getHtml());

  // Immediately record history if text has changed.
  const recordHistoryImmediate = useCallback(
    (text: string) => {
      if (undoHistory[historyIndex] === text) return;
      const newHistory = undoHistory.slice(0, historyIndex + 1);
      newHistory.push(text);
      setUndoHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      lastRecordedTextRef.current = text;
    },
    [undoHistory, historyIndex],
  );

  // Debounced recording: if regex matches, record immediately;
  // if not, wait a moment (e.g. 1s) before recording the current state.
  const recordHistory = useCallback(
    (text: string) => {
      if (/[\s.,!?;:]$/.test(text)) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = undefined;
        }
        recordHistoryImmediate(text);
      } else if (text !== lastRecordedTextRef.current) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = window.setTimeout(() => {
          recordHistoryImmediate(text);
          debounceTimerRef.current = undefined;
        }, 1000);
      }
    }, [recordHistoryImmediate],
  );

  // Helper to reposition the cursor at the end of the content.
  const setCursorToEnd = useCallback(() => {
    const inputElem = document.getElementById(editableInputId);
    if (!inputElem) return;
    // Use a slightly longer delay (e.g. 50ms) to ensure the DOM is updated.
    setTimeout(() => {
      inputElem.focus();
      if (inputElem instanceof HTMLInputElement || inputElem instanceof HTMLTextAreaElement) {
        const len = inputElem.value.length;
        inputElem.setSelectionRange(len, len);
      } else if (inputElem.isContentEditable) {
        const selection = window.getSelection();
        if (selection) {
          // This method selects all children and then collapses the selection to the end.
          selection.selectAllChildren(inputElem);
          selection.collapseToEnd();
        }
      }
    }, 50);
  }, [editableInputId]);

  // Flush function: cancel any pending debounce and record immediately.
  const flushHistory = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
    recordHistoryImmediate(getHtml());
  }, [recordHistoryImmediate, getHtml]);

  // clearHistory function resets the history to the current state.
  const clearHistory = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
    const currentHtml = '';
    setUndoHistory([currentHtml]);

    setHistoryIndex(0);
    lastRecordedTextRef.current = currentHtml;
  }, []);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      skipHistoryRef.current = true;
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setHtml(undoHistory[newIndex]);
      setCursorToEnd();
    }
  }, [historyIndex, undoHistory, setHtml, setCursorToEnd]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < undoHistory.length - 1) {
      skipHistoryRef.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setHtml(undoHistory[newIndex]);
      setCursorToEnd();
    }
  }, [historyIndex, undoHistory, setHtml, setCursorToEnd]);

  // Attach keydown listener to capture cmd+z / cmd+shift+z.
  useEffect(() => {
    const inputElem = document.getElementById(editableInputId);
    const onKeyDown = (e: KeyboardEvent) => {
      // Only consider events with Ctrl or Cmd (and not Alt)
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        // Undo: if the physical key is KeyZ without Shift
        if (e.code === 'KeyZ' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    inputElem?.addEventListener('keydown', onKeyDown);
    return () => {
      inputElem?.removeEventListener('keydown', onKeyDown);
    };
  }, [handleUndo, handleRedo, editableInputId]);

  // Listen for input events to record history changes.
  useEffect(() => {
    const inputElem = document.getElementById(editableInputId);
    const onInput = () => {
      // Skip recording if this change was triggered by undo/redo.
      if (skipHistoryRef.current) {
        skipHistoryRef.current = false;
        return;
      }
      recordHistory(getHtml());
    };
    inputElem?.addEventListener('input', onInput);
    return () => {
      inputElem?.removeEventListener('input', onInput);
    };
  }, [recordHistory, getHtml, editableInputId]);

  return {
    flushHistory, clearHistory,
  };
}
