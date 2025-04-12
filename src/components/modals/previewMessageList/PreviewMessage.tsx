import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useUnmountCleanup,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type {
  ApiAvailableEffect,
  ApiAvailableReaction,
  ApiChat,
  ApiChatMember,
  ApiInputMessageReplyInfo,
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiPeer,
  ApiPoll,
  ApiReaction,
  ApiReactionKey,
  ApiSavedReactionTag,
  ApiThreadInfo,
  ApiTopic,
  ApiTypeStory,
  ApiUser,
} from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type {
  ActiveEmojiInteraction,
  ChatTranslatedMessages,
  FocusDirection,
  IAlbum,
  ISettings,
  MessageListType,
  PreviewMessageListType,
  ScrollTargetPosition,
  ThreadId,
} from '../../../types';
import type { Signal } from '../../../util/signals';
import type { OnIntersectPinnedMessage } from '../../middle/hooks/usePinnedMessage';
import { MAIN_THREAD_ID } from '../../../api/types';
import { AudioOrigin } from '../../../types';

import { EMOJI_STATUS_LOOP_LIMIT } from '../../../config';
import {
  areReactionsEmpty,
  getIsDownloading,
  getMessageContent,
  getMessageCustomShape,
  getMessageDownloadableMedia,
  getMessageHtmlId,
  getMessageSingleCustomEmoji,
  getMessageSingleRegularEmoji,
  hasMessageText,
  hasMessageTtl,
  isAnonymousForwardsChat,
  isAnonymousOwnMessage,
  isChatChannel,
  isChatGroup,
  isChatPublic,
  isGeoLiveExpired,
  isMessageLocal,
  isMessageTranslatable,
  isOwnMessage,
  isReplyToMessage,
  isSystemBot,
  isUserId,
} from '../../../global/helpers';
import { getPeerTitle } from '../../../global/helpers/peers';
import { getMessageReplyInfo, getStoryReplyInfo } from '../../../global/helpers/replies';
import {
  selectActiveDownloads,
  selectAnimatedEmoji,
  selectCanAutoLoadMedia,
  selectCanAutoPlayMedia,
  selectCanReplyToMessage,
  selectChat,
  selectChatFullInfo,
  selectChatMessage,
  selectChatTranslations,
  selectCurrentMiddleSearch,
  selectDefaultReaction,
  selectDraft,
  selectForwardedSender,
  selectIsChatProtected,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectIsDocumentGroupSelected,
  selectIsInSelectMode,
  selectIsMessageFocused,
  selectIsMessageProtected,
  selectIsMessageSelected,
  selectMessageIdsByGroupId,
  selectOutgoingStatus,
  selectPeer,
  selectPeerStory,
  selectPerformanceSettingsValue,
  selectPollFromMessage,
  selectRequestedChatTranslationLanguage,
  selectRequestedMessageTranslationLanguage,
  selectSender,
  selectSenderFromHeader,
  selectShouldDetectChatLanguage,
  selectShouldLoopStickers,
  selectTabState,
  selectTheme,
  selectThreadInfo,
  selectTopicFromMessage,
  selectUploadProgress,
  selectUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { getMessageKey } from '../../../util/keys/messageKey';
import stopEvent from '../../../util/stopEvent';
import { IS_TRANSLATION_SUPPORTED } from '../../../util/windowEnvironment';
import { calculateDimensionsForMessageMedia, getStickerDimensions, REM } from '../../common/helpers/mediaDimensions';
import { getPeerColorClass } from '../../common/helpers/peerColor';
import renderText from '../../common/helpers/renderText';
import { getCustomEmojiSize } from '../../middle/composer/helpers/customEmoji';
import { buildContentClassName } from '../../middle/message/helpers/buildContentClassName';
import { calculateAlbumLayout } from '../../middle/message/helpers/calculateAlbumLayout';
import getSingularPaidMedia from '../../middle/message/helpers/getSingularPaidMedia';
import {
  calculateMediaDimensions,
  getMinMediaWidth,
  MIN_MEDIA_WIDTH_WITH_TEXT,
} from '../../middle/message/helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useEnsureMessage from '../../../hooks/useEnsureMessage';
import useEnsureStory from '../../../hooks/useEnsureStory';
import useFlag from '../../../hooks/useFlag';
import { useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useOldLang from '../../../hooks/useOldLang';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useMessageResizeObserver from '../../../hooks/useResizeMessageObserver';
import useShowTransition from '../../../hooks/useShowTransition';
import useTextLanguage from '../../../hooks/useTextLanguage';
import useDetectChatLanguage from '../../middle/message/hooks/useDetectChatLanguage';
import useFocusMessage from '../../middle/message/hooks/useFocusMessage';
import useMessageTranslation from '../../middle/message/hooks/useMessageTranslation';

import Audio from '../../common/Audio';
import Avatar from '../../common/Avatar';
import CustomEmoji from '../../common/CustomEmoji';
import Document from '../../common/Document';
import DotAnimation from '../../common/DotAnimation';
import EmbeddedMessage from '../../common/embedded/EmbeddedMessage';
import EmbeddedStory from '../../common/embedded/EmbeddedStory';
import FakeIcon from '../../common/FakeIcon';
import Icon from '../../common/icons/Icon';
import StarIcon from '../../common/icons/StarIcon';
import MessageText from '../../common/MessageText';
import TopicChip from '../../common/TopicChip';
import Album from '../../middle/message/Album';
import AnimatedCustomEmoji from '../../middle/message/AnimatedCustomEmoji';
import AnimatedEmoji from '../../middle/message/AnimatedEmoji';
import Contact from '../../middle/message/Contact';
import FactCheck from '../../middle/message/FactCheck';
import Game from '../../middle/message/Game';
import Giveaway from '../../middle/message/Giveaway';
import InlineButtons from '../../middle/message/InlineButtons';
import Invoice from '../../middle/message/Invoice';
import InvoiceMediaPreview from '../../middle/message/InvoiceMediaPreview';
import Location from '../../middle/message/Location';
import MessageAppendix from '../../middle/message/MessageAppendix';
import MessageEffect from '../../middle/message/MessageEffect';
import MessageMeta from '../../middle/message/MessageMeta';
import MessagePhoneCall from '../../middle/message/MessagePhoneCall';
import PaidMediaOverlay from '../../middle/message/PaidMediaOverlay';
import Photo from '../../middle/message/Photo';
import Poll from '../../middle/message/Poll';
import Reactions from '../../middle/message/reactions/Reactions';
import RoundVideo from '../../middle/message/RoundVideo';
import Sticker from '../../middle/message/Sticker';
import Story from '../../middle/message/Story';
import StoryMention from '../../middle/message/StoryMention';
import Video from '../../middle/message/Video';
import WebPage from '../../middle/message/WebPage';

import '../../middle/message/Message.scss';

type MessagePositionProperties = {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isFirstInDocumentGroup: boolean;
  isLastInDocumentGroup: boolean;
  isLastInList: boolean;
};

type OwnProps =
  {
    message: ApiMessage;
    observeIntersectionForBottom: ObserveFn;
    observeIntersectionForLoading: ObserveFn;
    observeIntersectionForPlaying: ObserveFn;
    album?: IAlbum;
    noAvatars?: boolean;
    withAvatar?: boolean;
    withSenderName?: boolean;
    threadId: ThreadId;
    messageListType: MessageListType;
    previewMessageListType: PreviewMessageListType;
    noComments: boolean;
    noReplies: boolean;
    appearanceOrder: number;
    isJustAdded: boolean;
    memoFirstUnreadIdRef: { current: number | undefined };
    getIsMessageListReady: Signal<boolean>;
    onIntersectPinnedMessage: OnIntersectPinnedMessage;
  }
  & MessagePositionProperties;

type StateProps = {
  theme: ISettings['theme'];
  forceSenderName?: boolean;
  sender?: ApiPeer;
  canShowSender: boolean;
  originSender?: ApiPeer;
  botSender?: ApiUser;
  isThreadTop?: boolean;
  shouldHideReply?: boolean;
  replyMessage?: ApiMessage;
  replyMessageSender?: ApiPeer;
  replyMessageForwardSender?: ApiPeer;
  replyMessageChat?: ApiChat;
  isReplyPrivate?: boolean;
  replyStory?: ApiTypeStory;
  storySender?: ApiPeer;
  outgoingStatus?: ApiMessageOutgoingStatus;
  uploadProgress?: number;
  isInDocumentGroup: boolean;
  isProtected?: boolean;
  isChatProtected?: boolean;
  isFocused?: boolean;
  focusDirection?: FocusDirection;
  focusedQuote?: string;
  noFocusHighlight?: boolean;
  scrollTargetPosition?: ScrollTargetPosition;
  isResizingContainer?: boolean;
  isForwarding?: boolean;
  isChatWithSelf?: boolean;
  isRepliesChat?: boolean;
  isAnonymousForwards?: boolean;
  isChannel?: boolean;
  isGroup?: boolean;
  canReply?: boolean;
  highlight?: string;
  animatedEmoji?: string;
  animatedCustomEmoji?: string;
  hasActiveReactions?: boolean;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  isGroupSelected?: boolean;
  isDownloading?: boolean;
  threadId?: ThreadId;
  isPinnedList?: boolean;
  isPinned?: boolean;
  canAutoLoadMedia?: boolean;
  canAutoPlayMedia?: boolean;
  hasLinkedChat?: boolean;
  shouldLoopStickers?: boolean;
  autoLoadFileMaxSizeMb: number;
  repliesThreadInfo?: ApiThreadInfo;
  reactionMessage?: ApiMessage;
  availableReactions?: ApiAvailableReaction[];
  defaultReaction?: ApiReaction;
  activeEmojiInteractions?: ActiveEmojiInteraction[];
  hasUnreadReaction?: boolean;
  isTranscribing?: boolean;
  transcribedText?: string;
  isTranscriptionError?: boolean;
  isPremium: boolean;
  senderAdminMember?: ApiChatMember;
  messageTopic?: ApiTopic;
  hasTopicChip?: boolean;
  chatTranslations?: ChatTranslatedMessages;
  areTranslationsEnabled?: boolean;
  shouldDetectChatLanguage?: boolean;
  requestedTranslationLanguage?: string;
  requestedChatTranslationLanguage?: string;
  withAnimatedEffects?: boolean;
  webPageStory?: ApiTypeStory;
  isConnected: boolean;
  isLoadingComments?: boolean;
  shouldWarnAboutSvg?: boolean;
  senderBoosts?: number;
  tags?: Record<ApiReactionKey, ApiSavedReactionTag>;
  canTranscribeVoice?: boolean;
  viaBusinessBot?: ApiUser;
  effect?: ApiAvailableEffect;
  poll?: ApiPoll;
  forwardsNoAuthors?: boolean;
  forwardsNoCaptions?: boolean;
  draftReplyInfo?: ApiInputMessageReplyInfo | undefined;
};

type MetaPosition =
  'in-text'
  | 'standalone'
  | 'none';
type ReactionsPosition =
  'inside'
  | 'outside'
  | 'none';

const NBSP = '\u00A0';
const APPEARANCE_DELAY = 10;
const NO_MEDIA_CORNERS_THRESHOLD = 18;
const EXTRA_SPACE_FOR_REACTIONS = 2.25 * REM;

const PreviewMessage: FC<OwnProps & StateProps> = ({
  message,
  observeIntersectionForBottom,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  album,
  noAvatars,
  withAvatar,
  withSenderName,
  noComments,
  noReplies,
  appearanceOrder,
  isJustAdded,
  isFirstInGroup,
  isPremium,
  isLastInGroup,
  isFirstInDocumentGroup,
  isLastInDocumentGroup,
  isTranscribing,
  transcribedText,
  isLastInList,
  theme,
  forceSenderName,
  sender,
  canShowSender,
  originSender,
  botSender,
  isThreadTop,
  shouldHideReply,
  replyMessage,
  replyMessageSender,
  replyMessageForwardSender,
  replyMessageChat,
  replyStory,
  isReplyPrivate,
  storySender,
  outgoingStatus,
  uploadProgress,
  isInDocumentGroup,
  isProtected,
  isFocused,
  focusDirection,
  focusedQuote,
  noFocusHighlight,
  scrollTargetPosition,
  isResizingContainer,
  isForwarding,
  isChatWithSelf,
  isRepliesChat,
  isAnonymousForwards,
  isChannel,
  isGroup,
  highlight,
  animatedEmoji,
  animatedCustomEmoji,
  isInSelectMode,
  isSelected,
  isGroupSelected,
  threadId,
  reactionMessage,
  availableReactions,
  activeEmojiInteractions,
  messageListType,
  isPinned,
  isDownloading,
  canAutoLoadMedia,
  canAutoPlayMedia,
  shouldLoopStickers,
  autoLoadFileMaxSizeMb,
  repliesThreadInfo,
  hasUnreadReaction,
  memoFirstUnreadIdRef,
  senderAdminMember,
  messageTopic,
  hasTopicChip,
  chatTranslations,
  areTranslationsEnabled,
  shouldDetectChatLanguage,
  requestedTranslationLanguage,
  requestedChatTranslationLanguage,
  withAnimatedEffects,
  webPageStory,
  isConnected,
  getIsMessageListReady,
  shouldWarnAboutSvg,
  senderBoosts,
  tags,
  canTranscribeVoice,
  viaBusinessBot,
  effect,
  poll,
  forwardsNoAuthors,
  forwardsNoCaptions,
  draftReplyInfo,
  onIntersectPinnedMessage,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const bottomMarkerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const textContentRef = useRef<HTMLDivElement>(null);

  const selection = window.getSelection();

  const lang = useOldLang();

  const [isTranscriptionHidden, setTranscriptionHidden] = useState(false);
  const [shouldPlayEffect, requestEffect, hideEffect] = useFlag();
  const { isMobile } = useAppLayout();

  useOnIntersect(bottomMarkerRef, observeIntersectionForBottom);

  const noAppearanceAnimation = appearanceOrder <= 0;
  const [isShown, markShown] = useFlag(noAppearanceAnimation);
  useEffect(() => {
    if (noAppearanceAnimation) {
      return;
    }

    setTimeout(markShown, appearanceOrder * APPEARANCE_DELAY);
  }, [appearanceOrder, markShown, noAppearanceAnimation]);

  useShowTransition({
    ref,
    isOpen: isShown || isJustAdded,
    noMountTransition: noAppearanceAnimation && !isJustAdded,
    className: false,
  });

  const {
    id: messageId, chatId, forwardInfo, viaBotId, isTranscriptionError, factCheck,
  } = message;

  useUnmountCleanup(() => {
    if (message.isPinned) {
      const id = album ? album.mainMessage.id : messageId;
      onIntersectPinnedMessage({ viewportPinnedIdsToRemove: [id] });
    }
  });

  const isLocal = isMessageLocal(message);
  const isOwn = isOwnMessage(message);
  const isScheduled = messageListType === 'scheduled' || message.isScheduled;
  const hasMessageReply = isReplyToMessage(message) && !shouldHideReply;

  const { paidMedia } = getMessageContent(message);
  const { photo: paidMediaPhoto, video: paidMediaVideo } = getSingularPaidMedia(paidMedia);

  const {
    photo = paidMediaPhoto, video = paidMediaVideo, audio,
    voice, document, sticker, contact,
    webPage, invoice, location,
    action, game, storyData, giveaway,
    giveawayResults,
  } = getMessageContent(message);

  const messageReplyInfo = getMessageReplyInfo(message);
  const storyReplyInfo = getStoryReplyInfo(message);

  const withVoiceTranscription = Boolean(!isTranscriptionHidden && (isTranscriptionError || transcribedText));

  const hasStoryReply = Boolean(storyReplyInfo);
  const hasThread = Boolean(repliesThreadInfo) && messageListType === 'thread';
  const isCustomShape = !withVoiceTranscription && getMessageCustomShape(message);
  const hasAnimatedEmoji = isCustomShape && (animatedEmoji || animatedCustomEmoji);
  const hasReactions = reactionMessage?.reactions && !areReactionsEmpty(reactionMessage.reactions);
  const asForwarded = (
    forwardInfo
    && (!isChatWithSelf || isScheduled)
    && !isRepliesChat
    && !forwardInfo.isLinkedChannelPost
    && !isAnonymousForwards
    && !botSender
  ) || Boolean(storyData && !storyData.isMention);
  const canShowSenderBoosts = Boolean(senderBoosts) && !asForwarded && isFirstInGroup;
  const isStoryMention = storyData?.isMention;
  const isRoundVideo = video?.mediaType === 'video' && video.isRound;
  const isAlbum = Boolean(album)
    && (
      (album.isPaidMedia && paidMedia!.extendedMedia.length > 1)
      || album.messages.length > 1
    ) && !album.messages.some((msg) => Object.keys(msg.content).length === 0);
  const isInDocumentGroupNotFirst = isInDocumentGroup && !isFirstInDocumentGroup;
  const isInDocumentGroupNotLast = isInDocumentGroup && !isLastInDocumentGroup;
  const isMediaWithCommentButton = false;
  const withCommentButton = false;

  const hasFactCheck = Boolean(factCheck?.text);

  const hasForwardedCustomShape = asForwarded && isCustomShape;
  const hasSubheader = hasTopicChip || hasMessageReply || hasStoryReply || hasForwardedCustomShape;

  const messageSender = canShowSender ? sender : undefined;

  // const shouldPreferOriginSender = forwardInfo
  //   && (isChatWithSelf || isRepliesChat || isAnonymousForwards || !messageSender);

  const messageColorPeer = asForwarded ? originSender : sender;
  const noUserColors = isOwn && !isCustomShape;

  const senderPeer = (forwardInfo || storyData) ? originSender : messageSender;
  const hasTtl = hasMessageTtl(message);

  const textMessage = album?.hasMultipleCaptions ? undefined : (album?.captionMessage || message);

  const hasCaption = message.content.text && Object.keys(message.content).length > 1;
  const preventCaptionRender = hasCaption && forwardsNoCaptions;

  const hasTextContent = textMessage && hasMessageText(textMessage) && !preventCaptionRender;
  const hasText = (hasTextContent || hasFactCheck) && !preventCaptionRender;

  const containerClassName = buildClassName(
    'PreviewMessage Message message-list-item',
    isFirstInGroup && 'first-in-group',
    isProtected && !hasTextContent ? 'is-protected' : 'allow-selection',
    isLastInGroup && 'last-in-group',
    isFirstInDocumentGroup && 'first-in-document-group',
    isLastInDocumentGroup && 'last-in-document-group',
    isLastInList && 'last-in-list',
    isOwn && 'own',
    Boolean(message.viewsCount) && 'has-views',
    message.isEdited && 'was-edited',
    hasMessageReply && 'has-reply',
    isFocused && !noFocusHighlight && 'focused',
    isForwarding && 'is-forwarding',
    isInDocumentGroup && 'is-in-document-group',
    isAlbum && 'is-album',
    message.hasUnreadMention && 'has-unread-mention',
    isSelected && 'is-selected',
    isInSelectMode && 'is-in-selection-mode',
    isThreadTop && !withAvatar && 'is-thread-top',
    Boolean(message.inlineButtons) && 'has-inline-buttons',
    isJustAdded && 'is-just-added',
    isStoryMention && 'is-story-mention',
  );

  const text = preventCaptionRender ? undefined : (textMessage && getMessageContent(textMessage).text);
  const isInvertedMedia = Boolean(message.isInvertedMedia);

  const { replyToMsgId, replyToPeerId, isQuote } = messageReplyInfo || {};
  const { peerId: storyReplyPeerId, storyId: storyReplyId } = storyReplyInfo || {};

  useEffect(() => {
    if ((sticker?.hasEffect || effect) && ((
      memoFirstUnreadIdRef.current && messageId >= memoFirstUnreadIdRef.current
    ) || isLocal)) {
      requestEffect();
    }
  }, [effect, isLocal, memoFirstUnreadIdRef, messageId, sticker?.hasEffect]);

  useEffect(() => {
    if (!textContentRef.current || !hasText || !text || !draftReplyInfo?.quoteText) {
      return;
    }

    // Normalize whitespace characters in both the quote text and content
    const normalizeSpaces = (str: string) => str.replace(/\u00A0|&#160;/g, ' ') // Replace both unicode and HTML entity no-break spaces
      .replace(/[\r\n]+/g, ''); // Replace all line breaks - they are already stripped in textContent

    const quoteText = normalizeSpaces(draftReplyInfo.quoteText.text);
    const fullText = normalizeSpaces(textContentRef.current.textContent || '');

    const startIndex = fullText.indexOf(quoteText);

    if (startIndex === -1) return;
    const endIndex = startIndex + quoteText.length;

    let currentIndex = 0;
    let startNode: Node | undefined;
    let startOffset = 0;
    let endNode: Node | undefined;
    let endOffset = 0;

    const walker = window.document.createTreeWalker(
      textContentRef.current,
      NodeFilter.SHOW_TEXT,
    );

    let node = walker.nextNode();
    while (node) {
      const nodeText = node.textContent || '';
      const nodeLength = nodeText.length;

      // Check if current node contains the start index
      if (startNode === undefined && currentIndex + nodeLength > startIndex) {
        startNode = node;
        startOffset = startIndex - currentIndex;
      }

      // Check if current node contains the end index
      if (startNode !== undefined && currentIndex + nodeLength >= endIndex) {
        endNode = node;
        endOffset = endIndex - currentIndex;
        break;
      }

      currentIndex += nodeLength;
      node = walker.nextNode();
    }

    if (startNode && endNode) {
      const range = window.document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);

      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  });

  const detectedLanguage = useTextLanguage(
    text?.text,
    !(areTranslationsEnabled || shouldDetectChatLanguage),
    getIsMessageListReady,
  );
  useDetectChatLanguage(message, detectedLanguage, !shouldDetectChatLanguage, getIsMessageListReady);

  const shouldTranslate = isMessageTranslatable(message, !requestedChatTranslationLanguage);
  const { isPending: isTranslationPending, translatedText } = useMessageTranslation(
    chatTranslations, chatId, shouldTranslate ? messageId : undefined, requestedTranslationLanguage,
  );
  // Used to display previous result while new one is loading
  const previousTranslatedText = usePreviousDeprecated(translatedText, Boolean(shouldTranslate));

  const currentTranslatedText = translatedText || previousTranslatedText;

  const phoneCall = action?.type === 'phoneCall' ? action : undefined;

  const hasOutsideReactions = !withVoiceTranscription && hasReactions
    && (isCustomShape || ((photo || video || storyData || (location?.mediaType === 'geo')) && !hasText));

  const contentClassName = buildContentClassName(message, album, {
    poll,
    hasSubheader,
    isCustomShape,
    isLastInGroup,
    asForwarded,
    hasThread: hasThread && !noComments,
    forceSenderName,
    hasCommentCounter: hasThread && repliesThreadInfo.messagesCount > 0,
    hasReactions,
    isGeoLiveActive: location?.mediaType === 'geoLive' && !isGeoLiveExpired(message),
    withVoiceTranscription,
    peerColorClass: getPeerColorClass(messageColorPeer, noUserColors, true),
    hasOutsideReactions,
  });

  const withAppendix = contentClassName.includes('has-appendix');
  const emojiSize = getCustomEmojiSize(message.emojiOnlyCount);

  let metaPosition!: MetaPosition;
  if (phoneCall) {
    metaPosition = 'none';
  } else if (isInDocumentGroupNotLast) {
    metaPosition = 'none';
  } else if (hasText && !webPage && !emojiSize && !isInvertedMedia) {
    metaPosition = 'in-text';
  } else if (isInvertedMedia && !emojiSize && (hasFactCheck || webPage)) {
    metaPosition = 'in-text';
  } else {
    metaPosition = 'standalone';
  }

  let reactionsPosition!: ReactionsPosition;
  if (hasReactions) {
    if (hasOutsideReactions) {
      reactionsPosition = 'outside';
    } else if (asForwarded) {
      metaPosition = 'standalone';
      reactionsPosition = 'inside';
    } else {
      reactionsPosition = 'inside';
    }
  } else {
    reactionsPosition = 'none';
  }

  useEnsureMessage(
    replyToPeerId || chatId,
    replyToMsgId,
    replyMessage,
    message.id,
    shouldHideReply || isQuote || isReplyPrivate,
  );

  useEnsureStory(
    storyReplyPeerId || chatId,
    storyReplyId,
    replyStory,
  );

  useFocusMessage({
    elementRef: ref,
    chatId,
    isFocused,
    focusDirection,
    noFocusHighlight,
    isResizingContainer,
    isJustAdded,
    isQuote: Boolean(focusedQuote),
    scrollTargetPosition,
  });

  const viaBusinessBotTitle = viaBusinessBot ? getPeerTitle(lang, viaBusinessBot) : undefined;

  const canShowPostAuthor = !message.senderId;
  const signature = viaBusinessBotTitle || (canShowPostAuthor && message.postAuthorTitle)
    || ((asForwarded || isChatWithSelf) && forwardInfo?.postAuthorTitle)
    || undefined;

  useMessageResizeObserver(ref, isLastInList);

  const albumLayout = useMemo(() => {
    return isAlbum
      ? calculateAlbumLayout(isOwn, Boolean(noAvatars), album!, isMobile)
      : undefined;
  }, [isAlbum, isOwn, noAvatars, album, isMobile]);

  const extraPadding = asForwarded && !isCustomShape ? 28 : 0;

  const sizeCalculations = useMemo(() => {
    let calculatedWidth;
    let contentWidth: number | undefined;
    let noMediaCorners = false;
    let style = '';
    let reactionsMaxWidth;

    if (!isAlbum && (photo || video || invoice?.extendedMedia)) {
      let width: number | undefined;
      if (photo || video) {
        const media = (photo || video);
        if (media && !isRoundVideo) {
          width = calculateMediaDimensions({
            media,
            isOwn,
            asForwarded,
            noAvatars,
            isMobile,
          }).width;
        }
      } else if (invoice?.extendedMedia && (
        invoice.extendedMedia.width && invoice.extendedMedia.height
      )) {
        const { width: previewWidth, height: previewHeight } = invoice.extendedMedia;
        width = calculateDimensionsForMessageMedia({
          width: previewWidth,
          height: previewHeight,
          fromOwnMessage: isOwn,
          asForwarded,
          noAvatars,
          isMobile,
        }).width;
      }

      if (width) {
        if (width < MIN_MEDIA_WIDTH_WITH_TEXT) {
          contentWidth = width;
        }
        calculatedWidth = Math.max(getMinMediaWidth(text?.text, isMediaWithCommentButton), width);
        if (!asForwarded && invoice?.extendedMedia && calculatedWidth - width > NO_MEDIA_CORNERS_THRESHOLD) {
          noMediaCorners = true;
        }
      }
    } else if (albumLayout) {
      calculatedWidth = Math.max(
        getMinMediaWidth(text?.text, isMediaWithCommentButton), albumLayout.containerStyle.width,
      );
      if (calculatedWidth - albumLayout.containerStyle.width > NO_MEDIA_CORNERS_THRESHOLD) {
        noMediaCorners = true;
      }
    }

    if (calculatedWidth) {
      style = `width: ${calculatedWidth}px`;
      reactionsMaxWidth = calculatedWidth + EXTRA_SPACE_FOR_REACTIONS;
    } else if (sticker && !hasSubheader) {
      const { width } = getStickerDimensions(sticker, isMobile);
      style = `width: ${width + extraPadding}px`;
      reactionsMaxWidth = width + EXTRA_SPACE_FOR_REACTIONS;
    }

    return {
      contentWidth, noMediaCorners, style, reactionsMaxWidth,
    };
  }, [
    albumLayout, asForwarded, extraPadding, hasSubheader, invoice?.extendedMedia, isAlbum, isMediaWithCommentButton,
    isMobile, isOwn, noAvatars, photo, sticker, text?.text, video, isRoundVideo,
  ]);

  const {
    contentWidth, noMediaCorners, style, reactionsMaxWidth,
  } = sizeCalculations;

  function renderMessageText(isForAnimation?: boolean) {
    if (!textMessage) return undefined;
    return (
      <MessageText
        messageOrStory={textMessage}
        translatedText={requestedTranslationLanguage ? currentTranslatedText : undefined}
        isForAnimation={isForAnimation}
        focusedQuote={focusedQuote}
        emojiSize={emojiSize}
        highlight={highlight}
        isProtected={isProtected}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        withTranslucentThumbs={isCustomShape}
        isInSelectMode={isInSelectMode}
        canBeEmpty={hasFactCheck}
      />
    );
  }

  function renderReactionsAndMeta() {
    const meta = (
      <MessageMeta
        message={message}
        isPinned={isPinned}
        withFullDate={isChatWithSelf && !isOwn}
        noReplies={noReplies}
        repliesThreadInfo={repliesThreadInfo}
        outgoingStatus={outgoingStatus}
        signature={signature}
        withReactionOffset={reactionsPosition === 'inside'}
        renderQuickReactionButton={undefined}
        availableReactions={availableReactions}
        isTranslated={Boolean(requestedTranslationLanguage ? currentTranslatedText : undefined)}
        effectEmoji={effect?.emoticon}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => {}}
        // eslint-disable-next-line react/jsx-no-bind
        onEffectClick={() => {}}
        // eslint-disable-next-line react/jsx-no-bind
        onTranslationClick={() => {}}
        // eslint-disable-next-line react/jsx-no-bind
        onOpenThread={() => {}}
      />
    );

    if (reactionsPosition !== 'inside') {
      return meta;
    }

    return (
      <Reactions
        message={reactionMessage!}
        threadId={threadId}
        metaChildren={meta}
        observeIntersection={observeIntersectionForPlaying}
        noRecentReactors={isChannel}
        tags={tags}
        isCurrentUserPremium={isPremium}
      />
    );
  }

  function renderContent() {
    const className = buildClassName(
      'content-inner',
      asForwarded && 'forwarded-message',
      hasForwardedCustomShape && 'forwarded-custom-shape',
      hasSubheader && 'with-subheader',
      noMediaCorners && 'no-media-corners',
    );
    const hasCustomAppendix = isLastInGroup
      && (!hasText || (isInvertedMedia && !hasFactCheck && !hasReactions)) && !withCommentButton;
    const textContentClass = buildClassName(
      'text-content',
      'clearfix',
      metaPosition === 'in-text' && 'with-meta',
      outgoingStatus && 'with-outgoing-icon',
    );

    return (
      <div className={className} dir="auto">
        {!asForwarded && shouldRenderSenderName() && renderSenderName()}
        {hasSubheader && (
          <div className="message-subheader">
            {hasTopicChip && (
              <TopicChip
                topic={messageTopic}
                onClick={undefined}
                className="message-topic"
              />
            )}
            {hasForwardedCustomShape && (
              <div className="forward-custom-shape-subheader">
                <div className="message-title">
                  {renderForwardTitle()}
                </div>
                {renderSenderName(true, true)}
              </div>
            )}
            {hasMessageReply && (
              <EmbeddedMessage
                message={replyMessage}
                replyInfo={messageReplyInfo}
                noUserColors={noUserColors}
                isProtected={isProtected}
                sender={replyMessageSender}
                senderChat={replyMessageChat}
                forwardSender={replyMessageForwardSender}
                chatTranslations={chatTranslations}
                requestedChatTranslationLanguage={requestedChatTranslationLanguage}
                observeIntersectionForLoading={observeIntersectionForLoading}
                observeIntersectionForPlaying={observeIntersectionForPlaying}
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => {}}
              />
            )}
            {hasStoryReply && (
              <EmbeddedStory
                story={replyStory}
                sender={storySender}
                noUserColors={noUserColors}
                isProtected={isProtected}
                observeIntersectionForLoading={observeIntersectionForLoading}
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => {}}
              />
            )}
          </div>
        )}
        {sticker && (
          <Sticker
            message={message}
            observeIntersection={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            shouldLoop={shouldLoopStickers}
            shouldPlayEffect={shouldPlayEffect}
            withEffect={withAnimatedEffects}
            onStopEffect={hideEffect}
          />
        )}
        {hasAnimatedEmoji && animatedCustomEmoji && (
          <AnimatedCustomEmoji
            customEmojiId={animatedCustomEmoji}
            withEffects={withAnimatedEffects && isUserId(chatId) && !effect}
            isOwn={isOwn}
            observeIntersection={observeIntersectionForLoading}
            forceLoadPreview={isLocal}
            messageId={messageId}
            chatId={chatId}
            activeEmojiInteractions={activeEmojiInteractions}
          />
        )}
        {hasAnimatedEmoji && animatedEmoji && (
          <AnimatedEmoji
            emoji={animatedEmoji}
            withEffects={withAnimatedEffects && isUserId(chatId) && !effect}
            isOwn={isOwn}
            observeIntersection={observeIntersectionForLoading}
            forceLoadPreview={isLocal}
            messageId={messageId}
            chatId={chatId}
            activeEmojiInteractions={activeEmojiInteractions}
          />
        )}
        {withAnimatedEffects && effect && !isLocal && (
          <MessageEffect
            shouldPlay={shouldPlayEffect}
            messageId={message.id}
            isMirrored={!message.isOutgoing}
            effect={effect}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            onStop={hideEffect}
          />
        )}
        {phoneCall && (
          <MessagePhoneCall
            message={message}
            phoneCall={phoneCall}
            chatId={chatId}
          />
        )}
        {!isAlbum && isRoundVideo && !withVoiceTranscription && (
          <RoundVideo
            message={message}
            observeIntersection={observeIntersectionForLoading}
            canAutoLoad={canAutoLoadMedia}
            isDownloading={isDownloading}
            onReadMedia={undefined}
            onHideTranscription={setTranscriptionHidden}
            isTranscriptionError={isTranscriptionError}
            isTranscribed={Boolean(transcribedText)}
            canTranscribe={canTranscribeVoice && !hasTtl}
            isTranscriptionHidden={isTranscriptionHidden}
            isTranscribing={isTranscribing}
          />
        )}
        {(audio || voice || withVoiceTranscription) && (
          <Audio
            theme={theme}
            message={message}
            origin={AudioOrigin.Inline}
            uploadProgress={uploadProgress}
            isSelectable={isInDocumentGroup}
            isSelected={isSelected}
            noAvatars={noAvatars}
            onPlay={undefined}
            onReadMedia={undefined}
            onCancelUpload={undefined}
            isDownloading={isDownloading}
            isTranscribing={isTranscribing}
            isTranscriptionHidden={isTranscriptionHidden}
            isTranscribed={Boolean(transcribedText)}
            isTranscriptionError={isTranscriptionError}
            canDownload={!isProtected}
            onHideTranscription={setTranscriptionHidden}
            canTranscribe={canTranscribeVoice && !hasTtl}
          />
        )}
        {document && (
          <Document
            document={document}
            message={message}
            observeIntersection={observeIntersectionForLoading}
            canAutoLoad={canAutoLoadMedia}
            autoLoadFileMaxSizeMb={autoLoadFileMaxSizeMb}
            uploadProgress={uploadProgress}
            isSelectable={isInDocumentGroup}
            isSelected={isSelected}
            onMediaClick={undefined}
            onCancelUpload={undefined}
            isDownloading={isDownloading}
            shouldWarnAboutSvg={shouldWarnAboutSvg}
          />
        )}
        {storyData && !isStoryMention && (
          <Story
            message={message}
            isProtected={isProtected}
          />
        )}
        {isStoryMention && <StoryMention message={message} />}
        {contact && (
          <Contact contact={contact} noUserColors={isOwn} />
        )}
        {poll && (
          // eslint-disable-next-line react/jsx-no-bind
          <Poll message={message} poll={poll} onSendVote={() => {}} />
        )}
        {(giveaway || giveawayResults) && (
          <Giveaway message={message} />
        )}
        {game && (
          <Game
            message={message}
            canAutoLoadMedia={canAutoLoadMedia}
          />
        )}
        {invoice?.extendedMedia && (
          <InvoiceMediaPreview
            message={message}
            isConnected={isConnected}
          />
        )}

        {withVoiceTranscription && (
          <p
            className={buildClassName(
              'transcription',
              !isTranscriptionHidden && isTranscriptionError && 'transcription-error',
            )}
            dir="auto"
          >
            {(isTranscriptionError ? lang('NoWordsRecognized') : (
              isTranscribing && transcribedText ? <DotAnimation content={transcribedText} /> : transcribedText
            ))}
          </p>
        )}

        {isInvertedMedia && renderInvertedMediaContent(hasCustomAppendix)}

        {!isInvertedMedia && (
          <>
            {renderInvertibleMediaContent(hasCustomAppendix)}
            {hasText && !hasAnimatedEmoji && (
              <div ref={textContentRef} className={textContentClass} dir="auto">
                {renderMessageText()}
                {isTranslationPending && (
                  <div className="translation-animation">
                    <div className="text-loading">
                      {renderMessageText(true)}
                    </div>
                  </div>
                )}
                {hasFactCheck && (
                  <FactCheck factCheck={factCheck} isToggleDisabled={isInSelectMode} />
                )}
                {metaPosition === 'in-text' && renderReactionsAndMeta()}
              </div>
            )}
            {renderWebPage()}
          </>
        )}

        {invoice && !invoice.extendedMedia && (
          <Invoice
            message={message}
            shouldAffectAppendix={hasCustomAppendix && !hasReactions}
            isInSelectMode={isInSelectMode}
            isSelected={isSelected}
            theme={theme}
            forcedWidth={contentWidth}
          />
        )}
        {location && (
          <Location
            message={message}
            isInSelectMode={isInSelectMode}
            isSelected={isSelected}
            theme={theme}
            peer={sender}
          />
        )}
      </div>
    );
  }

  function renderInvertedMediaContent(hasCustomAppendix: boolean) {
    const textContentClass = buildClassName(
      'text-content',
      'clearfix',
    );
    const footerClass = buildClassName(
      'text-content',
      'clearfix',
      metaPosition === 'in-text' && 'with-meta',
      outgoingStatus && 'with-outgoing-icon',
    );

    const hasMediaAfterText = isAlbum || (!isAlbum && photo) || (!isAlbum && video && !isRoundVideo);
    const hasContentAfterText = hasMediaAfterText || (!hasAnimatedEmoji && hasFactCheck);
    const isMetaInText = metaPosition === 'in-text';

    return (
      <>
        {renderWebPage()}
        {hasText && !hasAnimatedEmoji && (
          <div ref={textContentRef} className={textContentClass} dir="auto">
            {renderMessageText()}
            {isTranslationPending && (
              <div className="translation-animation">
                <div className="text-loading">
                  {renderMessageText(true)}
                </div>
              </div>
            )}
            {!hasContentAfterText && isMetaInText && renderReactionsAndMeta()}
          </div>
        )}

        {hasContentAfterText && (
          <>
            {renderInvertibleMediaContent(hasCustomAppendix)}
            {!hasAnimatedEmoji && (
              <div className={footerClass} dir="auto">
                {hasFactCheck && (
                  <FactCheck factCheck={factCheck} isToggleDisabled={isInSelectMode} />
                )}
                {isMetaInText && renderReactionsAndMeta()}
              </div>
            )}
          </>
        )}

      </>
    );
  }

  function renderWebPage() {
    return webPage && (
      <WebPage
        message={message}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        noAvatars={noAvatars}
        canAutoLoad={canAutoLoadMedia}
        canAutoPlay={canAutoPlayMedia}
        asForwarded={asForwarded}
        isDownloading={isDownloading}
        isProtected={isProtected}
        theme={theme}
        story={webPageStory}
        isConnected={isConnected}
        backgroundEmojiId={messageColorPeer?.color?.backgroundEmojiId}
        shouldWarnAboutSvg={shouldWarnAboutSvg}
        autoLoadFileMaxSizeMb={autoLoadFileMaxSizeMb}
        onAudioPlay={undefined}
        onMediaClick={undefined}
        onCancelMediaTransfer={undefined}
      />
    );
  }

  function renderInvertibleMediaContent(hasCustomAppendix: boolean) {
    const content = (
      <>
        {isAlbum && (
          <Album
            album={album!}
            albumLayout={albumLayout!}
            observeIntersection={observeIntersectionForLoading}
            isOwn={isOwn}
            isProtected={isProtected}
            hasCustomAppendix={hasCustomAppendix}
            // eslint-disable-next-line react/jsx-no-bind
            onMediaClick={() => {}}
          />
        )}
        {!isAlbum && photo && (
          <Photo
            messageText={text?.text}
            photo={photo}
            isOwn={isOwn}
            observeIntersection={observeIntersectionForLoading}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoadMedia}
            uploadProgress={uploadProgress}
            shouldAffectAppendix={hasCustomAppendix}
            isDownloading={isDownloading}
            isProtected={isProtected}
            asForwarded={asForwarded}
            theme={theme}
            forcedWidth={contentWidth}
            onClick={undefined}
            onCancelUpload={undefined}
          />
        )}
        {!isAlbum && video && !isRoundVideo && (
          <Video
            video={video}
            isOwn={isOwn}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            forcedWidth={contentWidth}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoadMedia}
            canAutoPlay={canAutoPlayMedia}
            uploadProgress={uploadProgress}
            isDownloading={isDownloading}
            isProtected={isProtected}
            asForwarded={asForwarded}
            onClick={undefined}
            onCancelUpload={undefined}
          />
        )}
      </>
    );

    if (paidMedia) {
      return (
        <PaidMediaOverlay chatId={chatId} messageId={messageId} paidMedia={paidMedia} isOutgoing={isOwn}>
          {content}
        </PaidMediaOverlay>
      );
    }

    return content;
  }

  function shouldRenderSenderName() {
    if (forwardsNoAuthors) {
      return false;
    }
    const media = photo || video || location || paidMedia;
    return !(isCustomShape && !viaBotId) && (
      (withSenderName && (!media || hasTopicChip)) || asForwarded || viaBotId || forceSenderName
    ) && !isInDocumentGroupNotFirst && !(hasMessageReply && isCustomShape);
  }

  function renderForwardTitle() {
    return (
      <span className="forward-title-container">
        {asForwarded && (
          <Icon name={forwardInfo?.hiddenUserName ? 'forward' : 'share-filled'} />
        )}
        {asForwarded && (
          <span className="forward-title">
            {lang('ForwardedFrom')}
          </span>
        )}
      </span>
    );
  }

  function renderSenderName(shouldSkipRenderForwardTitle:boolean = false, shouldSkipRenderAdminTitle: boolean = false) {
    let senderTitle;
    let senderColor;
    if (senderPeer && !(isCustomShape && viaBotId)) {
      senderTitle = getPeerTitle(lang, senderPeer);
    } else if (forwardInfo?.hiddenUserName) {
      senderTitle = forwardInfo.hiddenUserName;
    } else if (storyData && originSender) {
      senderTitle = getPeerTitle(lang, originSender!);
    }
    const senderEmojiStatus = senderPeer && 'emojiStatus' in senderPeer && senderPeer.emojiStatus;
    const senderIsPremium = senderPeer && 'isPremium' in senderPeer && senderPeer.isPremium;

    const shouldRenderForwardAvatar = asForwarded && senderPeer;
    const hasBotSenderUsername = botSender?.usernames?.length;
    return (
      <div className="message-title" dir="ltr">
        {(senderTitle || asForwarded) ? (
          <span
            className={buildClassName(
              'message-title-name-container',
              forwardInfo?.hiddenUserName ? 'sender-hidden' : 'interactive',
              senderColor,
            )}
            dir="ltr"
          >
            {!shouldSkipRenderForwardTitle && renderForwardTitle()}
            <span className="message-title-name">
              {storyData && <Icon name="play-story" />}
              {shouldRenderForwardAvatar && (
                <Avatar
                  className="forward-avatar"
                  peer={senderPeer}
                  size="micro"
                />
              )}
              <span
                className="sender-title"
              >
                {senderTitle ? renderText(senderTitle) : (asForwarded ? NBSP : undefined)}
              </span>
              {!asForwarded && senderEmojiStatus && (
                <CustomEmoji
                  documentId={senderEmojiStatus.documentId}
                  loopLimit={EMOJI_STATUS_LOOP_LIMIT}
                  observeIntersectionForLoading={observeIntersectionForLoading}
                  observeIntersectionForPlaying={observeIntersectionForPlaying}
                />
              )}
              {!asForwarded && !senderEmojiStatus && senderIsPremium && <StarIcon />}
              {senderPeer?.fakeType && <FakeIcon fakeType={senderPeer.fakeType} />}
            </span>
          </span>
        ) : !botSender ? (
          NBSP
        ) : undefined}
        {botSender?.usernames?.length && (
          <span className="interactive">
            <span className="via">{lang('ViaBot')}</span>
            <span
              className="sender-title"
            >
              {renderText(`@${botSender.usernames[0].username}`)}
            </span>
          </span>
        )}
        <div className="title-spacer" />
        {!shouldSkipRenderAdminTitle && !hasBotSenderUsername ? (forwardInfo?.isLinkedChannelPost ? (
          <span className="admin-title" dir="auto">{lang('DiscussChannel')}</span>
        ) : message.postAuthorTitle && isGroup && !asForwarded ? (
          <span className="admin-title" dir="auto">{message.postAuthorTitle}</span>
        ) : senderAdminMember && !asForwarded && !viaBotId ? (
          <span className="admin-title" dir="auto">
            {senderAdminMember.customTitle || lang(
              senderAdminMember.isOwner ? 'GroupInfo.LabelOwner' : 'GroupInfo.LabelAdmin',
            )}
          </span>
        ) : undefined) : undefined}
        {canShowSenderBoosts && (
          <span className="sender-boosts" aria-hidden>
            <Icon name={senderBoosts > 1 ? 'boosts' : 'boost'} />
            {senderBoosts > 1 ? senderBoosts : undefined}
          </span>
        )}
      </div>
    );
  }

  const forwardAuthor = isGroup && asForwarded ? message.postAuthorTitle : undefined;

  return (
    <div
      ref={ref}
      id={getMessageHtmlId(message.id)}
      className={containerClassName}
      data-message-id={messageId}
      onCopy={isProtected ? stopEvent : undefined}
    >
      <div
        ref={bottomMarkerRef}
        className="bottom-marker"
        data-message-id={messageId}
        data-last-message-id={album ? album.messages[album.messages.length - 1].id : undefined}
        data-album-main-id={album ? album.mainMessage.id : undefined}
        data-has-unread-mention={message.hasUnreadMention || undefined}
        data-has-unread-reaction={hasUnreadReaction || undefined}
        data-is-pinned={isPinned || undefined}
        data-should-update-views={message.viewsCount !== undefined}
      />
      {!isInDocumentGroup && (
        <div className="message-select-control">
          {isSelected && <Icon name="select" />}
        </div>
      )}
      {isLastInDocumentGroup && (
        <div
          className={buildClassName('message-select-control group-select', isGroupSelected && 'is-selected')}
        >
          {isGroupSelected && (
            <Icon name="select" />
          )}
        </div>
      )}
      <div
        className={buildClassName('message-content-wrapper',
          contentClassName.includes('text') && 'can-select-text',
          contentClassName.includes('giveaway') && 'giveaway-result-content')}
      >
        <div
          className={contentClassName}
          style={style}
          dir="auto"
        >
          {asForwarded && !isInDocumentGroupNotFirst && (
            <>
              {shouldRenderSenderName() && renderSenderName()}
              {forwardAuthor && <span className="admin-title" dir="auto">{forwardAuthor}</span>}
            </>
          )}
          {renderContent()}
          {/* <button onClick={() => console.log('message', message, 'previewtype', previewMessageListType)}>Dump me</button> */}
          {!isInDocumentGroupNotLast && metaPosition === 'standalone' && !isStoryMention && renderReactionsAndMeta()}
          {withAppendix && <MessageAppendix isOwn={isOwn} />}
        </div>
        {message.inlineButtons && (
          // eslint-disable-next-line react/jsx-no-bind
          <InlineButtons message={message} onClick={() => {}} />
        )}
        {reactionsPosition === 'outside' && !isStoryMention && (
          <Reactions
            message={reactionMessage!}
            threadId={threadId}
            isOutside
            isCurrentUserPremium={isPremium}
            maxWidth={reactionsMaxWidth}
            observeIntersection={observeIntersectionForPlaying}
            noRecentReactors={isChannel}
            tags={tags}
          />
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, ownProps): StateProps => {
    const {
      focusedMessage, forwardMessages, activeReactions, activeEmojiInteractions,
      loadingThread,
    } = selectTabState(global);
    const {
      message,
      album,
      withSenderName,
      withAvatar,
      threadId,
      messageListType,
      previewMessageListType,
      isLastInDocumentGroup,
      isFirstInGroup,
    } = ownProps;
    const {
      id, chatId, viaBotId, isOutgoing, forwardInfo, transcriptionId, isPinned, viaBusinessBotId, effectId,
    } = message;

    const chat = selectChat(global, chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isSystemBotChat = isSystemBot(chatId);
    const isAnonymousForwards = isAnonymousForwardsChat(chatId);
    const isChannel = chat && isChatChannel(chat);
    const isGroup = chat && isChatGroup(chat);
    const chatFullInfo = !isUserId(chatId) ? selectChatFullInfo(global, chatId) : undefined;
    const webPageStoryData = message.content.webPage?.story;
    const webPageStory = webPageStoryData
      ? selectPeerStory(global, webPageStoryData.peerId, webPageStoryData.id)
      : undefined;

    const isForwarding = forwardMessages.messageIds && forwardMessages.messageIds.includes(id);
    const forceSenderName = !isChatWithSelf && isAnonymousOwnMessage(message);
    const canShowSender = withSenderName || withAvatar || forceSenderName;
    const sender = selectSender(global, message);
    const originSender = selectForwardedSender(global, message);
    const botSender = viaBotId ? selectUser(global, viaBotId) : undefined;
    const senderAdminMember = sender?.id && isGroup
      ? chatFullInfo?.adminMembersById?.[sender?.id]
      : undefined;

    const isThreadTop = message.id === threadId;

    const { replyToMsgId, replyToPeerId, replyFrom } = getMessageReplyInfo(message) || {};
    const { peerId: storyReplyPeerId, storyId: storyReplyId } = getStoryReplyInfo(message) || {};

    const shouldHideReply = replyToMsgId && replyToMsgId === threadId;
    const replyMessage = replyToMsgId ? selectChatMessage(global, replyToPeerId || chatId, replyToMsgId) : undefined;
    const forwardHeader = forwardInfo || replyFrom;
    const replyMessageSender = replyMessage ? selectSender(global, replyMessage)
      : forwardHeader && !isSystemBotChat && !isAnonymousForwards
        ? selectSenderFromHeader(global, forwardHeader) : undefined;
    const replyMessageForwardSender = replyMessage && selectForwardedSender(global, replyMessage);
    const replyMessageChat = replyToPeerId ? selectChat(global, replyToPeerId) : undefined;
    const isReplyPrivate = !isSystemBotChat && !isAnonymousForwards && replyMessageChat
      && !isChatPublic(replyMessageChat)
      && (replyMessageChat.isNotJoined || replyMessageChat.isRestricted);
    const isReplyToTopicStart = replyMessage?.content.action?.type === 'topicCreate';
    const replyStory = storyReplyId && storyReplyPeerId
      ? selectPeerStory(global, storyReplyPeerId, storyReplyId)
      : undefined;
    const storySender = storyReplyPeerId ? selectPeer(global, storyReplyPeerId) : undefined;

    const uploadProgress = selectUploadProgress(global, message);
    const isFocused = messageListType === 'thread' && (
      album
        ? album.messages.some((m) => selectIsMessageFocused(global, m, threadId))
        : selectIsMessageFocused(global, message, threadId)
    );

    const {
      direction: focusDirection, noHighlight: noFocusHighlight, isResizingContainer,
      quote: focusedQuote, scrollTargetPosition,
    } = (isFocused && focusedMessage) || {};

    const middleSearch = selectCurrentMiddleSearch(global);
    const highlight = middleSearch?.results?.query
      && `${middleSearch.isHashtag ? '#' : ''}${middleSearch.results.query}`;

    const singleEmoji = getMessageSingleRegularEmoji(message);
    const animatedEmoji = singleEmoji && selectAnimatedEmoji(global, singleEmoji) ? singleEmoji : undefined;
    const animatedCustomEmoji = getMessageSingleCustomEmoji(message);

    let isSelected: boolean;
    if (album?.messages) {
      isSelected = album.messages.every(({ id: messageId }) => selectIsMessageSelected(global, messageId));
    } else {
      isSelected = selectIsMessageSelected(global, id);
    }

    const canReply = messageListType === 'thread' && selectCanReplyToMessage(global, message, threadId);
    const activeDownloads = selectActiveDownloads(global);
    const downloadableMedia = getMessageDownloadableMedia(message);
    const isDownloading = downloadableMedia && getIsDownloading(activeDownloads, downloadableMedia);

    const repliesThreadInfo = selectThreadInfo(global, chatId, album?.commentsMessage?.id || id);

    const isInDocumentGroup = Boolean(message.groupedId) && !message.isInAlbum;
    const documentGroupFirstMessageId = isInDocumentGroup
      ? selectMessageIdsByGroupId(global, chatId, message.groupedId!)![0]
      : undefined;
    const reactionMessage = isInDocumentGroup ? (
      isLastInDocumentGroup ? selectChatMessage(global, chatId, documentGroupFirstMessageId!) : undefined
    ) : message;

    const hasUnreadReaction = chat?.unreadReactions?.includes(message.id);

    const hasTopicChip = threadId === MAIN_THREAD_ID && chat?.isForum && isFirstInGroup;
    const messageTopic = hasTopicChip ? selectTopicFromMessage(global, message) : undefined;

    const chatTranslations = selectChatTranslations(global, chatId);

    const requestedTranslationLanguage = selectRequestedMessageTranslationLanguage(global, chatId, message.id);
    const requestedChatTranslationLanguage = selectRequestedChatTranslationLanguage(global, chatId);

    const areTranslationsEnabled = IS_TRANSLATION_SUPPORTED && global.settings.byKey.canTranslate
      && !requestedChatTranslationLanguage; // Stop separate language detection if chat translation is requested

    const isConnected = global.connectionState === 'connectionStateReady';

    const hasActiveReactions = Boolean(reactionMessage && activeReactions[getMessageKey(reactionMessage)]?.length);

    const isPremium = selectIsCurrentUserPremium(global);
    const senderBoosts = sender && selectIsChatWithSelf(global, sender.id)
      ? (chatFullInfo?.boostsApplied ?? message.senderBoosts) : message.senderBoosts;

    const chatLevel = chat?.boostLevel || 0;
    const transcribeMinLevel = global.appConfig?.groupTranscribeLevelMin;
    const canTranscribeVoice = isPremium || Boolean(transcribeMinLevel && chatLevel >= transcribeMinLevel);

    const viaBusinessBot = viaBusinessBotId ? selectUser(global, viaBusinessBotId) : undefined;

    const effect = effectId ? global.availableEffectById[effectId] : undefined;

    const poll = selectPollFromMessage(global, message);

    const draftReplyInfo = selectDraft(global, chatId, threadId)?.replyInfo;

    return {
      theme: selectTheme(global),
      forceSenderName,
      sender,
      canShowSender,
      originSender,
      botSender,
      shouldHideReply: shouldHideReply || isReplyToTopicStart,
      isThreadTop,
      replyMessage,
      replyMessageSender,
      replyMessageForwardSender,
      replyMessageChat,
      replyStory,
      isReplyPrivate,
      storySender,
      isInDocumentGroup,
      isProtected: selectIsMessageProtected(global, message),
      isChatProtected: selectIsChatProtected(global, chatId),
      isFocused,
      isForwarding,
      reactionMessage,
      isChatWithSelf,
      isRepliesChat: isSystemBotChat,
      isAnonymousForwards: isAnonymousForwards || forwardMessages.noAuthors,
      isChannel,
      isGroup,
      canReply,
      highlight,
      animatedEmoji,
      animatedCustomEmoji,
      isInSelectMode: selectIsInSelectMode(global),
      isSelected,
      isGroupSelected: (
        Boolean(message.groupedId)
        && !message.isInAlbum
        && selectIsDocumentGroupSelected(global, chatId, message.groupedId)
      ),
      threadId,
      isDownloading,
      isPinnedList: messageListType === 'pinned',
      isPinned,
      canAutoLoadMedia: selectCanAutoLoadMedia(global, message),
      canAutoPlayMedia: selectCanAutoPlayMedia(global, message),
      autoLoadFileMaxSizeMb: global.settings.byKey.autoLoadFileMaxSizeMb,
      shouldLoopStickers: selectShouldLoopStickers(global),
      repliesThreadInfo,
      availableReactions: global.reactions.availableReactions,
      defaultReaction: isMessageLocal(message) || messageListType === 'scheduled'
        ? undefined : selectDefaultReaction(global, chatId),
      hasActiveReactions,
      activeEmojiInteractions,
      hasUnreadReaction,
      isTranscribing: transcriptionId !== undefined && global.transcriptions[transcriptionId]?.isPending,
      transcribedText: transcriptionId !== undefined ? global.transcriptions[transcriptionId]?.text : undefined,
      isPremium,
      senderAdminMember,
      messageTopic,
      hasTopicChip,
      chatTranslations,
      areTranslationsEnabled,
      shouldDetectChatLanguage: selectShouldDetectChatLanguage(global, chatId),
      requestedTranslationLanguage,
      requestedChatTranslationLanguage,
      hasLinkedChat: Boolean(chatFullInfo?.linkedChatId),
      withAnimatedEffects: selectPerformanceSettingsValue(global, 'stickerEffects'),
      webPageStory,
      isConnected,
      isLoadingComments: repliesThreadInfo?.isCommentsInfo
        && loadingThread?.loadingChatId === repliesThreadInfo?.originChannelId
        && loadingThread?.loadingMessageId === repliesThreadInfo?.originMessageId,
      shouldWarnAboutSvg: global.settings.byKey.shouldWarnAboutSvg,
      ...(isOutgoing && {
        outgoingStatus: previewMessageListType === 'forward'
          ? 'succeeded'
          : selectOutgoingStatus(global, message, messageListType === 'scheduled'),
      }),
      ...(typeof uploadProgress === 'number' && { uploadProgress }),
      ...(isFocused && {
        focusDirection,
        noFocusHighlight,
        isResizingContainer,
        focusedQuote,
        scrollTargetPosition,
      }),
      senderBoosts,
      tags: global.savedReactionTags?.byKey,
      canTranscribeVoice,
      viaBusinessBot,
      effect,
      poll,
      forwardsNoAuthors: forwardMessages.noAuthors,
      forwardsNoCaptions: forwardMessages.noCaptions,
      draftReplyInfo,
    };
  },
)(PreviewMessage));
