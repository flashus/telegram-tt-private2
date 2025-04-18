import { useMemo } from '../../../lib/teact/teact';

import type {
  ApiAvailableReaction,
  ApiEmojiStatusType,
  ApiReaction, ApiReactionWithPaid, ApiSticker, ApiStickerSet,
} from '../../../api/types';
import type { StickerSetOrReactionsSetOrRecent } from '../../../types';

import {
  COLLECTIBLE_STATUS_SET_ID, POPULAR_SYMBOL_SET_ID, RECENT_SYMBOL_SET_ID, TOP_SYMBOL_SET_ID,
} from '../../../config';
import { isSameReaction } from '../../../global/helpers';
import { pickTruthy, unique, uniqueByField } from '../../../util/iteratees';

import useLang from '../../../hooks/useLang';
import useOldLang from '../../../hooks/useOldLang';

type UseCustomEmojiProps = {
  preventPushRecent?: boolean;
  addedCustomEmojiIds?: string[];
  withDefaultTopicIcons?: boolean;
  recentCustomEmojis?: ApiSticker[];
  customEmojiFeaturedIds?: string[];
  stickerSetsById: Record<string, ApiStickerSet>;
  topReactions?: ApiReaction[];
  availableReactions?: ApiAvailableReaction[];
  recentReactions?: ApiReaction[];
  defaultStatusIconsId?: string;
  defaultTopicIconsId?: string;
  defaultTagReactions?: ApiReaction[];
  chatEmojiSetId?: string;
  isReactionPicker?: boolean;
  isStatusPicker?: boolean;
  isSavedMessages?: boolean;
  isWithPaidReaction?: boolean;
  collectibleStatuses?: ApiEmojiStatusType[];
  customEmojisById?: Record<string, ApiSticker>;
};

const TOP_REACTIONS_COUNT = 16;
const RECENT_REACTIONS_COUNT = 32;
const RECENT_DEFAULT_STATUS_COUNT = 7;

