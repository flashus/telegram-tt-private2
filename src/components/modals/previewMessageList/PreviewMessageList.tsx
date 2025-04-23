import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { PreviewMessageListType, ThreadId } from '../../../types';

import { forceMeasure } from '../../../lib/fasterdom/fasterdom';
import {
  isAnonymousForwardsChat,
  isChatChannel,
  isSystemBot,
  isUserId,
} from '../../../global/helpers';
import {
  selectChat,
  selectIsChatWithSelf,
  selectIsInSelectMode,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { orderBy } from '../../../util/iteratees';
import { debounce } from '../../../util/schedulers';
import { groupMessages } from '../../middle/helpers/groupMessages';
import { preventMessageInputBlur } from '../../middle/helpers/preventMessageInputBlur';

import useLastCallback from '../../../hooks/useLastCallback';
import useNativeCopySelectedMessages from '../../../hooks/useNativeCopySelectedMessages';
import { useStateRef } from '../../../hooks/useStateRef';
import useSyncEffect from '../../../hooks/useSyncEffect';
import useContainerHeight from '../../middle/hooks/useContainerHeight';

import Loading from '../../ui/Loading';
import PreviewMessageListContent from './PreviewMessageListContent';

import '../../middle/MessageList.scss';
import styles from './PreviewMessageList.module.scss';

/**
 * Reasons to make a component that is separate from MessageList:
 * 1. It must have its own background. Could wrap original MessageList in another component - not a reason
 * 2. MessageList has a lot of listeners, actions, hooks, etc that are not needed at all for preview
 * 3. This one will behave differently based on circumstances
 *     - if it's a reply or quote, there will be one message that will be able to be selected and quoted
 *     - if it's a forward message list, no actions will be possible, only scrolling and a flag to show message authors
 */

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  type: PreviewMessageListType;
  isComments?: boolean;
  isReady: boolean;
  withBottomShift?: boolean;
  withDefaultBg: boolean;
  shouldAnimate?: boolean;
  messageIds?: number[];
  messagesById?: Record<number, ApiMessage>;
  forwardsNoCaptions?: boolean;
};

type StateProps = {
  isAnonymousForwards?: boolean;
  isChatWithSelf?: boolean;
  isChannelChat?: boolean;
  isSystemBotChat?: boolean;
  isChannelWithAvatars?: boolean;
  isSelectModeActive?: boolean; // remove?
  currentUserId?: string;
};

const SCROLL_DEBOUNCE = 200;

const runDebouncedForScroll = debounce((cb) => cb(), SCROLL_DEBOUNCE, false);

