import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { ApiMessageEntityBlockquote, ApiMessageEntityDefault } from '../../../api/types';
import type { IAnchorPosition } from '../../../types';
import type { ApplyInlineEditForSelectionFn } from '../../common/hooks/useLiveFormatting';
import { ApiMessageEntityTypes } from '../../../api/types';

import { EDITABLE_INPUT_ID } from '../../../config';
import { TokenType } from '../../../util/ast/astEnums';
import { getPlainTextOffsetsFromRange } from '../../../util/ast/plainTextOffset';
import { TOKEN_PATTERNS } from '../../../util/ast/token';
import { ensureProtocol } from '../../../util/browser/url';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import getKeyFromEvent from '../../../util/getKeyFromEvent';
import stopEvent from '../../../util/stopEvent';
import { INPUT_CUSTOM_EMOJI_SELECTOR } from './helpers/customEmoji';
import { flushSurroundingMarkers } from './helpers/marker';
import { getExpectedParentElementRecursive } from './helpers/selection';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import useVirtualBackdrop from '../../../hooks/useVirtualBackdrop';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import './TextFormatter.scss';

export type OwnProps = {
  isOpen: boolean;
  anchorPosition?: IAnchorPosition;
  selectedRange?: Range;
  setSelectedRange: (range: Range) => void; // TODO!!! Delete! Or not? now handled by applyInlineEditForSelection
  onClose: () => void;
  applyInlineEditForSelection: ApplyInlineEditForSelectionFn;
  getLiveFormatInputRef: () => HTMLElement | null;
};

interface ISelectedTextFormats {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  monospace?: boolean;
  spoiler?: boolean;
  blockquote?: boolean;
}

// const SELECTED_TEXT_FORMAT_TO_MARKER: Record<keyof ISelectedTextFormats, string> = {
//   bold: '**',
//   italic: '__',
//   underline: '++',
//   strikethrough: '~~',
//   monospace: '`',
//   spoiler: '||',
//   blockquote: '> ',
// };

const TEXT_FORMAT_BY_TAG_NAME: Record<string, keyof ISelectedTextFormats> = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  DEL: 'strikethrough',
  CODE: 'monospace',
  SPAN: 'spoiler',
  BLOCKQUOTE: 'blockquote',
};
const fragmentEl = document.createElement('div');

