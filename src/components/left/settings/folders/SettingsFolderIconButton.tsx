import type { FC, TeactNode } from '../../../../lib/teact/teact';
import React, { memo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import type { IAnchorPosition } from '../../../../types';
import type { IconName } from '../../../../types/icons';

import buildClassName from '../../../../util/buildClassName';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

import Icon from '../../../common/icons/Icon';
import Button from '../../../ui/Button';
import ResponsiveHoverButton from '../../../ui/ResponsiveHoverButton';
import Spinner from '../../../ui/Spinner';
import SettingsFolderIconMenu from './SettingsFolderIconMenu';

import './SettingsFolderIconButton.scss';

const MOBILE_KEYBOARD_HIDE_DELAY_MS = 100;

type OwnProps = {
  icon: TeactNode;
  isMobile?: boolean;
  isReady?: boolean;
  isSymbolMenuOpen: boolean;
  idPrefix: string;
  openSymbolMenu: VoidFunction;
  closeSymbolMenu: VoidFunction;
  onCustomEmojiSelect: (emoji: ApiSticker) => void;
  onSvgIconSelect: (icon: IconName) => void;
  onEmojiSelect: (emoji: string) => void;
  className?: string;
  inputCssSelector: string;
};

const SettingsFolderIconButton: FC<OwnProps> = ({
  icon,
  isMobile,
  isReady,
  isSymbolMenuOpen,
  idPrefix,
  className,
  inputCssSelector,
  openSymbolMenu,
  closeSymbolMenu,
  onCustomEmojiSelect,
  onSvgIconSelect,
  onEmojiSelect,
}) => {
  const {
    setStickerSearchQuery,
    setGifSearchQuery,
    addRecentEmoji,
    addRecentCustomEmoji,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const triggerRef = useRef<HTMLDivElement>(null);

  const [isSymbolMenuLoaded, onSymbolMenuLoadingComplete] = useFlag();
  const [contextMenuAnchor, setContextMenuAnchor] = useState<IAnchorPosition | undefined>(undefined);

  const symbolMenuButtonClassName = buildClassName(
    'mobile-symbol-menu-button',
    !isReady && 'not-ready',
    isSymbolMenuLoaded
      ? (isSymbolMenuOpen && 'menu-opened')
      : (isSymbolMenuOpen && 'is-loading'),
  );

  const handleActivateSymbolMenu = useLastCallback(() => {
    openSymbolMenu();
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    const { x, y } = triggerEl.getBoundingClientRect();
    setContextMenuAnchor({ x, y: y - 60 }); // 60 puts is directly below the icon button
  });

  const handleSearchOpen = useLastCallback((type: 'stickers' | 'gifs') => {
    if (type === 'stickers') {
      setStickerSearchQuery({ query: '' });
      setGifSearchQuery({ query: undefined });
    } else {
      setGifSearchQuery({ query: '' });
      setStickerSearchQuery({ query: undefined });
    }
  });

  const handleSymbolMenuOpen = useLastCallback(() => {
    const messageInput = document.querySelector<HTMLDivElement>(inputCssSelector);

    if (!isMobile || messageInput !== document.activeElement) {
      openSymbolMenu();
      return;
    }

    messageInput?.blur();
    setTimeout(() => {
      openSymbolMenu();
    }, MOBILE_KEYBOARD_HIDE_DELAY_MS);
  });

  const getTriggerElement = useLastCallback(() => triggerRef.current);
  const getRootElement = useLastCallback(() => triggerRef.current?.closest('.custom-scroll, .no-scrollbar'));
  const getMenuElement = useLastCallback(() => document.querySelector('#portals .SymbolMenu .bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  return (
    <>
      {isMobile ? (
        <Button
          className={symbolMenuButtonClassName}
          round
          color="translucent"
          onClick={isSymbolMenuOpen ? closeSymbolMenu : handleSymbolMenuOpen}
          ariaLabel="Choose svg icon, emoji or a custom emoji"
        >
          {icon}
          <Icon name="keyboard" />
          {isSymbolMenuOpen && !isSymbolMenuLoaded && <Spinner color="gray" />}
        </Button>
      ) : (
        <ResponsiveHoverButton
          className={buildClassName('symbol-menu-button', isSymbolMenuOpen && 'activated')}
          round
          color="translucent"
          onActivate={handleActivateSymbolMenu}
          ariaLabel="Choose svg icon, emoji or a custom emoji"
        >
          <div ref={triggerRef} className="symbol-menu-trigger" />
          {icon}
        </ResponsiveHoverButton>
      )}

      <SettingsFolderIconMenu
        isOpen={isSymbolMenuOpen}
        idPrefix={idPrefix}
        onLoad={onSymbolMenuLoadingComplete}
        onClose={closeSymbolMenu}
        onEmojiSelect={onEmojiSelect}
        onCustomEmojiSelect={onCustomEmojiSelect}
        onSvgIconSelect={onSvgIconSelect}
        onSearchOpen={handleSearchOpen}
        addRecentEmoji={addRecentEmoji}
        addRecentCustomEmoji={addRecentCustomEmoji}
        className={className}
        anchor={contextMenuAnchor}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        getLayout={getLayout}
      />
    </>
  );
};

export default memo(SettingsFolderIconButton);