const PreviewMessageList: FC<OwnProps & StateProps> = ({
  type,
  chatId,
  threadId,
  isReady,
  isChatWithSelf,
  isChannelChat,
  isSystemBotChat,
  isChannelWithAvatars,
  // shouldAnimate,
  isAnonymousForwards,
  messageIds,
  messagesById,
  forwardsNoCaptions,
  isComments,
  isSelectModeActive,
  currentUserId,
  withBottomShift,
  withDefaultBg,
}) => {
  const { setScrollOffset, copyMessagesByIds } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollOffsetRef = useRef<number>(0);

  const anchorIdRef = useRef<string>();
  const anchorTopRef = useRef<number>();
  const listItemElementsRef = useRef<HTMLDivElement[]>();
  const isScrollTopJustUpdatedRef = useRef(false);

  // Hard workarounds to prevent editing existing methods
  // and hooks like groupMessages
  const memoUnreadDividerBeforeIdRef = { current: undefined };

  useNativeCopySelectedMessages(copyMessagesByIds);

  const messageGroups = useMemo(() => {
    if (!messageIds?.length || !messagesById) {
      return undefined;
    }

    const listedMessages: ApiMessage[] = [];
    messageIds.forEach((id) => {
      const message = messagesById[id];
      if (!message) {
        return;
      }

      const hasCaption = message.content.text && Object.keys(message.content).length > 1;
      const preventCaptionRender = hasCaption && forwardsNoCaptions;

      // Map messages so they seem like they were actually already forwarded by the current user
      const previewMessage = type === 'forward'
        ? {
          ...message,
          forwardInfo: {
            channelPostId: undefined,
            date: message.date,
            fromChatId: message.chatId,
            fromId: message.senderId ?? message.chatId,
            fromMessageId: message.id,
            hiddenUserName: undefined,
            isChannelPost: false,
            isImported: false,
            isLinkedChannelPost: false,
            isSavedOutgoing: false,
            postAuthorTitle: undefined,
            savedDate: undefined,
            savedFromPeerId: undefined,
          },
          senderId: currentUserId || message.senderId, // set self
          date: Math.floor(Date.now() / 1000),
          reactors: undefined,
          reactions: undefined,
          isOutgoing: true,
          postAuthorTitle: undefined,
          editDate: undefined,
          // Prevent caption render by just stripping the text - solves some problems
          // that othervise require changing more legacy code, like content class building
          // for Message (PreviewMessage) - 'has-solid-background' is tough to prevent
          // without changing buildContentClass function
          content: preventCaptionRender ? {
            ...message.content,
            text: undefined,
          } : message.content,
        }
        : message;

      listedMessages.push(previewMessage);
    });

    // Service notifications have local IDs which may be not in sync with real message history
    const orderRule: (keyof ApiMessage)[] = ['id'];

    return listedMessages.length
      ? groupMessages(
        orderBy(listedMessages, orderRule),
        memoUnreadDividerBeforeIdRef.current,
        Number(threadId),
        isChatWithSelf,
      )
      : undefined;
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [
    messageIds, messagesById, threadId,
    isChatWithSelf, forwardsNoCaptions, type, currentUserId,
  ]);

  const handleScroll = useLastCallback(() => {
    if (isScrollTopJustUpdatedRef.current) {
      isScrollTopJustUpdatedRef.current = false;
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    runDebouncedForScroll(() => {
      if (!container.parentElement) {
        return;
      }

      scrollOffsetRef.current = container.scrollHeight - container.scrollTop;

      setScrollOffset({ chatId, threadId, scrollOffset: scrollOffsetRef.current });
    });
  });

  const canPost = false;
  const [getContainerHeight] = useContainerHeight(containerRef, canPost && !isSelectModeActive);

  const rememberScrollPositionRef = useStateRef(() => {
    if (!messageIds || !listItemElementsRef.current) {
      return;
    }

    const preservedItemElements = listItemElementsRef.current
      .filter((element) => messageIds.includes(Number(element.dataset.messageId)));

    // We avoid the very first item as it may be a partly-loaded album
    // and also because it may be removed when messages limit is reached
    const anchor = preservedItemElements[1] || preservedItemElements[0];
    if (!anchor) {
      return;
    }

    anchorIdRef.current = anchor.id;
    anchorTopRef.current = anchor.getBoundingClientRect().top;
  });

  useSyncEffect(
    () => forceMeasure(() => rememberScrollPositionRef.current()),
    // This will run before modifying content and should match deps for `useLayoutEffectWithPrevDeps` below
    [messageIds, rememberScrollPositionRef],
  );
  useEffect(
    () => rememberScrollPositionRef.current(),
    // This is only needed to react on signal updates
    [getContainerHeight, rememberScrollPositionRef],
  );

  const isPrivate = isUserId(chatId);
  const withUsers = Boolean((!isPrivate && !isChannelChat)
    || isChatWithSelf || isSystemBotChat || isAnonymousForwards || isChannelWithAvatars);
  const noAvatars = Boolean(!withUsers || (isChannelChat && !isChannelWithAvatars));

  const className = buildClassName(
    styles.root,
    'PreviewMessageList MessageList',
    withBottomShift && 'with-bottom-shift',
    withDefaultBg && 'with-default-bg',
    isSelectModeActive && 'select-mode-active',
    !isReady && 'is-animating',
  );

  const hasMessages = messageIds;

  return (
    <div
      ref={containerRef}
      className={className}
      onScroll={handleScroll}
      onMouseDown={preventMessageInputBlur}
    >
      {hasMessages ? (
        <PreviewMessageListContent
          className={styles.previewMessageListContent}
          chatId={chatId}
          isComments={isComments}
          isChannelChat={false}
          messageGroups={messageGroups || []}
          withUsers={withUsers}
          noAvatars={noAvatars}
          containerRef={containerRef}
          anchorIdRef={anchorIdRef}
          threadId={threadId}
          type={type}
          isReady={isReady}
          hasLinkedChat={false}
          noAppearanceAnimation
          // eslint-disable-next-line react/jsx-no-bind
          onIntersectPinnedMessage={() => {}}
        />
      ) : (
        <Loading color="white" backgroundColor="dark" />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const currentUserId = global.currentUserId;

    const chat = selectChat(global, chatId);
    if (!chat) {
      return { currentUserId };
    }
    return {
      isChannelChat: isChatChannel(chat),
      isChannelWithAvatars: chat.areProfilesShown,
      isChatWithSelf: selectIsChatWithSelf(global, chatId),
      isSystemBotChat: isSystemBot(chatId),
      isAnonymousForwards: isAnonymousForwardsChat(chatId),
      isSelectModeActive: selectIsInSelectMode(global),
      currentUserId,
    };
  },
)(PreviewMessageList));
