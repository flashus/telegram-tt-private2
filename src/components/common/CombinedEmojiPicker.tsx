import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo,
  useRef, useState,
} from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../global';

import type {
  ApiAvailableReaction, ApiEmojiStatusType, ApiReaction, ApiReactionWithPaid, ApiSticker, ApiStickerSet,
} from '../../api/types';
import type { StickerSetOrReactionsSetOrRecent } from '../../types';
import type {
  EmojiData,
  EmojiModule,
  EmojiRawData,
} from '../../util/emoji/emoji';

import {
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
  STICKER_PICKER_MAX_SHARED_COVERS,
  STICKER_SIZE_PICKER_HEADER,
  TOP_SYMBOL_SET_ID,
} from '../../config';
import {
  selectCanPlayAnimatedEmojis,
  selectChatFullInfo,
  selectIsAlwaysHighPriorityEmoji,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
} from '../../global/selectors';
import animateHorizontalScroll from '../../util/animateHorizontalScroll';
import buildClassName from '../../util/buildClassName';
import { uncompressEmoji } from '../../util/emoji/emoji';
import { pickTruthy } from '../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { REM } from './helpers/mediaDimensions';

import useAppLayout from '../../hooks/useAppLayout';
import useDebouncedCallback from '../../hooks/useDebouncedCallback';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useScrolledState from '../../hooks/useScrolledState';
import useAsyncRendering from '../right/hooks/useAsyncRendering';
import useAllCustomEmojiSets from './hooks/useAllCustomEmojiSets';
import { useStickerPickerObservers } from './hooks/useStickerPickerObservers';

import EmojiCategory from '../middle/composer/EmojiCategory';
import StickerSetCover from '../middle/composer/StickerSetCover';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import CombinedEmojiSet from './CombinedEmojiSet';
import EmojiCategoryCovers from './EmojiCategoryCovers';
import Icon from './icons/Icon';
import StickerButton from './StickerButton';
import StickerSet from './StickerSet';
import SymbolSearch from './SymbolSearch';

import pickerStyles from '../middle/composer/StickerPicker.module.scss';
import styles from './CombinedEmojiPicker.module.scss';

type OwnProps = {
  className?: string;
  chatId?: string;
  pickerListClassName?: string;
  isHidden?: boolean;
  loadAndPlay: boolean;
  idPrefix?: string;
  withDefaultTopicIcons?: boolean;
  selectedReactionIds?: string[];
  isStatusPicker?: boolean;
  isReactionPicker?: boolean;
  isTranslucent?: boolean;
  onEmojiSelect: (emoji: string, name: string) => void;
  onCustomEmojiSelect: (sticker: ApiSticker) => void;
  onReactionSelect?: (reaction: ApiReactionWithPaid) => void;
  onReactionContext?: (reaction: ApiReactionWithPaid) => void;
  onContextMenuOpen?: NoneToVoidFunction;
  onContextMenuClose?: NoneToVoidFunction;
  onContextMenuClick?: NoneToVoidFunction;
};

type StateProps = {
  recentEmojis: string[];
  customEmojisById?: Record<string, ApiSticker>;
  recentCustomEmojiIds?: string[];
  recentStatusEmojis?: ApiSticker[];
  collectibleStatuses?: ApiEmojiStatusType[];
  chatEmojiSetId?: string;
  topReactions?: ApiReaction[];
  recentReactions?: ApiReaction[];
  defaultTagReactions?: ApiReaction[];
  stickerSetsById: Record<string, ApiStickerSet>;
  availableReactions?: ApiAvailableReaction[];
  addedCustomEmojiIds?: string[];
  defaultTopicIconsId?: string;
  defaultStatusIconsId?: string;
  customEmojiFeaturedIds?: string[];
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  isWithPaidReaction?: boolean;
};

export type CombinedEmojiSetData = StickerSetOrReactionsSetOrRecent & {
  emojis: string[];
};

