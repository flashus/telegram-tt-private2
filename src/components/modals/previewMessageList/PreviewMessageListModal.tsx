import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiMessage,
  ApiMessageReplyInfo,
  ApiPeer,
} from '../../../api/types';
import type { TabState } from '../../../global/types';
import type {
  PreviewMessageListType,
  ThemeKey,
} from '../../../types/index';

import { isChatChannel } from '../../../global/helpers';
import {
  selectCanAnimateInterface,
  selectChat,
  selectChatMessage,
  selectDraft,
  selectForwardedSender,
  selectIsChatWithSelf,
  selectPeer,
  selectSender,
  selectTabState,
  selectTheme,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { debounce } from '../../../util/schedulers';
import { getSelectionAsFormattedText } from '../../middle/message/helpers/getSelectionAsFormattedText';

import useCustomBackground from '../../../hooks/useCustomBackground';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import TabList from '../../ui/TabList';
import PreviewMessageList from './PreviewMessageList';

import styles from './PreviewMessageListModal.module.scss';

type StateProps = {
  theme: ThemeKey;
  customBackground?: string;
  backgroundColor?: string;
  patternColor?: string;
  isBackgroundBlurred?: boolean;
  sender?: ApiPeer;
  isSenderChannel?: boolean;
  currentUserId?: string;
  type?: PreviewMessageListType | 'multiple';
  shouldAnimate?: boolean;
  replyMessageId?: number;
  replyMessage?: ApiMessage;
  replyInfo?: ApiMessageReplyInfo;
  forwardedMessageIds?: number[];
  forwardedMessagesById?: Record<number, ApiMessage>;
  forwardsNoAuthors?: boolean;
  forwardsNoCaptions?: boolean;
  forwardsHaveCaptions?: boolean;
};

export type OwnProps = {
  modal: TabState['previewMessageListModal'];
};

const PreviewMessageListModal: FC<OwnProps & StateProps> = ({
  modal,
  theme,
  customBackground,
  backgroundColor,
  // patternColor,
  isBackgroundBlurred,
  sender,
  isSenderChannel,
  currentUserId,
  type,
  replyMessageId,
  replyMessage,
  replyInfo,
  forwardedMessageIds,
  forwardedMessagesById,
  forwardsNoAuthors,
  forwardsNoCaptions,
  forwardsHaveCaptions,
  shouldAnimate,
}) => {
  const {
    resetDraftReplyInfo,
    updateDraftReplyInfo,
    focusMessage,
    changeRecipient,
    setForwardNoAuthors,
    setForwardNoCaptions,
    exitForwardMode,
    openChatOrTopicWithReplyInDraft,
    closePreviewMessageListModal,
  } = getActions();

  const selection = window.getSelection();

  const [activeTab, setActiveTab] = useState<number>(0);
  const [replyHasQuote, setReplyHasQuote] = useState<boolean>(replyInfo?.isQuote ?? false);

  const lang = useLang();
  const oldLang = useOldLang();

  const originalState = useMemo(() => ({
    forwardsNoAuthors: forwardsNoAuthors ?? false,
    forwardsNoCaptions: forwardsNoCaptions ?? false,
  }), [forwardsNoAuthors, forwardsNoCaptions]);

  const previewData: {
    title: string;
    tips: string;
    type: PreviewMessageListType;
    messageIds: number[] | undefined;
    messagesById: Record<number, ApiMessage> | undefined;
  } = useMemo(() => {
    switch (type) {
      case 'reply':
        return replyHasQuote ? {
          title: oldLang('PreviewQuoteUpdate'),
          tips: replyMessage?.content?.text ? oldLang('Chat.SubtitleQuoteSelectionTip') : '',
          type,
          messageIds: replyMessageId ? [replyMessageId] : [],
          messagesById: replyMessageId && replyMessage ? { [replyMessageId]: replyMessage } : {},
        } : {
          title: oldLang('MessageOptionsReplyTitle'),
          tips: replyMessage?.content?.text ? oldLang('Chat.SubtitleQuoteSelectionTip') : '',
          type,
          messageIds: replyMessageId ? [replyMessageId] : [],
          messagesById: replyMessageId && replyMessage ? { [replyMessageId]: replyMessage } : {},
        };
      case 'forward':
        return {
          // title = lang('lng_forward_many_title', messageIds?.length || 0);
          // TODO: use new lang api or something. Old one does not parse nor replace {count}
          // src/util/oldLangProvider.ts:24 SUBSTITUTION_REGEX = /%\d?\$?[sdf@]/g
          // ATM, cannot find a satisfying template in the new lang translation api
          title: oldLang('lng_forward_many_title', forwardedMessageIds?.length || 0)
            .replace('{count}', String(forwardedMessageIds?.length || 0)),
          tips: oldLang(forwardedMessageIds?.length === 1 ? 'lng_forward_about' : 'lng_forward_many_about'),
          type,
          messageIds: forwardedMessageIds,
          messagesById: forwardedMessagesById ?? {},
        };
      case 'multiple':
      default: {
        return activeTab === 0 ? {
          title: '',
          tips: oldLang('Chat.SubtitleQuoteSelectionTip'),
          type: 'reply',
          messageIds: replyMessageId ? [replyMessageId] : [],
          messagesById: replyMessageId && replyMessage ? { [replyMessageId]: replyMessage } : {},
        } : {
          title: '',
          tips: oldLang(forwardedMessageIds?.length === 1 ? 'lng_forward_about' : 'lng_forward_many_about'),
          type: 'forward',
          messageIds: forwardedMessageIds,
          messagesById: forwardedMessagesById ?? {},
        };
      }
    }
  }, [
    type, replyHasQuote, oldLang, replyMessage, replyMessageId,
    forwardedMessageIds, forwardedMessagesById, activeTab,
  ]);

  const buildAutoCloseModalItemHandler = (action: NoneToVoidFunction) => {
    return () => {
      closePreviewMessageListModal();
      action();
    };
  };

  const handleShowMessageClick = useLastCallback(buildAutoCloseModalItemHandler(() => {
    if (!replyMessage) return;
    focusMessage({ chatId: replyMessage.chatId, messageId: replyMessage.id, noForumTopicPanel: true });
  }));

  const handleReplyInSenderChat = useLastCallback(buildAutoCloseModalItemHandler(() => {
    if (!sender) return;
    openChatOrTopicWithReplyInDraft({ chatId: sender.id });
  }));

  const handleReplyToAnotherChatClick = useLastCallback(buildAutoCloseModalItemHandler(changeRecipient));
  const handleForwardToAnotherChatClick = useLastCallback(buildAutoCloseModalItemHandler(changeRecipient));

  const canReplyInSenderChat = sender && !isSenderChannel && modal?.chatId !== sender.id && sender.id !== currentUserId;

  const controlItems = useMemo(() => {
    if ((type === 'multiple' && activeTab === 0) || type === 'reply') {
      return (
        <>
          <ListItem
            icon="show-message"
            narrow
            onClick={handleShowMessageClick}
          >
            {oldLang('Message.Context.Goto')}
          </ListItem>
          {canReplyInSenderChat && (
            <ListItem
              icon="user"
              narrow
              onClick={handleReplyInSenderChat}
            >
              {lang('ReplyInPrivateMessage')}
            </ListItem>
          )}
          <ListItem
            icon="replace"
            narrow
            onClick={handleReplyToAnotherChatClick}
          >
            {oldLang('ReplyToAnotherChat')}
          </ListItem>
          <ListItem
            icon="delete"
            narrow
            destructive
            onClick={buildAutoCloseModalItemHandler(() => resetDraftReplyInfo())}
          >
            {oldLang('DoNotReply')}
          </ListItem>
        </>
      );
    } else { // if ((type === 'multiple' && activeTab === 1) || type === 'forward')
      return (
        <>
          {forwardsNoAuthors ? (
            <ListItem
              icon="user"
              narrow
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => setForwardNoAuthors({
                noAuthors: false,
              })}
            >
              {oldLang((forwardedMessageIds?.length ?? 0) > 1 ? 'ShowSenderNames' : 'ShowSendersName')}
            </ListItem>
          ) : (
            <ListItem
              icon="delete-user"
              narrow
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => setForwardNoAuthors({
                noAuthors: true,
              })}
            >
              {oldLang((forwardedMessageIds?.length ?? 0) > 1 ? 'HideSenderNames' : 'HideSendersName')}
            </ListItem>
          )}
          {forwardsHaveCaptions && (forwardsNoCaptions ? (
            <ListItem
              icon="add" // TODO: Pick a better icon
              narrow
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => setForwardNoCaptions({
                noCaptions: false,
              })}
            >
              {oldLang(
                (forwardedMessageIds?.length ?? 0) > 1 ? 'Conversation.ForwardOptions.ShowCaption' : 'ShowCaption',
              )}
            </ListItem>
          ) : (
            <ListItem
              icon="remove" // TODO: Pick a better icon
              narrow
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => setForwardNoCaptions({
                noCaptions: true,
              })}
            >
              {oldLang(
                (forwardedMessageIds?.length ?? 0) > 1 ? 'Conversation.ForwardOptions.HideCaption' : 'HideCaption',
              )}
            </ListItem>
          ))}
          <ListItem
            icon="replace"
            narrow
            onClick={handleForwardToAnotherChatClick}
          >
            {oldLang('ForwardAnotherChat')}
          </ListItem>
          <ListItem
            icon="delete"
            narrow
            destructive
            onClick={buildAutoCloseModalItemHandler(() => exitForwardMode())}
          >
            {oldLang('DoNotForward')}
          </ListItem>
        </>
      );
    }
  }, [
    type, activeTab, oldLang, canReplyInSenderChat, lang, forwardsNoAuthors,
    forwardedMessageIds?.length, forwardsHaveCaptions, forwardsNoCaptions,
  ]);

  const handleSwitchTab = useLastCallback((index: number) => {
    setActiveTab(index);
  });

  function renderHeader() {
    if (!previewData.title && type === 'multiple') {
      // Two tabs that allow switching between the list types - reply/quote vs forward
      return (
        <div className="modal-header">
          <TabList
            tabs={[{ title: lang('Reply') }, { title: lang('Forward') }]}
            activeTab={activeTab}
            onSwitchTab={handleSwitchTab}
          />
        </div>
      );
    }

    return (
      <div className="modal-header">
        <div className="modal-title">{previewData.title}</div>
      </div>
    );
  }

  const handleSubmit = buildAutoCloseModalItemHandler(() => {
    if (type === 'reply') {
      const message = replyMessage;
      const selectionRange = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
      if (!selectionRange) {
        updateDraftReplyInfo({ quoteText: undefined });
        return;
      }
      const selectionText = getSelectionAsFormattedText(selectionRange);
      const canQuoteSelection = selectionText.text.trim().length > 0
        && message?.content.text?.text?.includes(selectionText.text);
      const quoteText = canQuoteSelection ? selectionText : undefined;
      updateDraftReplyInfo({ quoteText });
    }
  });

  const handleCancel = buildAutoCloseModalItemHandler(() => {
    if (forwardsNoAuthors !== originalState.forwardsNoAuthors) {
      setForwardNoAuthors({
        noAuthors: originalState.forwardsNoAuthors,
      });
    }
    if (forwardsNoCaptions !== originalState.forwardsNoCaptions) {
      setForwardNoCaptions({
        noCaptions: originalState.forwardsNoCaptions,
      });
    }
  });

  function renderFooter() {
    return (
      <div className={styles.footer}>
        <div className={styles.controls}>
          {controlItems}
        </div>
        {previewData.tips && <div className={styles.tips}>{previewData.tips}</div>}
        <div className="dialog-buttons">
          <Button color="primary" className="confirm-dialog-button" isText onClick={handleSubmit}>
            {((type === 'multiple' && activeTab === 0) || type === 'reply')
             && replyHasQuote ? oldLang('lng_reply_quote_selected') : oldLang('Save')}
          </Button>
          <Button className="confirm-dialog-button" isText onClick={handleCancel}>{lang('Cancel')}</Button>
        </div>
      </div>
    );
  }

  const customBackgroundValue = useCustomBackground(theme, customBackground);

  const bgClassName = buildClassName(
    styles.contentBackground,
    styles.withTransition,
    customBackground && styles.customBgImage,
    backgroundColor && styles.customBgColor,
    customBackground && isBackgroundBlurred && styles.blurred,
  );

  useEffect(() => {
    if (type === 'forward') {
      return;
    }

    function onSelectionChange() {
      if (modal === undefined) {
        return;
      }
      const selectionRange = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
      if (!selectionRange) {
        updateDraftReplyInfo({ quoteText: undefined });
        return;
      }
      const selectionText = getSelectionAsFormattedText(selectionRange);
      const canQuoteSelection = selectionText.text.trim().length > 0
        && replyMessage?.content.text?.text?.includes(selectionText.text);
      setReplyHasQuote(canQuoteSelection ?? false);
    }

    const debouncedOnSelectionChange = debounce(onSelectionChange, 30, false);

    window.document.addEventListener('selectionchange', debouncedOnSelectionChange);

    // eslint-disable-next-line consistent-return
    return () => {
      window.document.removeEventListener('selectionchange', debouncedOnSelectionChange);
    };
  }, [replyMessage?.content.text?.text, selection, type, modal]);

  return (
    <Modal
      isOpen={Boolean(modal)}
      className={styles.root}
      contentClassName={styles.content}
      onClose={closePreviewMessageListModal}
      onEnter={handleSubmit}
      header={renderHeader()}
      footer={renderFooter()}
    >
      {Boolean(modal) && Boolean(previewData.type) && (
        <>
          <div
            className={bgClassName}
            style={customBackgroundValue ? `--custom-background: ${customBackgroundValue}` : undefined}
          />
          <PreviewMessageList
            chatId={modal.chatId}
            threadId={modal.threadId}
            type={previewData.type}
            isComments={false}
            isReady
            withBottomShift={false}
            withDefaultBg
            shouldAnimate={shouldAnimate}
            messageIds={previewData.messageIds}
            messagesById={previewData.messagesById}
            forwardsNoCaptions={forwardsNoCaptions}
          />
        </>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const theme = selectTheme(global);
    if (!modal) {
      return { theme };
    }

    const {
      isBlurred: isBackgroundBlurred, background: customBackground, backgroundColor, patternColor,
    } = global.settings.themes[theme] || {};

    const {
      forwardMessages: {
        fromChatId, toChatId, messageIds: forwardMessageIds, noAuthors, noCaptions,
      },
      shouldSkipHistoryAnimations,
    } = selectTabState(global);

    const shouldAnimate = selectCanAnimateInterface(global) && !shouldSkipHistoryAnimations;
    const isForwarding = toChatId === modal.chatId;

    const draft = selectDraft(global, modal.chatId, modal.threadId);
    const replyInfo = draft?.replyInfo;
    const isReply = Boolean(replyInfo?.replyToMsgId);
    const isQuote = Boolean(replyInfo?.quoteText);

    let replyMessageId: number | undefined;
    let replyMessage: ApiMessage | undefined;
    let forwardedMessageIds: number[] | undefined;
    let forwardedMessagesById: Record<number, ApiMessage> | undefined;
    let type: PreviewMessageListType | 'multiple';

    if (isForwarding) {
      forwardedMessageIds = forwardMessageIds;
      forwardedMessagesById = forwardedMessageIds?.reduce((acc: Record<number, ApiMessage>, id) => {
        acc[id] = selectChatMessage(global, fromChatId!, id)!;
        return acc;
      }, {});
    }

    if (isReply || isQuote) {
      replyMessageId = replyInfo?.replyToMsgId;
      replyMessage = replyMessageId
        ? selectChatMessage(global, modal.chatId, replyMessageId)
        : undefined;
    }

    if (isForwarding && isReply) {
      type = 'multiple';
    } else if (isForwarding) {
      type = 'forward';
    } else {
      type = 'reply';
    }

    const forwardsHaveCaptions = Object.values(forwardedMessagesById ?? {}).some((forward) => (
      forward?.content.text && Object.keys(forward.content).length > 1
    ));

    let sender: ApiPeer | undefined;
    if (replyMessageId && replyMessage) {
      sender = selectSender(global, replyMessage);
    } else if (isForwarding) {
      if (replyMessage) {
        sender = selectForwardedSender(global, replyMessage);
        if (!sender) {
          sender = selectSender(global, replyMessage);
        }
      }
      if (!sender) {
        sender = selectPeer(global, fromChatId!);
      }
    } else if (replyInfo && replyMessage) {
      const { forwardInfo } = replyMessage;
      const isChatWithSelf = selectIsChatWithSelf(global, modal.chatId);
      if (forwardInfo && (forwardInfo.isChannelPost || isChatWithSelf)) {
        sender = selectForwardedSender(global, replyMessage);
      }

      if (!sender && (!forwardInfo?.hiddenUserName || Boolean(replyInfo.quoteText))) {
        sender = selectSender(global, replyMessage);
      }
    }

    const chat = sender && selectChat(global, sender.id);
    const isSenderChannel = chat && isChatChannel(chat);

    return {
      theme,
      customBackground,
      backgroundColor,
      patternColor,
      isBackgroundBlurred,
      sender,
      isSenderChannel,
      currentUserId: global.currentUserId,
      type,
      shouldAnimate,
      replyMessageId,
      replyMessage,
      replyInfo,
      forwardedMessageIds,
      forwardedMessagesById,
      forwardsNoAuthors: noAuthors,
      forwardsNoCaptions: noCaptions,
      forwardsHaveCaptions,
    };
  },
)(PreviewMessageListModal));
