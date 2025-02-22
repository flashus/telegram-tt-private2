import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiChatFolder, ApiChatlistExportedInvite } from '../../../api/types';
import type { LeftColumnContent } from '../../../types';

import {
  selectTabState,
} from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';

import useChatFolders from '../hooks/useChatFolders';

import ChatFolderListHorizontal from './ChatFolderListHorizontal';
import ChatFolderListVertical from './ChatFolderListVertical';

export enum ChatFolderListLayout {
  Horizontal,
  Vertical,
}

type OwnProps = {
  layout: ChatFolderListLayout;
  onLeftColumnContentChange: (content: LeftColumnContent) => void;
};

type StateProps = {
  currentUserId?: string;
  chatFoldersById: Record<number, ApiChatFolder>;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  maxFolders: number;
  maxChatLists: number;
  maxFolderInvites: number;
};

const ChatFolderList: FC<OwnProps & StateProps> = ({
  layout,
  currentUserId,
  chatFoldersById,
  folderInvitesById,
  orderedFolderIds,
  activeChatFolder,
  maxFolders,
  maxChatLists,
  maxFolderInvites,
  onLeftColumnContentChange,
}) => {
  const {
    chatFolders,
    handleSwitchChatFolder,
  } = useChatFolders({
    chatFoldersById,
    folderInvitesById,
    orderedFolderIds,
    activeChatFolder,
    currentUserId,
    maxFolders,
    maxChatLists,
    maxFolderInvites,
    onLeftColumnContentChange,
  });

  return (
    <>
      {layout === ChatFolderListLayout.Horizontal && (
        <ChatFolderListHorizontal
          chatFolders={chatFolders}
          orderedFolderIds={orderedFolderIds}
          activeChatFolder={activeChatFolder}
          handleSwitchChatFolder={handleSwitchChatFolder}
        />
      )}
      {layout === ChatFolderListLayout.Vertical && (
        <ChatFolderListVertical
          chatFolders={chatFolders}
          orderedFolderIds={orderedFolderIds}
          activeChatFolder={activeChatFolder}
          handleSwitchChatFolder={handleSwitchChatFolder}
        />
      )}
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        invites: folderInvitesById,
      },
      currentUserId,
    } = global;
    const { activeChatFolder } = selectTabState(global);

    return {
      currentUserId,
      chatFoldersById,
      folderInvitesById,
      orderedFolderIds,
      activeChatFolder,
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
    };
  },
)(ChatFolderList));