const TextFormatter: FC<OwnProps> = ({
  isOpen,
  anchorPosition,
  selectedRange,
  setSelectedRange, // TODO!!! Delete! Or not? now handled by applyInlineEditForSelection
  onClose,
  applyInlineEditForSelection,
  getLiveFormatInputRef,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen);
  const [isLinkControlOpen, openLinkControl, closeLinkControl] = useFlag();
  const [linkUrl, setLinkUrl] = useState('');
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [inputClassName, setInputClassName] = useState<string | undefined>();
  const [selectedTextFormats, setSelectedTextFormats] = useState<ISelectedTextFormats>({});

  useEffect(() => (isOpen ? captureEscKeyListener(onClose) : undefined), [isOpen, onClose]);
  useVirtualBackdrop(
    isOpen,
    containerRef,
    onClose,
    true,
  );

  useEffect(() => {
    if (isLinkControlOpen) {
      linkUrlInputRef.current!.focus();
    } else {
      setLinkUrl('');
      setIsEditingLink(false);
    }
  }, [isLinkControlOpen]);

  useEffect(() => {
    if (!shouldRender) {
      closeLinkControl();
      setSelectedTextFormats({});
      setInputClassName(undefined);
    }
  }, [closeLinkControl, shouldRender]);

  useEffect(() => {
    if (!isOpen || !selectedRange) {
      return;
    }

    const selectedFormats: ISelectedTextFormats = {};
    let parentElement: HTMLElement | null;
    if (selectedRange.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
      parentElement = selectedRange.commonAncestorContainer.parentElement;
    } else if (selectedRange.commonAncestorContainer instanceof HTMLElement) {
      parentElement = selectedRange.commonAncestorContainer;
    } else {
      return;
    }
    while (parentElement && parentElement.id !== EDITABLE_INPUT_ID) {
      const textFormat = TEXT_FORMAT_BY_TAG_NAME[parentElement.tagName];
      if (textFormat) {
        selectedFormats[textFormat] = true;
      }

      parentElement = parentElement.parentElement;
    }

    setSelectedTextFormats(selectedFormats);
  }, [isOpen, selectedRange, openLinkControl]);

  const restoreSelection = useLastCallback(() => {
    if (!selectedRange) {
      return;
    }

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
  });

  // TODO!!! Delete! Or not? now handled by applyInlineEditForSelection
  const updateSelectedRange = useLastCallback(() => {
    const selection = window.getSelection();
    if (selection) {
      setSelectedRange(selection.getRangeAt(0));
    }
  });

  const getSelectedText = useLastCallback((shouldDropCustomEmoji?: boolean) => {
    if (!selectedRange) {
      return undefined;
    }
    fragmentEl.replaceChildren(selectedRange.cloneContents());
    if (shouldDropCustomEmoji) {
      fragmentEl.querySelectorAll(INPUT_CUSTOM_EMOJI_SELECTOR).forEach((el) => {
        el.replaceWith(el.getAttribute('alt')!);
      });
    }
    return fragmentEl.innerHTML;
  });

  const getSelectedElement = useLastCallback(() => {
    if (!selectedRange) {
      return undefined;
    }

    if (selectedRange.commonAncestorContainer.nodeName === 'BLOCKQUOTE') {
      return selectedRange.commonAncestorContainer as HTMLElement;
    }

    return selectedRange.commonAncestorContainer.parentElement;
  });

  function updateInputStyles() {
    const input = linkUrlInputRef.current;
    if (!input) {
      return;
    }

    const { offsetWidth, scrollWidth, scrollLeft } = input;
    if (scrollWidth <= offsetWidth) {
      setInputClassName(undefined);
      return;
    }

    let className = '';
    if (scrollLeft < scrollWidth - offsetWidth) {
      className = 'mask-right';
    }
    if (scrollLeft > 0) {
      className += ' mask-left';
    }

    setInputClassName(className);
  }

  function handleLinkUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLinkUrl(e.target.value);
    updateInputStyles();
  }

  function getFormatButtonClassName(key: keyof ISelectedTextFormats) {
    if (selectedTextFormats[key]) {
      return 'active';
    }

    if (key === 'monospace' || key === 'strikethrough') {
      if (Object.keys(selectedTextFormats).some(
        (fKey) => fKey !== key && Boolean(selectedTextFormats[fKey as keyof ISelectedTextFormats]),
      )) {
        return 'disabled';
      }
    } else if (selectedTextFormats.monospace || selectedTextFormats.strikethrough) {
      return 'disabled';
    }

    return undefined;
  }

  const handleSpoilerText = useLastCallback(() => {
    const marker = TOKEN_PATTERNS[TokenType.SPOILER_MARKER];
    if (selectedTextFormats.spoiler) {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        spoiler: false,
      }));

      const element = getExpectedParentElementRecursive('SPAN', getSelectedElement());
      if (
        !selectedRange
        || !element
        || element.tagName !== 'SPAN'
      ) {
        return;
      }

      flushSurroundingMarkers(element, marker);
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);
      applyInlineEditForSelection({
        isDelete: true,
        knownSelectionOffsets: selectionOffsets,
        entityTypesToRemoveFromSelection: [ApiMessageEntityTypes.Spoiler],
        forceSelectionRestore: true,
      });
    } else {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        spoiler: true,
      }));
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);

      const additionalEntity: ApiMessageEntityDefault = {
        type: ApiMessageEntityTypes.Spoiler,
        offset: selectionOffsets.start,
        length: selectionOffsets.end - selectionOffsets.start,
      };

      applyInlineEditForSelection({
        isDelete: false,
        knownSelectionOffsets: selectionOffsets,
        additionalEntities: [additionalEntity],
      });
    }
    requestAnimationFrame(() => updateSelectedRange());
  });

  const handleBoldText = useLastCallback(() => {
    const marker = TOKEN_PATTERNS[TokenType.BOLD_MARKER];
    if (selectedTextFormats.bold) {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        bold: false,
      }));

      const element = getExpectedParentElementRecursive('B', getSelectedElement());
      if (
        !selectedRange
        || !element
        || element.tagName !== 'B'
      ) {
        return;
      }

      flushSurroundingMarkers(element, marker);
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);
      applyInlineEditForSelection({
        isDelete: true,
        knownSelectionOffsets: selectionOffsets,
        entityTypesToRemoveFromSelection: [ApiMessageEntityTypes.Bold],
        forceSelectionRestore: true,
      });
    } else {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        bold: true,
      }));
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);

      const additionalEntity: ApiMessageEntityDefault = {
        type: ApiMessageEntityTypes.Bold,
        offset: selectionOffsets.start,
        length: selectionOffsets.end - selectionOffsets.start,
      };

      applyInlineEditForSelection({
        isDelete: false,
        knownSelectionOffsets: selectionOffsets,
        additionalEntities: [additionalEntity],
      });
    }
    requestAnimationFrame(() => updateSelectedRange());
  });

  const handleItalicText = useLastCallback(() => {
    const marker = TOKEN_PATTERNS[TokenType.ITALIC_MARKER];
    if (selectedTextFormats.italic) {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        italic: false,
      }));

      const element = getExpectedParentElementRecursive('I', getSelectedElement());
      if (
        !selectedRange
        || !element
        || element.tagName !== 'I'
      ) {
        return;
      }

      flushSurroundingMarkers(element, marker);
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);
      applyInlineEditForSelection({
        isDelete: true,
        knownSelectionOffsets: selectionOffsets,
        entityTypesToRemoveFromSelection: [ApiMessageEntityTypes.Italic],
        forceSelectionRestore: true,
      });
    } else {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        italic: true,
      }));
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);

      const additionalEntity: ApiMessageEntityDefault = {
        type: ApiMessageEntityTypes.Italic,
        offset: selectionOffsets.start,
        length: selectionOffsets.end - selectionOffsets.start,
      };

      applyInlineEditForSelection({
        isDelete: false,
        knownSelectionOffsets: selectionOffsets,
        additionalEntities: [additionalEntity],
      });
    }
    requestAnimationFrame(() => updateSelectedRange());
  });

  const handleUnderlineText = useLastCallback(() => {
    const marker = TOKEN_PATTERNS[TokenType.UNDERLINE_MARKER];
    if (selectedTextFormats.underline) {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        underline: false,
      }));

      const element = getExpectedParentElementRecursive('U', getSelectedElement());
      if (
        !selectedRange
        || !element
        || element.tagName !== 'U'
      ) {
        return;
      }

      flushSurroundingMarkers(element, marker);
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);
      applyInlineEditForSelection({
        isDelete: true,
        knownSelectionOffsets: selectionOffsets,
        entityTypesToRemoveFromSelection: [ApiMessageEntityTypes.Underline],
        forceSelectionRestore: true,
      });
    } else {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        underline: true,
      }));
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);

      const additionalEntity: ApiMessageEntityDefault = {
        type: ApiMessageEntityTypes.Underline,
        offset: selectionOffsets.start,
        length: selectionOffsets.end - selectionOffsets.start,
      };

      applyInlineEditForSelection({
        isDelete: false,
        knownSelectionOffsets: selectionOffsets,
        additionalEntities: [additionalEntity],
      });
    }
    requestAnimationFrame(() => updateSelectedRange());
  });

  const handleStrikethroughText = useLastCallback(() => {
    const marker = TOKEN_PATTERNS[TokenType.STRIKE_MARKER];
    if (selectedTextFormats.strikethrough) {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        strikethrough: false,
      }));

      const element = getExpectedParentElementRecursive('DEL', getSelectedElement());
      if (
        !selectedRange
        || !element
        || element.tagName !== 'DEL'
      ) {
        return;
      }

      flushSurroundingMarkers(element, marker);
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);
      applyInlineEditForSelection({
        isDelete: true,
        knownSelectionOffsets: selectionOffsets,
        entityTypesToRemoveFromSelection: [ApiMessageEntityTypes.Strike],
        forceSelectionRestore: true,
      });
    } else {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        strikethrough: true,
      }));
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);

      const additionalEntity: ApiMessageEntityDefault = {
        type: ApiMessageEntityTypes.Strike,
        offset: selectionOffsets.start,
        length: selectionOffsets.end - selectionOffsets.start,
      };

      applyInlineEditForSelection({
        isDelete: false,
        knownSelectionOffsets: selectionOffsets,
        additionalEntities: [additionalEntity],
      });
    }
    requestAnimationFrame(() => updateSelectedRange());
  });

  const handleMonospaceText = useLastCallback(() => {
    const marker = TOKEN_PATTERNS[TokenType.CODE_MARKER];
    if (selectedTextFormats.monospace) {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        monospace: false,
      }));

      const element = getExpectedParentElementRecursive('CODE', getSelectedElement());
      if (
        !selectedRange
        || !element
        || element.tagName !== 'CODE'
      ) {
        return;
      }

      flushSurroundingMarkers(element, marker);
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);
      applyInlineEditForSelection({
        isDelete: true,
        knownSelectionOffsets: selectionOffsets,
        entityTypesToRemoveFromSelection: [ApiMessageEntityTypes.Code],
        forceSelectionRestore: true,
      });
    } else {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        monospace: true,
      }));
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);

      const additionalEntity: ApiMessageEntityDefault = {
        type: ApiMessageEntityTypes.Code,
        offset: selectionOffsets.start,
        length: selectionOffsets.end - selectionOffsets.start,
      };

      applyInlineEditForSelection({
        isDelete: false,
        knownSelectionOffsets: selectionOffsets,
        additionalEntities: [additionalEntity],
      });
    }
    requestAnimationFrame(() => updateSelectedRange());
  });

  const handleBlockquoteText = useLastCallback(() => {
    // TODO!!!! Handle creating nested blockquotes!

    const marker = TOKEN_PATTERNS[TokenType.QUOTE_MARKER];
    if (selectedTextFormats.blockquote) {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        blockquote: false,
      }));

      const element = getExpectedParentElementRecursive('BLOCKQUOTE', getSelectedElement());
      if (
        !selectedRange
        || !element
        || element.tagName !== 'BLOCKQUOTE'
      ) {
        return;
      }

      flushSurroundingMarkers(element, marker);
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);
      applyInlineEditForSelection({
        isDelete: true,
        knownSelectionOffsets: selectionOffsets,
        entityTypesToRemoveFromSelection: [ApiMessageEntityTypes.Blockquote],
        forceSelectionRestore: true,
      });
    } else {
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        blockquote: true,
      }));
      const container = getLiveFormatInputRef();
      if (!container) return;
      const selectionOffsets = getPlainTextOffsetsFromRange(container, true);

      const additionalEntity: ApiMessageEntityBlockquote = {
        type: ApiMessageEntityTypes.Blockquote,
        offset: selectionOffsets.start,
        length: selectionOffsets.end - selectionOffsets.start,
      };

      applyInlineEditForSelection({
        isDelete: false,
        knownSelectionOffsets: selectionOffsets,
        additionalEntities: [additionalEntity],
      });
    }
    requestAnimationFrame(() => updateSelectedRange());
  });

  const handleLinkUrlConfirm = useLastCallback(() => {
    // TODO!!! Handle url links!

    const formattedLinkUrl = (ensureProtocol(linkUrl) || '').split('%').map(encodeURI).join('%');

    if (isEditingLink) {
      const element = getSelectedElement();
      if (!element || element.tagName !== 'A') {
        return;
      }

      (element as HTMLAnchorElement).href = formattedLinkUrl;

      onClose();

      return;
    }

    const text = getSelectedText(true);
    restoreSelection();
    document.execCommand(
      'insertHTML',
      false,
      `<a href=${formattedLinkUrl} class="text-entity-link" dir="auto">${text}</a>`,
    );
    onClose();
  });

  const handleKeyDown = useLastCallback((e: KeyboardEvent) => {
    const HANDLERS_BY_KEY: Record<string, AnyToVoidFunction> = {
      k: openLinkControl,
      b: handleBoldText,
      u: handleUnderlineText,
      i: handleItalicText,
      m: handleMonospaceText,
      s: handleStrikethroughText,
      p: handleSpoilerText,
      q: handleBlockquoteText,
    };

    const handler = HANDLERS_BY_KEY[getKeyFromEvent(e)];

    if (
      e.altKey
      || !(e.ctrlKey || e.metaKey)
      || !handler
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    handler();
  });

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const lang = useOldLang();

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && isLinkControlOpen) {
      handleLinkUrlConfirm();
      e.preventDefault();
    }
  }

  if (!shouldRender) {
    return undefined;
  }

  const className = buildClassName(
    'TextFormatter',
    transitionClassNames,
    isLinkControlOpen && 'link-control-shown',
  );

  const linkUrlConfirmClassName = buildClassName(
    'TextFormatter-link-url-confirm',
    Boolean(linkUrl.length) && 'shown',
  );

  const style = anchorPosition
    ? `left: ${anchorPosition.x}px; top: ${anchorPosition.y}px;--text-formatter-left: ${anchorPosition.x}px;`
    : '';

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      onKeyDown={handleContainerKeyDown}
      // Prevents focus loss when clicking on the toolbar
      onMouseDown={stopEvent}
    >
      <div className="TextFormatter-buttons">
        <Button
          color="translucent"
          ariaLabel="Spoiler text"
          className={getFormatButtonClassName('spoiler')}
          onClick={handleSpoilerText}
        >
          <Icon name="eye-crossed" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button
          color="translucent"
          ariaLabel="Bold text"
          className={getFormatButtonClassName('bold')}
          onClick={handleBoldText}
        >
          <Icon name="bold" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Italic text"
          className={getFormatButtonClassName('italic')}
          onClick={handleItalicText}
        >
          <Icon name="italic" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Underlined text"
          className={getFormatButtonClassName('underline')}
          onClick={handleUnderlineText}
        >
          <Icon name="underlined" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Strikethrough text"
          className={getFormatButtonClassName('strikethrough')}
          onClick={handleStrikethroughText}
        >
          <Icon name="strikethrough" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Monospace text"
          className={getFormatButtonClassName('monospace')}
          onClick={handleMonospaceText}
        >
          <Icon name="monospace" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Quote text"
          className={getFormatButtonClassName('blockquote')}
          onClick={handleBlockquoteText}
        >
          <Icon name="quote-text" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button color="translucent" ariaLabel={lang('TextFormat.AddLinkTitle')} onClick={openLinkControl}>
          <Icon name="link" />
        </Button>
      </div>

      <div className="TextFormatter-link-control">
        <div className="TextFormatter-buttons">
          <Button color="translucent" ariaLabel={lang('Cancel')} onClick={closeLinkControl}>
            <Icon name="arrow-left" />
          </Button>
          <div className="TextFormatter-divider" />

          <div
            className={buildClassName('TextFormatter-link-url-input-wrapper', inputClassName)}
          >
            <input
              ref={linkUrlInputRef}
              className="TextFormatter-link-url-input"
              type="text"
              value={linkUrl}
              placeholder="Enter URL..."
              autoComplete="off"
              inputMode="url"
              dir="auto"
              onChange={handleLinkUrlChange}
              onScroll={updateInputStyles}
            />
          </div>

          <div className={linkUrlConfirmClassName}>
            <div className="TextFormatter-divider" />
            <Button
              color="translucent"
              ariaLabel={lang('Save')}
              className="color-primary"
              onClick={handleLinkUrlConfirm}
            >
              <Icon name="check" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(TextFormatter);