export default function useAllCustomEmojiSets({
  preventPushRecent,
  addedCustomEmojiIds,
  withDefaultTopicIcons,
  recentCustomEmojis,
  customEmojiFeaturedIds,
  stickerSetsById,
  topReactions,
  availableReactions,
  recentReactions,
  defaultStatusIconsId,
  defaultTopicIconsId,
  defaultTagReactions,
  chatEmojiSetId,
  isReactionPicker,
  isStatusPicker,
  isSavedMessages,
  isWithPaidReaction,
  collectibleStatuses,
  customEmojisById,
}: UseCustomEmojiProps): { allSets: (ApiStickerSet | StickerSetOrReactionsSetOrRecent)[] } {
  const oldLang = useOldLang();
  const lang = useLang();

  const collectibleStatusEmojis = useMemo(() => {
    const collectibleStatusEmojiIds = collectibleStatuses?.map((status) => status.documentId);
    return customEmojisById && collectibleStatusEmojiIds?.map((id) => customEmojisById[id]).filter(Boolean);
  }, [customEmojisById, collectibleStatuses]);

  const allSets = useMemo(() => {
    const defaultSets: StickerSetOrReactionsSetOrRecent[] = [];

    if (isReactionPicker && isSavedMessages) {
      if (defaultTagReactions?.length) {
        defaultSets.push({
          id: TOP_SYMBOL_SET_ID,
          accessHash: '',
          title: oldLang('PremiumPreviewTags'),
          reactions: defaultTagReactions,
          count: defaultTagReactions.length,
          isEmoji: true,
        });
      }
    }

    if (isReactionPicker && !isSavedMessages) {
      const topReactionsSlice: ApiReactionWithPaid[] = topReactions?.slice(0, TOP_REACTIONS_COUNT) || [];
      if (isWithPaidReaction) {
        topReactionsSlice.unshift({ type: 'paid' });
      }
      if (topReactionsSlice?.length) {
        defaultSets.push({
          id: TOP_SYMBOL_SET_ID,
          accessHash: '',
          title: oldLang('Reactions'),
          reactions: topReactionsSlice,
          count: topReactionsSlice.length,
          isEmoji: true,
        });
      }

      const cleanRecentReactions = (recentReactions || [])
        .filter((reaction) => !topReactionsSlice.some((topReaction) => isSameReaction(topReaction, reaction)))
        .slice(0, RECENT_REACTIONS_COUNT);
      const cleanAvailableReactions = (availableReactions || [])
        .filter(({ isInactive }) => !isInactive)
        .map(({ reaction }) => reaction)
        .filter((reaction) => {
          return !topReactionsSlice.some((topReaction) => isSameReaction(topReaction, reaction))
            && !cleanRecentReactions.some((topReaction) => isSameReaction(topReaction, reaction));
        });
      if (cleanAvailableReactions?.length || cleanRecentReactions?.length) {
        const isPopular = !cleanRecentReactions?.length;
        const allRecentReactions = cleanRecentReactions.concat(cleanAvailableReactions);
        defaultSets.push({
          id: isPopular ? POPULAR_SYMBOL_SET_ID : RECENT_SYMBOL_SET_ID,
          accessHash: '',
          title: oldLang(isPopular ? 'PopularReactions' : 'RecentStickers'),
          reactions: allRecentReactions,
          count: allRecentReactions.length,
          isEmoji: true,
        });
      }
    } else if (isStatusPicker) {
      const defaultStatusIconsPack = stickerSetsById[defaultStatusIconsId!];
      if (defaultStatusIconsPack?.stickers?.length) {
        const stickers = uniqueByField(defaultStatusIconsPack.stickers
          .slice(0, RECENT_DEFAULT_STATUS_COUNT)
          .concat(recentCustomEmojis || []), 'id');
        defaultSets.push({
          ...defaultStatusIconsPack,
          stickers,
          count: stickers.length,
          id: RECENT_SYMBOL_SET_ID,
          title: oldLang('RecentStickers'),
          isEmoji: true,
        });
      }
      if (collectibleStatusEmojis?.length) {
        defaultSets.push({
          id: COLLECTIBLE_STATUS_SET_ID,
          accessHash: '',
          count: collectibleStatusEmojis.length,
          stickers: collectibleStatusEmojis,
          title: lang('CollectibleStatusesCategory'),
          isEmoji: true,
        });
      }
    } else if (withDefaultTopicIcons) {
      const defaultTopicIconsPack = stickerSetsById[defaultTopicIconsId!];
      if (defaultTopicIconsPack.stickers?.length) {
        defaultSets.push({
          ...defaultTopicIconsPack,
          id: RECENT_SYMBOL_SET_ID,
          title: oldLang('RecentStickers'),
        });
      }
    } else if (recentCustomEmojis?.length && !preventPushRecent) {
      defaultSets.push({
        id: RECENT_SYMBOL_SET_ID,
        accessHash: '0',
        title: oldLang('RecentStickers'),
        stickers: recentCustomEmojis,
        count: recentCustomEmojis.length,
        isEmoji: true,
      });
    }

    const userSetIds = [...(addedCustomEmojiIds || [])];
    if (chatEmojiSetId) {
      userSetIds.unshift(chatEmojiSetId);
    }

    const setIdsToDisplay = unique(userSetIds.concat(customEmojiFeaturedIds || []));

    const setsToDisplay = Object.values(pickTruthy(stickerSetsById, setIdsToDisplay));

    return [
      ...defaultSets,
      ...setsToDisplay,
    ];
  }, [
    addedCustomEmojiIds, isReactionPicker, isStatusPicker, withDefaultTopicIcons, recentCustomEmojis,
    customEmojiFeaturedIds, stickerSetsById, topReactions, availableReactions, oldLang, recentReactions,
    defaultStatusIconsId, defaultTopicIconsId, isSavedMessages, defaultTagReactions, chatEmojiSetId,
    isWithPaidReaction, collectibleStatusEmojis, lang, preventPushRecent,
  ]);

  return { allSets };
}
