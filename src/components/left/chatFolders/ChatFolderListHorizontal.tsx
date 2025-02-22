import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import type { ChatFolderWithProperties } from '../hooks/useChatFolders';

import useShowTransition from '../../../hooks/useShowTransition';

import TabList from '../../ui/TabList';

type OwnProps = {
  chatFolders?: ChatFolderWithProperties[];
  orderedFolderIds?: number[];
  activeChatFolder: number;
  handleSwitchChatFolder: (index: number) => void;
};

const ChatFolderListHorizontal: FC<OwnProps> = ({
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
      <TabList
        contextRootElementSelector="#LeftColumn"
        tabs={chatFolders}
        activeTab={activeChatFolder}
        onSwitchTab={handleSwitchChatFolder}
      />
    ) : shouldRenderPlaceholder ? (
      <div ref={placeholderRef} className="tabs-placeholder" />
    ) : undefined
  );
};

export default memo(ChatFolderListHorizontal);
