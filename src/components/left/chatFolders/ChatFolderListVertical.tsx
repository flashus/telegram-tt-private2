import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import type { ChatFolderWithProperties } from '../hooks/useChatFolders';

import buildClassName from '../../../util/buildClassName';

import useShowTransition from '../../../hooks/useShowTransition';

import ChatFolderListVerticalItem from './ChatFolderListVerticalItem';

import './ChatFolderListVertical.scss';

type OwnProps = {
  chatFolders?: ChatFolderWithProperties[];
  orderedFolderIds?: number[];
  activeChatFolder: number;
  handleSwitchChatFolder: (index: number) => void;
};

const ChatFolderListVertical: FC<OwnProps> = ({
  chatFolders,
  orderedFolderIds,
  activeChatFolder,
  handleSwitchChatFolder,
}) => {
  const {
    ref: placeholderRef,
    shouldRender: shouldRenderPlaceholder,
  } = useShowTransition({
    isOpen: !orderedFolderIds,
    noMountTransition: true,
    withShouldRender: true,
  });

  const shouldRenderFolders = chatFolders && chatFolders.length > 1;

  return (
    shouldRenderFolders ? (
      <div
        className={buildClassName('ChatFolderList', 'custom-scroll', 'vertical', 'with-icons')}
      >
        {chatFolders.map((chatFolder, i) => (
          <ChatFolderListVerticalItem
            key={chatFolder.id}
            title={chatFolder.title}
            iconEmojiText={chatFolder.iconEmojiText}
            iconName={chatFolder.iconName}
            isActive={i === activeChatFolder}
            isBlocked={chatFolder.isBlocked}
            badgeCount={chatFolder.badgeCount}
            isBadgeActive={chatFolder.isBadgeActive}
            onClick={handleSwitchChatFolder}
            clickArg={i}
            contextActions={chatFolder.contextActions}
            contextRootElementSelector="#LeftColumn"
          />
        ))}
      </div>
    ) : shouldRenderPlaceholder ? (
      <div ref={placeholderRef} className="tabs-placeholder" />
    ) : undefined
  );
};

// <TabList
//   contextRootElementSelector="#LeftColumn"
//   tabs={chatFolders}
//   activeTab={activeChatFolder}
//   onSwitchTab={handleSwitchChatFolder}
// />

export default memo(ChatFolderListVertical);