enum EmojiSetType {
  Combined,
  Emoji,
  CustomEmoji,
}

type EmojiSet =
| { data: EmojiCategory; type: EmojiSetType.Emoji }
| { data: CombinedEmojiSetData; type: EmojiSetType.Combined }
| { data: ApiStickerSet | StickerSetOrReactionsSetOrRecent; type: EmojiSetType.CustomEmoji };

const OPEN_ANIMATION_DELAY = 200;
// const SMOOTH_SCROLL_DISTANCE = 100;
// const FOCUS_MARGIN = 3.25 * REM;
const HEADER_BUTTON_WIDTH = 2.625 * REM; // Includes margins

const MAX_EMOJI_QUERY_LENGTH = 10;

// TODO! Check scss files for occurense of this prefix!
const DEFAULT_ID_PREFIX = 'combined-emoji-group';

/** Move this to config if needed */
const FILTERED_SYMBOL_SET_ID = 'filtered';

const FADED_BUTTON_SET_IDS = new Set([RECENT_SYMBOL_SET_ID, FAVORITE_SYMBOL_SET_ID, POPULAR_SYMBOL_SET_ID]);
const STICKER_SET_IDS_WITH_COVER = new Set([
  RECENT_SYMBOL_SET_ID,
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
]);

const LEADING_EMOJI_REGEXP = /^(\p{Emoji}\uFE0F|\p{Emoji_Presentation})/gu;

let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

