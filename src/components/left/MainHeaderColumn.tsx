import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { LeftColumnContent } from '../../types';

import useLastCallback from '../../hooks/useLastCallback';

import ChatFolderList, { ChatFolderListLayout } from './chatFolders/ChatFolderList';
import MainButton from './MainButton';

import './MainHeaderColumn.scss';

type OwnProps = {
  onContentChange: (content: LeftColumnContent) => void;
};

const MainHeaderColumn: FC<OwnProps> = ({
  onContentChange,
}) => {
  const { closeForumPanel } = getActions();

  const handleSelectSettings = useLastCallback(() => {
    onContentChange(LeftColumnContent.Settings);
  });

  const handleSelectContacts = useLastCallback(() => {
    onContentChange(LeftColumnContent.Contacts);
  });

  const handleSelectArchived = useLastCallback(() => {
    onContentChange(LeftColumnContent.Archived);
    closeForumPanel();
  });

  return (
    <div id="MainHeaderColumn">
      <MainButton
        hasMenu
        onSelectArchived={handleSelectArchived}
        onSelectContacts={handleSelectContacts}
        onSelectSettings={handleSelectSettings}
      />
      <ChatFolderList
        layout={ChatFolderListLayout.Vertical}
        onLeftColumnContentChange={onContentChange}
      />
    </div>
  );
};

export default memo(MainHeaderColumn);
