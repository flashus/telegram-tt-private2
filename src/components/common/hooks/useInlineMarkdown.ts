// import { useEffect } from '../../../lib/teact/teact';

// import type { Signal } from '../../../util/signals';

// import parseHtmlAsFormattedText from '../../../util/parseHtmlAsFormattedText';
// import { debounce } from '../../../util/schedulers';
// import { getTextWithEntitiesAsHtml } from '../helpers/renderTextWithEntities';

// const useInlineMarkdown = ({
//   getHtml,
//   setHtml,
//   // insertHtmlAndUpdateCursor,
// } : {
//   getHtml: Signal<string>;
//   setHtml: (html: string) => void;
//   // insertHtmlAndUpdateCursor: (html: string, inInputId?: string) => void;
// }) => {
//   const selection = window.getSelection();

//   useEffect(() => {
//     function onSelectionChange() {
//       const html = getHtml();
//       const parsed = parseHtmlAsFormattedText(html, 'useInlineMarkdown');
//       const newHtml = getTextWithEntitiesAsHtml(parsed);

//       setHtml(newHtml);
//     }

//     const debouncedOnSelectionChange = debounce(onSelectionChange, 300, false);

//     window.document.addEventListener('selectionchange', debouncedOnSelectionChange);

//     // eslint-disable-next-line consistent-return
//     return () => {
//       window.document.removeEventListener('selectionchange', debouncedOnSelectionChange);
//     };
//   // }, [selection, getHtml, insertHtmlAndUpdateCursor]);
//   }, [selection, getHtml, setHtml]);

//   // return {  };
// };

import { useEffect } from '../../../lib/teact/teact';

import type { Signal } from '../../../util/signals';

import parseHtmlAsFormattedText from '../../../util/parseHtmlAsFormattedText';
import { debounce } from '../../../util/schedulers';
import { getTextWithEntitiesAsHtml } from '../helpers/renderTextWithEntities';

