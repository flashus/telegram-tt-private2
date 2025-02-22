import type { FC, TeactNode } from '../../../lib/teact/teact';
import React, { memo, useRef } from '../../../lib/teact/teact';

import type { ApiFormattedText } from '../../../api/types';
import type { IconName } from '../../../types/icons';
import type { MenuItemContextAction } from '../../ui/ListItem';

import buildClassName from '../../../util/buildClassName';
import { MouseButton } from '../../../util/windowEnvironment';
import renderText from '../../common/helpers/renderText';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import { useFastClick } from '../../../hooks/useFastClick';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import RippleEffect from '../../ui/RippleEffect';
import ChatFolderIcon from './ChatFolderIcon';

type OwnProps = {
  title: TeactNode;
  iconEmojiText?: ApiFormattedText;
  iconName: IconName;
  isActive?: boolean;
  isBlocked?: boolean;
  badgeCount?: number;
  isBadgeActive?: boolean;
  onClick?: (arg: number) => void;
  clickArg?: number;
  contextActions?: MenuItemContextAction[];
  contextRootElementSelector?: string;
};

const ChatFolderListVerticalItem: FC<OwnProps> = ({
  title,
  iconEmojiText,
  iconName,
  isActive,
  isBlocked,
  badgeCount,
  isBadgeActive,
  onClick,
  clickArg,
  contextActions,
  contextRootElementSelector,
}) => {
  // eslint-disable-next-line no-null/no-null
  const chatFolderItemRef = useRef<HTMLDivElement>(null);

  const {
    contextMenuAnchor, handleContextMenu, handleBeforeContextMenu, handleContextMenuClose,
    handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(chatFolderItemRef, !contextActions);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    onClick?.(clickArg!);
  });

  const getTriggerElement = useLastCallback(() => chatFolderItemRef.current);
  const getRootElement = useLastCallback(
    () => (contextRootElementSelector ? chatFolderItemRef.current!.closest(contextRootElementSelector) : document.body),
  );
  const getMenuElement = useLastCallback(
    () => document.querySelector('#portals')!.querySelector('.Tab-context-menu .bubble'),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  return (
    <div
      className={buildClassName('item', isActive && 'active', 'has-ripple')}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      ref={chatFolderItemRef}
    >
      {Boolean(badgeCount) && (
        <span
          className={buildClassName('badge', isBadgeActive && 'active')}
        >
          {badgeCount}
        </span>
      )}
      {isBlocked && <Icon name="lock-badge" className="blocked" />}
      <ChatFolderIcon
        iconEmojiText={iconEmojiText}
        iconName={iconName}
      />
      <div className={buildClassName('title')}>
        {renderText(title)}
      </div>
      <RippleEffect />
      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="Tab-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </div>
  );
};

export default memo(ChatFolderListVerticalItem);
