import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo, useEffect, useLayoutEffect, useRef, useState,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import type { GlobalActions } from '../../../../global';
import type { IconName } from '../../../../types/icons';
import type { MenuPositionOptions } from '../../../ui/Menu';

import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { selectIsContextMenuTranslucent, selectTabState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { IS_TOUCH_ENV } from '../../../../util/windowEnvironment';

import useAppLayout from '../../../../hooks/useAppLayout';
import useLastCallback from '../../../../hooks/useLastCallback';
import useMouseInside from '../../../../hooks/useMouseInside';
import useOldLang from '../../../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../../../hooks/useShowTransitionDeprecated';

import Icon from '../../../common/icons/Icon';
import Button from '../../../ui/Button';
import Menu from '../../../ui/Menu';
import Portal from '../../../ui/Portal';
import SettingsFolderIconPicker from './SettingsFolderIconPicker';

import '../../../middle/composer/SymbolMenu.scss';

const ANIMATION_DURATION = 350;

export type OwnProps = {
  isOpen: boolean;
  idPrefix: string;
  onLoad: () => void;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onCustomEmojiSelect: (emoji: ApiSticker) => void;
  onSvgIconSelect: (svgIcon: IconName) => void;
  onSearchOpen: (type: 'stickers' | 'gifs') => void;
  addRecentEmoji: GlobalActions['addRecentEmoji'];
  addRecentCustomEmoji: GlobalActions['addRecentCustomEmoji'];
  className?: string;
}
& MenuPositionOptions;

type StateProps = {
  isLeftColumnShown: boolean;
  isBackgroundTranslucent?: boolean;
};

let isActivated = false;

const SettingsFolderIconMenu: FC<OwnProps & StateProps> = ({
  isOpen,
  isLeftColumnShown,
  idPrefix,
  className,
  isBackgroundTranslucent,
  onLoad,
  onClose,
  onEmojiSelect,
  onCustomEmojiSelect,
  onSvgIconSelect,
  onSearchOpen,
  addRecentEmoji,
  addRecentCustomEmoji,
  ...menuPositionOptions
}) => {
  // const [activeTab, setActiveTab] = useState<number>(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [recentCustomEmojis, setRecentCustomEmojis] = useState<string[]>([]);
  const { isMobile } = useAppLayout();

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose, undefined, isMobile);
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen, onClose, false, false);

  const lang = useOldLang();

  if (!isActivated && isOpen) {
    isActivated = true;
  }

  useEffect(() => {
    onLoad();
  }, [onLoad]);

  useLayoutEffect(() => {
    if (!isMobile || !isOpen) {
      return undefined;
    }

    document.body.classList.add('enable-symbol-menu-transforms');
    document.body.classList.add('is-symbol-menu-open');

    return () => {
      document.body.classList.remove('is-symbol-menu-open');

      setTimeout(() => {
        requestMutation(() => {
          document.body.classList.remove('enable-symbol-menu-transforms');
        });
      }, ANIMATION_DURATION);
    };
  }, [isMobile, isOpen]);

  const recentEmojisRef = useRef(recentEmojis);
  recentEmojisRef.current = recentEmojis;
  useEffect(() => {
    if (!recentEmojisRef.current.length || isOpen) {
      return;
    }

    recentEmojisRef.current.forEach((name) => {
      addRecentEmoji({ emoji: name });
    });

    setRecentEmojis([]);
  }, [isOpen, addRecentEmoji]);

  const handleEmojiSelect = useLastCallback((emoji: string, name: string) => {
    setRecentEmojis((emojis) => [...emojis, name]);

    onEmojiSelect(emoji);
  });

  const recentCustomEmojisRef = useRef(recentCustomEmojis);
  recentCustomEmojisRef.current = recentCustomEmojis;
  useEffect(() => {
    if (!recentCustomEmojisRef.current.length || isOpen) {
      return;
    }

    recentCustomEmojisRef.current.forEach((documentId) => {
      addRecentCustomEmoji({
        documentId,
      });
    });

    setRecentEmojis([]);
  }, [isOpen, addRecentCustomEmoji]);

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    setRecentCustomEmojis((ids) => [...ids, emoji.id]);

    onCustomEmojiSelect(emoji);
  });

  const handleSvgIconSelect = useLastCallback((svgIcon: IconName) => {
    onSvgIconSelect(svgIcon);
  });

  function stopPropagation(event: any) {
    event.stopPropagation();
  }

  const content = (
    <>
      <div className="SettingsFolderIconMenu-main SymbolMenu-main" onClick={stopPropagation}>
        <SettingsFolderIconPicker
          loadAndPlay
          onSvgIconSelect={handleSvgIconSelect}
          onEmojiSelect={handleEmojiSelect}
          onCustomEmojiSelect={handleCustomEmojiSelect}
        />
      </div>
      {isMobile && (
        <Button
          round
          faded
          color="translucent"
          ariaLabel={lang('Close')}
          className="symbol-close-button"
          size="tiny"
          onClick={onClose}
        >
          <Icon name="close" />
        </Button>
      )}
    </>
  );

  if (isMobile) {
    if (!shouldRender) {
      return undefined;
    }

    const mobileClassName = buildClassName(
      'SettingsFolderIconMenu SymbolMenu mobile-menu',
      transitionClassNames,
      isLeftColumnShown && 'left-column-open',
    );

    return (
      <Portal>
        <div className={mobileClassName}>
          {content}
        </div>
      </Portal>
    );
  }

  return (
    <Menu
      isOpen={isOpen}
      onClose={onClose}
      withPortal
      className={buildClassName('SettingsFolderIconMenu SymbolMenu', className)}
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
      noCompact
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...(menuPositionOptions)}
    >
      {content}
    </Menu>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      isLeftColumnShown: selectTabState(global).isLeftColumnShown,
      isBackgroundTranslucent: selectIsContextMenuTranslucent(global),
    };
  },
)(SettingsFolderIconMenu));