const CombinedEmojiPicker: FC<OwnProps & StateProps> = ({
  className,
  recentEmojis,
  pickerListClassName,
  isHidden,
  loadAndPlay,
  addedCustomEmojiIds,
  customEmojisById,
  recentCustomEmojiIds,
  selectedReactionIds,
  recentStatusEmojis,
  collectibleStatuses,
  stickerSetsById,
  chatEmojiSetId,
  topReactions,
  recentReactions,
  availableReactions,
  idPrefix = DEFAULT_ID_PREFIX,
  customEmojiFeaturedIds,
  canAnimate,
  isReactionPicker,
  isStatusPicker,
  isTranslucent,
  isSavedMessages,
  isCurrentUserPremium,
  withDefaultTopicIcons,
  defaultTopicIconsId,
  defaultStatusIconsId,
  defaultTagReactions,
  isWithPaidReaction,
  onEmojiSelect,
  onCustomEmojiSelect,
  onReactionSelect,
  onReactionContext,
  onContextMenuOpen,
  onContextMenuClose,
  onContextMenuClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [categories, setCategories] = useState<EmojiCategory[]>();
  const [emojis, setEmojis] = useState<AllEmojis>();
  const { isMobile } = useAppLayout();
  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  // const [emojiSets, setEmojiSets] = useState<EmojiSet[]>();

  const recentCustomEmojis = useMemo(() => {
    return isStatusPicker
      ? recentStatusEmojis
      : Object.values(pickTruthy(customEmojisById!, recentCustomEmojiIds!));
  }, [customEmojisById, isStatusPicker, recentCustomEmojiIds, recentStatusEmojis]);

  const prefix = `${idPrefix}-combined-emoji`;
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden);

  const canLoadAndPlay = usePrevDuringAnimation(loadAndPlay || undefined, SLIDE_TRANSITION_DURATION);

  const oldLang = useOldLang();

  const areAddedLoaded = Boolean(addedCustomEmojiIds);

  const { allSets: allCustomEmojiSets } = useAllCustomEmojiSets({
    preventPushRecent: true, // could be changed to some derived value
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
  });

  const recentEmojiSet: EmojiSet = useMemo(() => {
    return {
      data: {
        id: RECENT_SYMBOL_SET_ID,
        emojis: recentEmojis,
        stickers: recentCustomEmojis,
        accessHash: '',
        title: oldLang('RecentStickers'),
        count: recentEmojis.length + (recentCustomEmojis?.length ?? 0),
        isEmoji: true,
      },
      type: EmojiSetType.Combined,
    };
  }, [oldLang, recentCustomEmojis, recentEmojis]);

  const allSets = useMemo<EmojiSet[]>(() => {
    if (!categories) {
      return MEMO_EMPTY_ARRAY;
    }

    const sets: EmojiSet[] = [];

    if (recentEmojiSet.data.count > 0) {
      sets.push(recentEmojiSet);
    }

    for (const category of categories) {
      sets.push({
        data: category,
        type: EmojiSetType.Emoji,
      });
    }

    for (const set of allCustomEmojiSets) {
      sets.push({
        data: set,
        type: EmojiSetType.CustomEmoji,
      });
    }

    return sets;
  }, [recentEmojiSet, allCustomEmojiSets, categories]);

  const haveRecentEmojiSet = recentEmojiSet.data.count > 0;
  const categoriesActive = categories && activeSetIndex >= (haveRecentEmojiSet ? 1 : 0)
    && activeSetIndex < (haveRecentEmojiSet ? 1 : 0) + categories.length;

  // Initialize data on first render.
  useEffect(() => {
    setTimeout(() => {
      const exec = () => {
        setCategories(emojiData.categories);

        setEmojis(emojiData.emojis as AllEmojis);
      };

      if (emojiData) {
        exec();
      } else {
        ensureEmojiData()
          .then(exec);
      }
    }, OPEN_ANIMATION_DELAY);
  }, []);

  // Scroll container and header when active set changes
  useEffect(() => {
    if (!areAddedLoaded) {
      return;
    }

    const header = headerRef.current;
    if (!header) {
      return;
    }

    let effectiveActiveIndex: number = 0;

    if (categoriesActive) {
      effectiveActiveIndex = 1;
    } else {
      effectiveActiveIndex = activeSetIndex - (categories?.length ?? 0) + 1;
    }

    const newLeft = effectiveActiveIndex * HEADER_BUTTON_WIDTH - (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

    animateHorizontalScroll(header, newLeft);
  }, [areAddedLoaded, activeSetIndex, categories, categoriesActive]);

  const noPopulatedSets = useMemo(() => (
    areAddedLoaded
    && allSets.filter((set) => {
      switch (set.type) {
        case EmojiSetType.Emoji:
          return set.data.emojis?.length;
        case EmojiSetType.CustomEmoji:
          return set.data.stickers?.length;
        case EmojiSetType.Combined:
          return set.data.emojis?.length && set.data.stickers?.length;
        default:
          return false;
      }
    }).length === 0
  ), [allSets, areAddedLoaded]);

  const canRenderContent = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
  const shouldRenderContent = areAddedLoaded && canRenderContent && !noPopulatedSets && emojis;

  useHorizontalScroll(headerRef, isMobile || !shouldRenderContent || categoriesActive);

  const filteredEmojiSet = useMemo<EmojiSet | undefined>(() => {
    if (!searchQuery) {
      return undefined;
    }
    const filteredEmojis: string[] = [];
    const filteredCustomEmojis: ApiSticker[] = [];

    const leadingEmoji = searchQuery.match(LEADING_EMOJI_REGEXP)?.[0];

    if (leadingEmoji && emojis) {
      Object.values(emojis).forEach((emoji) => {
        // Some emojis have multiple skins and are represented as an Object with emojis for all skins.
        // For now, we select only the first emoji with 'neutral' skin.
        const displayedEmoji = 'id' in emoji ? emoji : emoji[1];
        if (displayedEmoji.native === leadingEmoji) {
          filteredEmojis.push(displayedEmoji.id);
        }
      });

      for (const set of allCustomEmojiSets) {
        const { stickers } = set;
        if (!stickers) {
          continue;
        }
        for (const sticker of stickers) {
          if (sticker.emoji === leadingEmoji) {
            filteredCustomEmojis.push(sticker);
          }
        }
      }
    } else if (emojis) {
      Object.values(emojis).forEach((emoji) => {
        // Some emojis have multiple skins and are represented as an Object with emojis for all skins.
        // For now, we select only the first emoji with 'neutral' skin.
        const displayedEmoji = 'id' in emoji ? emoji : emoji[1];
        if (displayedEmoji.names.some((emojiName) => emojiName.includes(searchQuery))) {
          filteredEmojis.push(displayedEmoji.id);
        }
      });
    }

    return {
      data: {
        id: FILTERED_SYMBOL_SET_ID,
        emojis: filteredEmojis,
        stickers: filteredCustomEmojis,
        accessHash: '',
        title: '',
        count: filteredEmojis.length + (filteredCustomEmojis?.length ?? 0),
        isEmoji: true,
      },
      type: EmojiSetType.Combined,
    };
  }, [searchQuery, allCustomEmojiSets, emojis]);

  const handleEmojiSelect = useLastCallback((emoji: string, name: string) => {
    onEmojiSelect(emoji, name);
  });

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    onCustomEmojiSelect(emoji);
  });

  const handleSearchQueryReset = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleSearchQueryChange = useDebouncedCallback((value: string) => {
    const newQuery = value.slice(0, MAX_EMOJI_QUERY_LENGTH);
    setSearchQuery(newQuery.toLowerCase());
  }, [], 300, true);

  const handleSelectStickerSet = useLastCallback((index: number) => {
    if (searchQuery) {
      handleSearchQueryReset();
      requestAnimationFrame(() => {
        selectStickerSet(index);
      });
      return;
    }
    selectStickerSet(index);
  });

  function renderCustomEmojiCover(stickerSet: StickerSetOrReactionsSetOrRecent, index: number) {
    const firstSticker = stickerSet.stickers?.[0];
    const buttonClassName = buildClassName(
      pickerStyles.stickerCover,
      index === activeSetIndex && styles.activated,
    );

    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;
    const isHq = selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSet as ApiStickerSet);

    if (stickerSet.id === TOP_SYMBOL_SET_ID) {
      return undefined;
    }

    if (STICKER_SET_IDS_WITH_COVER.has(stickerSet.id) || stickerSet.hasThumbnail || !firstSticker) {
      const isRecent = stickerSet.id === RECENT_SYMBOL_SET_ID || stickerSet.id === POPULAR_SYMBOL_SET_ID;
      const isFaded = FADED_BUTTON_SET_IDS.has(stickerSet.id);
      return (
        <Button
          key={stickerSet.id}
          className={buttonClassName}
          ariaLabel={stickerSet.title}
          round
          faded={isFaded}
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => handleSelectStickerSet(isRecent ? 0 : index)}
        >
          {isRecent ? (
            <Icon name="recent" />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              noPlay={!canAnimate || !canLoadAndPlay}
              forcePlayback
              observeIntersection={observeIntersectionForCovers}
              sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
            />
          )}
        </Button>
      );
    }

    return (
      <StickerButton
        key={stickerSet.id}
        sticker={firstSticker}
        size={STICKER_SIZE_PICKER_HEADER}
        title={stickerSet.title}
        className={buttonClassName}
        noPlay={!canAnimate || !canLoadAndPlay}
        observeIntersection={observeIntersectionForCovers}
        noContextMenu
        isCurrentUserPremium
        sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
        withTranslucentThumb={isTranslucent}
        onClick={handleSelectStickerSet}
        clickArg={index}
        forcePlayback
      />
    );
  }

  function renderSet(set: EmojiSet, i: number, allEmojis: AllEmojis) {
    switch (set.type) {
      case EmojiSetType.Emoji: {
        return (
          <EmojiCategory
            key={set.data.id}
            idPrefix={prefix}
            category={set.data}
            index={i}
            allEmojis={allEmojis}
            observeIntersection={observeIntersectionForSet}
            shouldRender={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
            onEmojiSelect={handleEmojiSelect}
          />
        );
      }
      case EmojiSetType.CustomEmoji: {
        const shouldHideHeader = set.data.id === TOP_SYMBOL_SET_ID
        || (set.data.id === RECENT_SYMBOL_SET_ID && (withDefaultTopicIcons || isStatusPicker));
        const isChatEmojiSet = set.data.id === chatEmojiSetId;

        return (
          <StickerSet
            key={set.data.id}
            stickerSet={set.data}
            loadAndPlay={Boolean(canAnimate && canLoadAndPlay)}
            index={i}
            idPrefix={prefix}
            observeIntersection={observeIntersectionForSet}
            observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
            observeIntersectionForShowingItems={observeIntersectionForShowingItems}
            isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
            isSavedMessages={isSavedMessages}
            isStatusPicker={isStatusPicker}
            isReactionPicker={isReactionPicker}
            shouldHideHeader={shouldHideHeader}
            withDefaultTopicIcon={withDefaultTopicIcons && set.data.id === RECENT_SYMBOL_SET_ID}
            withDefaultStatusIcon={isStatusPicker && set.data.id === RECENT_SYMBOL_SET_ID}
            isChatEmojiSet={isChatEmojiSet}
            isCurrentUserPremium={isCurrentUserPremium}
            selectedReactionIds={selectedReactionIds}
            availableReactions={availableReactions}
            isTranslucent={isTranslucent}
            onReactionSelect={onReactionSelect}
            onReactionContext={onReactionContext}
            onStickerSelect={handleCustomEmojiSelect}
            onContextMenuOpen={onContextMenuOpen}
            onContextMenuClose={onContextMenuClose}
            onContextMenuClick={onContextMenuClick}
            forcePlayback
          />
        );
      }
      case EmojiSetType.Combined: {
        const shouldHideHeader = set.data.id === TOP_SYMBOL_SET_ID
          || (set.data.id === RECENT_SYMBOL_SET_ID && (withDefaultTopicIcons || isStatusPicker));
        const isChatEmojiSet = set.data.id === chatEmojiSetId;

        return (
          <CombinedEmojiSet
            key={set.data.id}
            set={set.data}
            loadAndPlay={Boolean(canAnimate && canLoadAndPlay)}
            index={i}
            idPrefix={prefix}
            observeIntersection={observeIntersectionForSet}
            observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
            observeIntersectionForShowingItems={observeIntersectionForShowingItems}
            isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
            allEmojis={allEmojis}
            isSavedMessages={isSavedMessages}
            isStatusPicker={isStatusPicker}
            isReactionPicker={isReactionPicker}
            shouldHideHeader={shouldHideHeader}
            withDefaultTopicIcon={withDefaultTopicIcons && set.data.id === RECENT_SYMBOL_SET_ID}
            withDefaultStatusIcon={isStatusPicker && set.data.id === RECENT_SYMBOL_SET_ID}
            isChatEmojiSet={isChatEmojiSet}
            isCurrentUserPremium={isCurrentUserPremium}
            selectedReactionIds={selectedReactionIds}
            availableReactions={availableReactions}
            isTranslucent={isTranslucent}
            onReactionSelect={onReactionSelect}
            onReactionContext={onReactionContext}
            onEmojiSelect={handleEmojiSelect}
            onStickerSelect={handleCustomEmojiSelect}
            onContextMenuOpen={onContextMenuOpen}
            onContextMenuClose={onContextMenuClose}
            onContextMenuClick={onContextMenuClick}
            forcePlayback
          />
        );
      }
      default: {
        return undefined;
      }
    }
  }

  function renderNoResults() {
    return (
      <div className={styles.noResults}>
        {oldLang('NoResults')}
      </div>
    );
  }

  const fullClassName = buildClassName('CombinedEmojiPicker', styles.root, className);

  if (!shouldRenderContent) {
    return (
      <div className={fullClassName}>
        <Loading />
      </div>
    );
  }

  const headerClassName = buildClassName(
    styles.header,
    'no-scrollbar',
    !shouldHideTopBorder && styles.headerWithBorder,
  );

  const canvasContainerClassName = buildClassName(
    styles.sharedCanvasContainer,
    'shared-canvas-container',
  );

  const listClassName = buildClassName(
    pickerStyles.main,
    pickerStyles.main_customEmoji,
    IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
    pickerListClassName,
    pickerStyles.hasHeader,
  );

  return (
    <div className={fullClassName}>
      <div
        ref={headerRef}
        className={headerClassName}
      >
        <Button
          className={buildClassName(
            styles.symbolSetButton,
            activeSetIndex === 0 && styles.activated,
          )}
          ariaLabel={oldLang('RecentStickers')}
          round
          faded
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => handleSelectStickerSet(0)}
        >
          <Icon name="recent" />
        </Button>
        <EmojiCategoryCovers
          activeSetIndex={activeSetIndex}
          categoriesStartIndex={haveRecentEmojiSet ? 1 : 0}
          categories={categories}
          onSelectSet={handleSelectStickerSet}
        />
        <div className={canvasContainerClassName}>
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
          {allCustomEmojiSets.map(
            (set, index) => renderCustomEmojiCover(
              set, index + (haveRecentEmojiSet ? 1 : 0) + (categories?.length ?? 1),
            ),
          )}
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={handleContentScroll}
        className={listClassName}
      >
        <div
          className="search-input-container"
        >
          <SymbolSearch
            className="search"
            value={searchQuery}
            onChange={handleSearchQueryChange}
            onReset={handleSearchQueryReset}
            // placeholder={lang('SearchEmojisHint')} // There is no usable translation yet with "Search Emoji" in english
            placeholder="Search Emoji"
          />
        </div>
        {!searchQuery && allSets.map((set, i) => renderSet(set, i, emojis))}
        {searchQuery && filteredEmojiSet && renderSet(filteredEmojiSet, 0, emojis)}
        {searchQuery && !filteredEmojiSet && renderNoResults()}
      </div>
    </div>
  );
};

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
  }

  return emojiDataPromise;
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId, isStatusPicker, isReactionPicker }): StateProps => {
    const {
      stickers: {
        setsById: stickerSetsById,
      },
      customEmojis: {
        byId: customEmojisById,
        featuredIds: customEmojiFeaturedIds,
        statusRecent: {
          emojis: recentStatusEmojis,
        },
      },
      recentCustomEmojis: recentCustomEmojiIds,
      reactions: {
        availableReactions,
        recentReactions,
        topReactions,
        defaultTags,
      },
    } = global;

    const isSavedMessages = Boolean(chatId && selectIsChatWithSelf(global, chatId));
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;
    const collectibleStatuses = global.collectibleEmojiStatuses?.statuses;

    return {
      recentEmojis: global.recentEmojis,
      customEmojisById,
      recentCustomEmojiIds: !isStatusPicker ? recentCustomEmojiIds : undefined,
      recentStatusEmojis: isStatusPicker ? recentStatusEmojis : undefined,
      collectibleStatuses: isStatusPicker ? collectibleStatuses : undefined,
      stickerSetsById,
      addedCustomEmojiIds: global.customEmojis.added.setIds,
      canAnimate: selectCanPlayAnimatedEmojis(global),
      isSavedMessages,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      customEmojiFeaturedIds,
      defaultTopicIconsId: global.defaultTopicIconsId,
      defaultStatusIconsId: global.defaultStatusIconsId,
      topReactions: isReactionPicker ? topReactions : undefined,
      recentReactions: isReactionPicker ? recentReactions : undefined,
      chatEmojiSetId: chatFullInfo?.emojiSet?.id,
      isWithPaidReaction: isReactionPicker && chatFullInfo?.isPaidReactionAvailable,
      availableReactions: isReactionPicker ? availableReactions : undefined,
      defaultTagReactions: isReactionPicker ? defaultTags : undefined,
    };
  },
)(CombinedEmojiPicker));
