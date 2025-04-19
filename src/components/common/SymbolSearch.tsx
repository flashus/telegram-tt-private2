import type { FC, RefObject } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useRef,
} from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import animateHorizontalScroll from '../../util/animateHorizontalScroll';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';

import useAppLayout from '../../hooks/useAppLayout';
import useFlag from '../../hooks/useFlag';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useInputFocusOnOpen from '../../hooks/useInputFocusOnOpen';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Loading from '../ui/Loading';
import Transition from '../ui/Transition';
import Icon from './icons/Icon';

import './SymbolSearch.scss';

interface OwnProps {
  ref?: RefObject<HTMLInputElement>;
  resultsItemSelector?: string;
  className?: string;
  inputId?: string;
  value?: string;
  groupValue?: EmojiGroupIconName;
  focused?: boolean;
  isLoading?: boolean;
  spinnerColor?: 'yellow';
  spinnerBackgroundColor?: 'light';
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  canClose?: boolean;
  autoFocusSearch?: boolean;
  teactExperimentControlled?: boolean;
  onChange: (value: string) => void;
  onGroupValueChange: (value: EmojiGroupIconName) => void;
  onStartBackspace?: NoneToVoidFunction;
  onReset?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
  onClick?: NoneToVoidFunction;
  onSpinnerClick?: NoneToVoidFunction;
}

export type EmojiGroupIconName = Extract<IconName,
| 'msg_emoji_heart' | 'msg_emoji_like' | 'msg_emoji_dislike' | 'msg_emoji_party'
| 'msg_emoji_haha' | 'msg_emoji_omg' | 'msg_emoji_sad' | 'msg_emoji_angry'
| 'msg_emoji_neutral' | 'msg_emoji_what' | 'msg_emoji_tongue' | 'msg_emoji_vacation3'
| 'msg_emoji_activities2' | 'msg_emoji_away' | 'msg_emoji_bath' | 'msg_emoji_busy'
| 'msg_emoji_food' | 'msg_emoji_happy' | 'msg_emoji_hi2' | 'msg_emoji_home'
| 'msg_emoji_sleep' | 'msg_emoji_study' | 'msg_emoji_work'
>;

export const MSG_EMOJI_GROUPS: { id: EmojiGroupIconName; emojis: string[] }[] = [
  {
    id: 'msg_emoji_heart',
    emojis: [
      '❤️', '😍', '🥰', '😘', '☺️', '🤗', '😚', '😙', '💋', '🍑',
      '👄', '😻', '❤️‍🔥', '💗', '💞', '💕', '💖', '🧡', '💛', '💚',
      '💙', '💜', '🖤', '🤍', '🤎', '💓', '💘', '💝', '💟', '👩‍❤️‍👨', '👩‍❤️‍👩',
    ],
  },
  { id: 'msg_emoji_like', emojis: ['👍', '👏', '👌', '💪', '😌', '✌️', '🤝', '✔️', '🆗', '✅'] },
  { id: 'msg_emoji_dislike', emojis: ['👎', '😒', '🤮', '🤢', '🤦‍♂️', '🤦‍♀️', '🙅‍♀️', '🙅‍♂️'] },
  { id: 'msg_emoji_party', emojis: ['🎉', '🥳', '🤩', '🎊', '🥂', '🍾', '🌟', '🍻', '🎂', '💃', '🎁'] },
  { id: 'msg_emoji_haha', emojis: ['😄', '😁', '😆', '😅', '😂', '🤣', '😀', '🤭', '😃', '😬', '😈'] },
  { id: 'msg_emoji_omg', emojis: ['😨', '😦', '😱', '😯', '😧', '😮', '😲', '🤯', '😵', '😳', '😰'] },
  { id: 'msg_emoji_sad', emojis: ['😔', '😪', '😭', '😢', '😣', '😞', '🥺', '💔', '☹️', '😕', '🙁', '😒', '😥', '😫', '😮‍💨', '😟'] },
  { id: 'msg_emoji_angry', emojis: ['😡', '🤬', '👿', '😠', '😤', '🖕', '💢'] },
  { id: 'msg_emoji_neutral', emojis: ['😐', '😑', '😕', '😶', '🙃', '🙂', '🤐', '🥶'] },
  { id: 'msg_emoji_what', emojis: ['🤔', '🤨', '🧐', '🙄', '😵‍💫', '❓', '🤷‍♀️', '🤷‍♂️'] },
  { id: 'msg_emoji_tongue', emojis: ['🤪', '😜', '😝', '😛', '🤡', '🥴'] },
  { id: 'msg_emoji_vacation3', emojis: ['🏝', '✈️', '🏖', '⛱', '🚅', '🚗', '🛳', '🥂'] },
  { id: 'msg_emoji_activities2', emojis: ['🏃‍♀️', '🏃‍♂️', '⚽️', '⚾️', '🏉', '🪀', '🏒', '🏏', '🛷'] },
  { id: 'msg_emoji_away', emojis: ['🛳', '🧘‍♀️', '🧘‍♂️', '🍺', '🥂', '🚅', '🚗'] },
  { id: 'msg_emoji_bath', emojis: ['🧖', '🧖‍♂️', '🛁', '🧖‍♀️', '🧼', '🛀', '🧽', '🚽', '🚿', '💭'] },
  { id: 'msg_emoji_busy', emojis: ['👩‍💻', '🧑‍💻', '📎', '💪', '🗂', '👨‍💻', '🗃', '👷', '👷‍♂️', '👷‍♀️'] },
  {
    id: 'msg_emoji_food',
    emojis: [
      '🍫', '🍟', '🥓', '🍍', '🥙', '🍯', '🥐', '🍬', '🥟', '🥦', '🍙',
      '🍣', '🥩', '🥗', '🍩', '🍊', '🍨', '🥔', '🍛', '🍌', '🍮', '🌽',
      '🍧', '🍓', '🥜', '🌯', '🍚', '🍐🥨', '🍒', '🍢',
    ],
  },
  { id: 'msg_emoji_happy', emojis: ['😁', '🙂', '😂', '😋', '☺️', '🤩', '😹', '😀', '😈', '😺', '😊', '😄', '😸', '😃'] },
  { id: 'msg_emoji_hi2', emojis: ['✋', '👋', '🤙', '🖖', '🤚', '🙌', '🤞', '🌺'] },
  { id: 'msg_emoji_home', emojis: ['🏘', '❣️', '👬', '🏠', '🏡', '🏘', '🏚', '🏰', '🏯', '🌇', '🌆', '🏙', '🌃', '🌌', '🌉'] },
  { id: 'msg_emoji_sleep', emojis: ['💤', '🛏', '🥱', '🛌', '😴', '😪'] },
  { id: 'msg_emoji_study', emojis: ['🧑‍🎓', '👩‍🏫', '🧑‍🏫', '👨‍🏫', '👨‍🎓', '👩‍🎓'] },
  {
    id: 'msg_emoji_work',
    emojis: [
      '👨‍💻', '👷‍♀️', '👷‍♂️', '👩‍💻', '🗂', '🗃', '💪', '🧑‍💻', '👷', '📎', '👨‍💼',
      '🧑‍🏭', '👨‍🏭', '👩‍💼', '👩‍🏭', '👨‍🔧', '👩‍🔧', '🛠', '💻', '✍️', '💼', '🐜', '👩‍⚕️', '👨‍⚕️',
    ],
  },
];

