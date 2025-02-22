import type { RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, { getIsHeavyAnimating, memo } from '../../../lib/teact/teact';

import type { PreviewMessageListType, ThreadId } from '../../../types';
import type { MessageDateGroup } from '../../middle/helpers/groupMessages';
import type { OnIntersectPinnedMessage } from '../../middle/hooks/usePinnedMessage';

import {
  getMessageHtmlId,
  getMessageOriginalId,
  isOwnMessage,
  isServiceNotificationMessage,
} from '../../../global/helpers';
import { compact } from '../../../util/iteratees';
import { isAlbum } from '../../middle/helpers/groupMessages';

import useDerivedSignal from '../../../hooks/useDerivedSignal';
import useMessageObservers from '../../middle/hooks/useMessageObservers';

import PreviewMessage from './PreviewMessage';

interface OwnProps {
  chatId: string;
  threadId: ThreadId;
  messageGroups: MessageDateGroup[];
  withUsers: boolean;
  isChannelChat: boolean | undefined;
  isComments?: boolean;
  noAvatars: boolean;
  containerRef: RefObject<HTMLDivElement>;
  anchorIdRef: { current: string | undefined };
  type: PreviewMessageListType;
  isReady: boolean;
  hasLinkedChat: boolean | undefined;
  noAppearanceAnimation: boolean;
  onIntersectPinnedMessage: OnIntersectPinnedMessage;
}

const PreviewMessageListContent: FC<OwnProps> = ({
  chatId,
  threadId,
  messageGroups,
  isComments,
  withUsers,
  isChannelChat,
  noAvatars,
  containerRef,
  anchorIdRef,
  type,
  isReady,
  hasLinkedChat,
  noAppearanceAnimation,
  onIntersectPinnedMessage,
}) => {
  const getIsHeavyAnimating2 = getIsHeavyAnimating;
  const getIsReady = useDerivedSignal(() => isReady && !getIsHeavyAnimating2(), [isReady, getIsHeavyAnimating2]);

  // Hard workarounds to prevent editing existing methods
  // and hooks like useMessageObservers or useScrollHooks
  const memoFirstUnreadIdRef = { current: undefined };
  const messageListType = 'thread';

  const {
    observeIntersectionForReading,
    observeIntersectionForLoading,
    observeIntersectionForPlaying,
  } = useMessageObservers(messageListType, containerRef, memoFirstUnreadIdRef, onIntersectPinnedMessage, chatId);

  const messageCountToAnimate = noAppearanceAnimation ? 0 : messageGroups.reduce((acc, messageGroup) => {
    return acc + messageGroup.senderGroups.flat().length;
  }, 0);
  let appearanceIndex = 0;

  function calculateSenderGroups(
    dateGroup: MessageDateGroup, dateGroupIndex: number, dateGroupsArray: MessageDateGroup[],
  ) {
    return dateGroup.senderGroups.map((
      senderGroup,
      senderGroupIndex,
      senderGroupsArray,
    ) => {
      let currentDocumentGroupId: string | undefined;

      const senderGroupElements = senderGroup.map((
        messageOrAlbum,
        messageIndex,
      ) => {
        const message = isAlbum(messageOrAlbum) ? messageOrAlbum.mainMessage : messageOrAlbum;
        const album = isAlbum(messageOrAlbum) ? messageOrAlbum : undefined;
        const isOwn = isOwnMessage(message);
        const isMessageAlbum = isAlbum(messageOrAlbum);
        const nextMessage = senderGroup[messageIndex + 1];

        if (message.previousLocalId && anchorIdRef.current === getMessageHtmlId(message.previousLocalId)) {
          anchorIdRef.current = getMessageHtmlId(message.id);
        }

        const documentGroupId = !isMessageAlbum && message.groupedId ? message.groupedId : undefined;
        const nextDocumentGroupId = nextMessage && !isAlbum(nextMessage) ? nextMessage.groupedId : undefined;
        const isTopicTopMessage = message.id === threadId;

        const position = {
          isFirstInGroup: messageIndex === 0,
          isLastInGroup: messageIndex === senderGroup.length - 1,
          isFirstInDocumentGroup: Boolean(documentGroupId && documentGroupId !== currentDocumentGroupId),
          isLastInDocumentGroup: Boolean(documentGroupId && documentGroupId !== nextDocumentGroupId),
          isLastInList: (
            messageIndex === senderGroup.length - 1
            && senderGroupIndex === senderGroupsArray.length - 1
            && dateGroupIndex === dateGroupsArray.length - 1
          ),
        };

        currentDocumentGroupId = documentGroupId;

        const originalId = getMessageOriginalId(message);
        // Service notifications saved in cache in previous versions may share the same `previousLocalId`
        const key = isServiceNotificationMessage(message) ? `${message.date}_${originalId}` : originalId;

        const noComments = hasLinkedChat === false || !isChannelChat;

        return compact([
          <PreviewMessage
            key={key}
            message={message}
            observeIntersectionForBottom={observeIntersectionForReading}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            album={album}
            noAvatars={noAvatars}
            withAvatar={position.isLastInGroup && withUsers && !isOwn && (!isTopicTopMessage || !isComments)}
            withSenderName={position.isFirstInGroup && withUsers && !isOwn}
            threadId={threadId}
            messageListType={messageListType}
            previewMessageListType={type}
            noComments={noComments}
            noReplies
            appearanceOrder={messageCountToAnimate - ++appearanceIndex}
            isJustAdded={false}
            isFirstInGroup={position.isFirstInGroup}
            isLastInGroup={position.isLastInGroup}
            isFirstInDocumentGroup={position.isFirstInDocumentGroup}
            isLastInDocumentGroup={position.isLastInDocumentGroup}
            isLastInList={position.isLastInList}
            memoFirstUnreadIdRef={memoFirstUnreadIdRef}
            onIntersectPinnedMessage={onIntersectPinnedMessage}
            getIsMessageListReady={getIsReady}
          />,
        ]);
      }).flat();

      return senderGroupElements;
    });
  }

  const dateGroups = messageGroups.map((
    dateGroup: MessageDateGroup,
    dateGroupIndex: number,
    dateGroupsArray: MessageDateGroup[],
  ) => {
    const senderGroups = calculateSenderGroups(dateGroup, dateGroupIndex, dateGroupsArray);

    return senderGroups.flat();
  });

  return (
    <div className="messages-container" teactFastList>
      {dateGroups.flat()}
    </div>
  );
};

export default memo(PreviewMessageListContent);
