import type { FC, RefObject, TeactNode } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useRef,
  useState,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import parseHtmlAsFormattedText from '../../util/parseHtmlAsFormattedText';
import { preparePastedHtml } from '../middle/composer/helpers/cleanHtml';
import renderText from './helpers/renderText';

import useFlag from '../../hooks/useFlag';
import useInputFocusOnOpen from '../../hooks/useInputFocusOnOpen';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Loading from '../ui/Loading';
import Transition from '../ui/Transition';
import Icon from './icons/Icon';

import './SymbolSearch.scss';

// TODO!!! Cut this component to be symbol search - specific

interface OwnProps {
  ref?: RefObject<HTMLInputElement>;
  children?: React.ReactNode;
  resultsItemSelector?: string;
  className?: string;
  inputId?: string;
  value?: string;
  focused?: boolean;
  isLoading?: boolean;
  spinnerColor?: 'yellow';
  spinnerBackgroundColor?: 'light';
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  canClose?: boolean;
  autoFocusSearch?: boolean;
  hasUpButton?: boolean;
  hasDownButton?: boolean;
  teactExperimentControlled?: boolean;
  withBackIcon?: boolean;
  onChange: (value: string) => void;
  onStartBackspace?: NoneToVoidFunction;
  onReset?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
  onClick?: NoneToVoidFunction;
  onUpClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onDownClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onSpinnerClick?: NoneToVoidFunction;
}

const SymbolSearch: FC<OwnProps> = ({
  ref,
  children,
  resultsItemSelector,
  value,
  inputId,
  className,
  focused,
  isLoading = false,
  spinnerColor,
  spinnerBackgroundColor,
  placeholder,
  disabled,
  autoComplete,
  canClose,
  autoFocusSearch,
  hasUpButton,
  hasDownButton,
  teactExperimentControlled,
  withBackIcon,
  onChange,
  onStartBackspace,
  onReset,
  onFocus,
  onBlur,
  onClick,
  onUpClick,
  onDownClick,
  onSpinnerClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  let inputRef = useRef<HTMLInputElement>(null);
  if (ref) {
    inputRef = ref;
  }

  const [isInputFocused, markInputFocused, unmarkInputFocused] = useFlag(focused);

  useInputFocusOnOpen(inputRef, autoFocusSearch, unmarkInputFocused);

  const [emojiImg, setEmojiImg] = useState<TeactNode>();

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    if (focused) {
      inputRef.current.focus();
    } else {
      inputRef.current.blur();
    }
  }, [focused, placeholder]); // Trick for setting focus when selecting a contact to search for

  const oldLang = useOldLang();
  const lang = useLang();

  useEffect(() => {
    if (!isInputFocused) {
      return undefined;
    }

    function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) {
        return;
      }

      const input = inputRef.current;
      if (!input) {
        return;
      }

      e.preventDefault();

      // Some extensions can trigger paste into their panels without focus
      if (document.activeElement !== input) {
        return;
      }

      const pastedText = e.clipboardData.getData('text');
      const html = e.clipboardData.getData('text/html');

      if (!pastedText) {
        return;
      }

      const pastedFormattedText = html ? parseHtmlAsFormattedText(preparePastedHtml(html)) : undefined;
      const textToPaste = pastedFormattedText?.entities?.length ? pastedFormattedText : { text: pastedText };
      const hasText = textToPaste && textToPaste.text;

      if (hasText && html.includes('emoji')) {
        input.value = ' ';
        onChange(input.value);
        // Do not render custom emojis here
        setEmojiImg(renderText(textToPaste.text));
        return;
      }

      input.value = hasText ? textToPaste.text : '';
      onChange(input.value);
    }

    document.addEventListener('paste', handlePaste, false);

    return () => {
      document.removeEventListener('paste', handlePaste, false);
    };
  }, [isInputFocused, inputRef, onChange]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { currentTarget } = event;
    onChange(currentTarget.value);

    if (!isInputFocused) {
      handleFocus();
    }

    setEmojiImg(undefined);
  }

  function handleFocus() {
    markInputFocused();
    onFocus?.();
  }

  function handleBlur() {
    unmarkInputFocused();
    onBlur?.();
  }

  const handleReset = useLastCallback(() => {
    setEmojiImg(undefined);
    onReset?.();
  });

  const handleKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!resultsItemSelector) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      const element = document.querySelector(resultsItemSelector) as HTMLElement;
      if (element) {
        element.focus();
      }
    }

    if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
      onStartBackspace?.();
    }
  });

  return (
    <div
      className={buildClassName('SymbolSearch', className, isInputFocused && 'has-focus')}
      onClick={onClick}
      dir={oldLang.isRtl ? 'rtl' : undefined}
    >
      <Transition
        name="fade"
        shouldCleanup
        activeKey={Number(!isLoading && !withBackIcon)}
        className="icon-container-left"
        slideClassName="icon-container-slide"
      >
        {isLoading && !withBackIcon ? (
          <Loading color={spinnerColor} backgroundColor={spinnerBackgroundColor} onClick={onSpinnerClick} />
        ) : withBackIcon ? (
          <Icon name="arrow-left" className="back-icon" onClick={handleReset} />
        ) : (
          <Icon name="search" className="search-icon" />
        )}
      </Transition>
      <div>{children}</div>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        dir="auto"
        placeholder={emojiImg ? undefined : (placeholder || oldLang('Search'))}
        className="form-control"
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        teactExperimentControlled={teactExperimentControlled}
      />
      <div className="pasted-emoji">{emojiImg}</div>
      {hasUpButton && (
        <Button
          round
          size="tiny"
          color="translucent"
          onClick={onUpClick}
          disabled={!onUpClick}
          ariaLabel={lang('AriaSearchOlderResult')}
        >
          <Icon name="up" />
        </Button>
      )}
      {hasDownButton && (
        <Button
          round
          size="tiny"
          color="translucent"
          onClick={onDownClick}
          disabled={!onDownClick}
          ariaLabel={lang('AriaSearchNewerResult')}
        >
          <Icon name="down" />
        </Button>
      )}
      <Transition
        name="fade"
        shouldCleanup
        activeKey={Number(isLoading)}
        className="icon-container-right"
        slideClassName="icon-container-slide"
      >
        {withBackIcon && isLoading ? (
          <Loading color={spinnerColor} backgroundColor={spinnerBackgroundColor} onClick={onSpinnerClick} />
        ) : (
          (value || canClose) && onReset && (
            <Button
              round
              size="tiny"
              color="translucent"
              onClick={handleReset}
            >
              <Icon name="close" />
            </Button>
          )
        )}
      </Transition>
    </div>
  );
};

export default memo(SymbolSearch);