const MSG_EMOJI_GROUP_BUTTON_WIDTH = 2.125 * REM; // Includes margins
const SEARCH_HALF_WIDTH = 9 * REM;

const SymbolSearch: FC<OwnProps> = ({
  ref,
  resultsItemSelector,
  value,
  groupValue,
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
  teactExperimentControlled,
  onChange,
  onGroupValueChange,
  onStartBackspace,
  onReset,
  onFocus,
  onBlur,
  onClick,
  onSpinnerClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  let inputRef = useRef<HTMLInputElement>(null);
  if (ref) {
    inputRef = ref;
  }

  const [isInputFocused, markInputFocused, unmarkInputFocused] = useFlag(focused);

  // eslint-disable-next-line no-null/no-null
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useAppLayout();

  useHorizontalScroll(inputContainerRef, isMobile || !!value, true);

  useInputFocusOnOpen(inputRef, autoFocusSearch, unmarkInputFocused);

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

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { currentTarget } = event;
    onChange(currentTarget.value);

    if (!isInputFocused) {
      handleFocus();
    }
  }

  const handleGroupValueChange = useLastCallback((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    const { id } = event.currentTarget;
    onGroupValueChange(id as EmojiGroupIconName);
  });

  function handleFocus() {
    markInputFocused();
    onFocus?.();
  }

  function handleBlur() {
    unmarkInputFocused();
    onBlur?.();
  }

  const handleReset = useLastCallback(() => {
    onReset?.();
    const container = inputContainerRef.current;
    if (!container) {
      return;
    }
    animateHorizontalScroll(container, 0);
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

  // Scroll container and header when active set changes
  useEffect(() => {
    if (value || !groupValue) {
      return;
    }

    const container = inputContainerRef.current;
    if (!container) {
      return;
    }

    const activeIndex = MSG_EMOJI_GROUPS.findIndex((group) => group.id === groupValue);

    const newLeft = SEARCH_HALF_WIDTH + activeIndex * MSG_EMOJI_GROUP_BUTTON_WIDTH
      - (container.offsetWidth / 2 - MSG_EMOJI_GROUP_BUTTON_WIDTH / 2);

    animateHorizontalScroll(container, newLeft);
  }, [value, groupValue]);

  return (
    <div
      className={buildClassName('SymbolSearch', className, isInputFocused && 'has-focus')}
      onClick={onClick}
      dir={oldLang.isRtl ? 'rtl' : undefined}
    >
      <Transition
        name="fade"
        shouldCleanup
        activeKey={Number(!isLoading && !groupValue)}
        className="icon-container-left"
        slideClassName="icon-container-slide"
      >
        {isLoading && !groupValue ? (
          <Loading color={spinnerColor} backgroundColor={spinnerBackgroundColor} onClick={onSpinnerClick} />
        ) : groupValue ? (
          <Icon name="arrow-left" className="back-icon" onClick={handleReset} />
        ) : (
          <Icon name="search" className="search-icon" />
        )}
      </Transition>
      <div ref={inputContainerRef} className="input-overflowing-container">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          dir="auto"
          placeholder={(placeholder || oldLang('Search'))}
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
        <Transition
          name="fade"
          shouldCleanup
          activeKey={Number(!!value)}
          className={buildClassName('icon-container-right', !value && 'moved-left')}
          slideClassName="icon-container-slide"
        >
          {(value || canClose) && onReset ? (
            <Button
              round
              size="tiny"
              color="translucent"
              onClick={handleReset}
            >
              <Icon name="close" />
            </Button>
          ) : (
            <div className="emoji-groups">
              {MSG_EMOJI_GROUPS.map((group) => (
                <Button
                  key={group.id}
                  id={group.id}
                  round
                  size="tiny"
                  color="translucent"
                  className={buildClassName('emoji-group-button', groupValue === group.id && 'activated')}
                  onClick={handleGroupValueChange}
                >
                  <Icon name={group.id} />
                </Button>
              ))}
            </div>
          )}
        </Transition>
      </div>
    </div>
  );
};

export default memo(SymbolSearch);