const useInlineMarkdown = ({
  getHtml,
  setHtml,
}: {
  getHtml: Signal<string>;
  setHtml: (html: string) => void;
}) => {
  // Store the last cursor position
  // const lastSelectionRef = useRef<{
  //   start: number;
  //   end: number;
  //   html: string;
  // }>();

  useEffect(() => {
    // // Helper to get current cursor position
    // const saveSelection = () => {
    //   const selection = window.getSelection();
    //   if (!selection || !selection.rangeCount) return;

    //   const range = selection.getRangeAt(0);
    //   const html = getHtml();

    //   lastSelectionRef.current = {
    //     start: range.startOffset,
    //     end: range.endOffset,
    //     html,
    //   };
    // };

    // // Helper to restore cursor position with adjustment for length changes
    // const restoreSelection = (oldHtml: string, newHtml: string) => {
    //   requestAnimationFrame(() => {
    //     if (!lastSelectionRef.current) return;
    //     const selection = window.getSelection();
    //     if (!selection) return;

    //     const el = document.querySelector('[contenteditable="true"]');
    //     if (!el) return;

    //     // Calculate position adjustment based on length difference
    //     const lengthDiff = newHtml.length - oldHtml.length;

    //     // Ensure positions are within bounds and non-negative
    //     const newStart = Math.max(0, Math.min(lastSelectionRef.current.start, newHtml.length));
    //     const newEnd = Math.max(0, Math.min(
    //       lastSelectionRef.current.end + (lastSelectionRef.current.end >= oldHtml.length ? lengthDiff : 0),
    //       newHtml.length,
    //     ));

    //     // Create and set new range
    //     const range = document.createRange();
    //     let currentPos = 0;
    //     let startNode: Node | undefined;
    //     let endNode: Node | undefined;
    //     let startOffset = 0;
    //     let endOffset = 0;

    //     // Helper to traverse nodes and find position
    //     const traverseNodes = (node: Node): boolean => {
    //       if (node.nodeType === Node.TEXT_NODE) {
    //         const nodeLength = node.textContent?.length || 0;

    //         // Check if this text node contains our target positions
    //         if (!startNode && currentPos <= newStart && currentPos + nodeLength >= newStart) {
    //           startNode = node;
    //           startOffset = Math.min(newStart - currentPos, nodeLength);
    //         }

    //         if (!endNode && currentPos <= newEnd && currentPos + nodeLength >= newEnd) {
    //           endNode = node;
    //           endOffset = Math.min(newEnd - currentPos, nodeLength);
    //           return true;
    //         }

    //         currentPos += nodeLength;
    //       } else {
    //         // For non-text nodes, traverse their children
    //         for (const child of Array.from(node.childNodes)) {
    //           if (traverseNodes(child)) return true;
    //         }
    //       }
    //       return false;
    //     };

    //     traverseNodes(el);

    //     try {
    //       // If we couldn't find appropriate nodes, fall back to the first/last text node
    //       if (!startNode || !endNode) {
    //         const textNodes = Array.from(el.querySelectorAll('*'))
    //           .reduce((nodes: Text[], element) => {
    //             element.childNodes.forEach((node) => {
    //               if (node.nodeType === Node.TEXT_NODE) nodes.push(node as Text);
    //             });
    //             return nodes;
    //           }, []);

    //         if (textNodes.length) {
    //           startNode = startNode || textNodes[0];
    //           endNode = endNode || textNodes[textNodes.length - 1];
    //           startOffset = startOffset || 0;
    //           endOffset = endOffset || (endNode.textContent?.length || 0);
    //         } else {
    //           // If no text nodes found, use the element itself
    //           endNode = el;
    //           startNode = endNode;
    //           endOffset = 0;
    //           startOffset = endOffset;
    //         }
    //       }

    //       range.setStart(startNode, startOffset);
    //       range.setEnd(endNode, endOffset);
    //       selection.removeAllRanges();
    //       selection.addRange(range);
    //     } catch (e) {
    //       // If something goes wrong with setting the range, just place cursor at the end
    //       try {
    //         const lastTextNode = el.lastChild;
    //         if (lastTextNode) {
    //           range.setStart(lastTextNode, lastTextNode.textContent?.length || 0);
    //           range.setEnd(lastTextNode, lastTextNode.textContent?.length || 0);
    //           selection.removeAllRanges();
    //           selection.addRange(range);
    //         }
    //       } catch (e2) {
    //         // If all else fails, do nothing
    //         console.error('Failed to restore selection', e2);
    //       }
    //     }
    //   });
    // };

    // // Helper to get current cursor position
    // const saveSelection = (): { start: number; end: number } => {
    //   const selection = window.getSelection();
    //   if (!selection || !selection.rangeCount) return { start: 0, end: 0 };

    //   const range = selection.getRangeAt(0);
    //   const input = document.querySelector('[contenteditable="true"]');
    //   if (!input) return { start: 0, end: 0 };

    //   // Get text content up to cursor
    //   const preCaretRange = range.cloneRange();
    //   preCaretRange.selectNodeContents(input);
    //   preCaretRange.setEnd(range.endContainer, range.endOffset);

    //   return {
    //     start: preCaretRange.toString().length,
    //     end: preCaretRange.toString().length + (range.toString().length || 0),
    //   };
    // };

    // // Helper to restore cursor position
    // const restoreSelection = (savedSel: { start: number; end: number }) => {
    //   if (!savedSel) return;

    //   const input = document.querySelector('[contenteditable="true"]');
    //   if (!input) return;

    //   const selection = window.getSelection();
    //   if (!selection) return;

    //   let charIndex = 0;
    //   const range = document.createRange();
    //   range.selectNodeContents(input);
    //   range.collapse(true);

    //   const nodeStack = [input]; const foundStart = false; const
    //     stop = false;

    //   while (!stop && nodeStack.length) {
    //     const node = nodeStack.pop()!;

    //     if (node.nodeType === 3) {
    //       const nextCharIndex = charIndex + (node.length || 0);

    //       if (!foundStart && savedSel.start >= charIndex && savedSel.start <= nextCharIndex) {
    //         range.setStart(node, savedSel.start - charIndex);
    //         foundStart = true;
    //       }

    //       if (foundStart && savedSel.end >= charIndex && savedSel.end <= nextCharIndex) {
    //         range.setEnd(node, savedSel.end - charIndex);
    //         stop = true;
    //       }

    //       charIndex = nextCharIndex;
    //     } else {
    //       let i = node.childNodes.length;
    //       while (i--) {
    //         nodeStack.push(node.childNodes[i]);
    //       }
    //     }
    //   }

    //   selection.removeAllRanges();
    //   selection.addRange(range);
    // };

    const handleSelectionChange = () => {
      // const selection = saveSelection();

      const html = getHtml();
      const parsed = parseHtmlAsFormattedText(html, 'useInlineMarkdown');
      const newHtml = getTextWithEntitiesAsHtml(parsed);

      if (html !== newHtml) {
        // const oldHtml = html;
        setHtml(newHtml);
        // restoreSelection(selection);
      }
    };

    const debouncedOnSelectionChange = debounce(handleSelectionChange, 300, false);

    document.addEventListener('selectionchange', debouncedOnSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', debouncedOnSelectionChange);
    };
  }, [getHtml, setHtml]);
};

export default useInlineMarkdown;
