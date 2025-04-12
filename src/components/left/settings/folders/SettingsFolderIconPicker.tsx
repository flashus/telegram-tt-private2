import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../../../global';

import type {
  ApiSticker, ApiStickerSet,
} from '../../../../api/types';
import type { StickerSetOrReactionsSetOrRecent } from '../../../../types';
import type { IconName } from '../../../../types/icons';
import type { EmojiData, EmojiModule, EmojiRawData } from '../../../../util/emoji/emoji';

import {
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
  STICKER_PICKER_MAX_SHARED_COVERS,
  STICKER_SIZE_PICKER_HEADER,
  TOP_SYMBOL_SET_ID,
} from '../../../../config';
import {
  selectCanPlayAnimatedEmojis,
  selectChatFullInfo,
  selectIsAlwaysHighPriorityEmoji,
  selectIsCurrentUserPremium,
} from '../../../../global/selectors';
import animateHorizontalScroll from '../../../../util/animateHorizontalScroll';
import buildClassName from '../../../../util/buildClassName';
import { EMOTICON_TO_ICON_NAME_MAP } from '../../../../util/chatFolder';
import { uncompressEmoji } from '../../../../util/emoji/emoji';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { IS_TOUCH_ENV } from '../../../../util/windowEnvironment';
import { REM } from '../../../common/helpers/mediaDimensions';

import useAppLayout from '../../../../hooks/useAppLayout';
import useDebouncedCallback from '../../../../hooks/useDebouncedCallback';
import useHorizontalScroll from '../../../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';
import usePrevDuringAnimation from '../../../../hooks/usePrevDuringAnimation';
import useScrolledState from '../../../../hooks/useScrolledState';
import useAllCustomEmojiSets from '../../../common/hooks/useAllCustomEmojiSets';
import { useStickerPickerObservers } from '../../../common/hooks/useStickerPickerObservers';
import useAsyncRendering from '../../../right/hooks/useAsyncRendering';

import Icon from '../../../common/icons/Icon';
import StickerButton from '../../../common/StickerButton';
import StickerSet from '../../../common/StickerSet';
import EmojiCategory from '../../../middle/composer/EmojiCategory';
import StickerSetCover from '../../../middle/composer/StickerSetCover';
import SvgIconButton from '../../../middle/composer/SvgIconButton';
import Button from '../../../ui/Button';
import Loading from '../../../ui/Loading';
import SearchInput from '../../../ui/SearchInput';

import './SettingsFolderIconPicker.scss';
import styles from '../../../common/CustomEmojiPicker.module.scss';
import pickerStyles from '../../../middle/composer/StickerPicker.module.scss';

type OwnProps = {
  chatId?: string;
  className?: string;
  pickerListClassName?: string;
  idPrefix?: string;
  isHidden?: boolean;
  loadAndPlay: boolean;
  onSvgIconSelect: (svgIcon: IconName) => void;
  onEmojiSelect: (emoji: string, name: string) => void;
  onCustomEmojiSelect: (sticker: ApiSticker) => void;
};

type StateProps = {
  recentEmojis?: string[];
  chatEmojiSetId?: string;
  stickerSetsById: Record<string, ApiStickerSet>;
  addedCustomEmojiIds?: string[];
  customEmojiFeaturedIds?: string[];
  canAnimate?: boolean;
  isCurrentUserPremium?: boolean;
};

type EmojiCategoryData = { id: string; name: string; emojis: string[] };

type FilteredEmojiCategoryDataWithIndex = {
  data: EmojiCategoryData;
  index: number;
};

type FilteredCustomEmojiSetDataWithIndex = {
  set: ApiStickerSet | StickerSetOrReactionsSetOrRecent;
  index: number;
};

const OPEN_ANIMATION_DELAY = 200;
const HEADER_BUTTON_WIDTH = 2.625 * REM; // Includes margins
const INTERSECTION_THROTTLE = 200;
const MAX_EMOJI_QUERY_LENGTH = 10;
const ERROR_SHOWN_TIME = 2000;

const DEFAULT_ID_PREFIX = 'custom-emoji-set';
const FADED_BUTTON_SET_IDS = new Set([RECENT_SYMBOL_SET_ID, FAVORITE_SYMBOL_SET_ID, POPULAR_SYMBOL_SET_ID]);
const STICKER_SET_IDS_WITH_COVER = new Set([
  RECENT_SYMBOL_SET_ID,
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
]);

const SVG_ICONS_CATEGORY = {
  id: 'icons',
  name: 'Icons',
  icons: Object.values(EMOTICON_TO_ICON_NAME_MAP),
};

enum ChatFolderIconMetaCategory {
  EmojiOrSvgIcon,
  CustomEmoji,
}

const categoryIntersections: boolean[] = [];

let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

const SettingsFolderIconPicker: FC<OwnProps & StateProps> = ({
  className,
  pickerListClassName,
  isHidden,
  loadAndPlay,
  addedCustomEmojiIds,
  stickerSetsById,
  chatEmojiSetId,
  recentEmojis,
  idPrefix = DEFAULT_ID_PREFIX,
  customEmojiFeaturedIds,
  canAnimate,
  isCurrentUserPremium,
  onSvgIconSelect,
  onEmojiSelect,
  onCustomEmojiSelect,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);

  const [metaCategory, setMetaCategory] = useState<ChatFolderIconMetaCategory>(
    ChatFolderIconMetaCategory.EmojiOrSvgIcon,
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [searchQueryError, setSearchQueryError] = useState('');

  const [categories, setCategories] = useState<EmojiCategoryData[]>();
  const [emojis, setEmojis] = useState<AllEmojis>();
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const { isMobile } = useAppLayout();
  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  const { observe: observeIntersection } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  }, (entries) => {
    entries.forEach((entry) => {
      const { id } = entry.target as HTMLDivElement;
      if (!id || !id.startsWith('emoji-category-')) {
        return;
      }

      const index = Number(id.replace('emoji-category-', ''));
      categoryIntersections[index] = entry.isIntersecting;
    });

    const minIntersectingIndex = categoryIntersections.reduce((lowestIndex, isIntersecting, index) => {
      return isIntersecting && index < lowestIndex ? index : lowestIndex;
    }, Infinity);

    if (minIntersectingIndex === Infinity) {
      return;
    }

    setActiveCategoryIndex(minIntersectingIndex);
  });

  const prefix = `${idPrefix}-custom-emoji`;
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden);

  const canLoadAndPlay = usePrevDuringAnimation(loadAndPlay || undefined, SLIDE_TRANSITION_DURATION);

  const lang = useOldLang();

  const areAddedLoaded = Boolean(addedCustomEmojiIds);

  const { allSets: allCustomEmojiSets } = useAllCustomEmojiSets({
    addedCustomEmojiIds,
    customEmojiFeaturedIds,
    stickerSetsById,
    chatEmojiSetId,
    isReactionPicker: false,
    isStatusPicker: false,
    isSavedMessages: false,
    isWithPaidReaction: false,
  });

  const allCategories = useMemo(() => {
    if (!categories) {
      return MEMO_EMPTY_ARRAY;
    }
    const themeCategories = [...categories];
    if (recentEmojis?.length) {
      themeCategories.unshift({
        id: RECENT_SYMBOL_SET_ID,
        name: lang('RecentStickers'),
        emojis: recentEmojis,
      });
    }

    return themeCategories;
  }, [categories, lang, recentEmojis]);

  const filteredCategories: FilteredEmojiCategoryDataWithIndex[] = useMemo(() => {
    if (metaCategory !== ChatFolderIconMetaCategory.EmojiOrSvgIcon) {
      // return [];
      return allCategories.map((category, index) => ({ data: category, index: index + 1 }));
    }
    if (!searchQuery || !emojis) {
      return allCategories.map((category, index) => ({ data: category, index: index + 1 }));
    }

    return allCategories.map((category, index) => ({
      data: {
        ...category,
        emojis: category.emojis.filter((name) => {
          const emoji = emojis[name];
          // Recent emojis may contain emoticons that are no longer in the list
          if (!emoji) {
            return false;
          }
          // Some emojis have multiple skins and are represented as an Object with emojis for all skins.
          // For now, we select only the first emoji with 'neutral' skin.
          const displayedEmoji = 'id' in emoji ? emoji : emoji[1];
          return displayedEmoji.names.some((emojiName) => emojiName.includes(searchQuery));
        }),
      },
      // Index + 1 cause 'recent' emojis were cut to strictly follow design mockups
      index: index + 1,
    })).filter((category) => category.data.emojis.length > 0);
  }, [allCategories, emojis, metaCategory, searchQuery]);

  const filteredCustomEmojiSets: FilteredCustomEmojiSetDataWithIndex[] = useMemo(() => {
    if (metaCategory !== ChatFolderIconMetaCategory.CustomEmoji) {
      // return [];
      return allCustomEmojiSets.map((set, index) => ({ set, index: index + 1 }));
    }
    if (!searchQuery || !emojis) {
      return allCustomEmojiSets.map((set, index) => ({ set, index: index + 1 }));
    }

    return allCustomEmojiSets.map((set, index) => ({ set, index: index + 1 })).filter((set) => {
      return set.set.title.toLowerCase().includes(searchQuery);
    });
  }, [allCustomEmojiSets, emojis, metaCategory, searchQuery]);

  useEffect(() => {
    if (metaCategory !== ChatFolderIconMetaCategory.CustomEmoji) {
      return;
    }

    if (!filteredCustomEmojiSets.some(({ set, index }) => index === activeSetIndex && set.stickers?.length)) {
      selectStickerSet(filteredCustomEmojiSets[0]?.index ?? 0);
    }
  }, [activeSetIndex, filteredCustomEmojiSets, metaCategory, selectStickerSet]);

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

    const newLeft = activeSetIndex * HEADER_BUTTON_WIDTH - (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

    animateHorizontalScroll(header, newLeft);
  }, [areAddedLoaded, activeSetIndex]);

  const noPopulatedSets = useMemo(() => (
    areAddedLoaded
    && allCustomEmojiSets.filter((set) => set.stickers?.length).length === 0
  ), [allCustomEmojiSets, areAddedLoaded]);

  const canRenderContent = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
  const shouldRenderContent = areAddedLoaded && canRenderContent && !noPopulatedSets && emojis;

  useHorizontalScroll(headerRef, isMobile || !shouldRenderContent);

  const handleSearchInputReset = useCallback(() => {
    setSearchQueryError('');
    setSearchQuery('');
  }, []);

  const handleSvgIconSelect = useLastCallback((icon: IconName) => {
    handleSearchInputReset();
    onSvgIconSelect(icon);
  });

  const handleEmojiSelect = useLastCallback((emoji: string, name: string) => {
    handleSearchInputReset();
    onEmojiSelect(emoji, name);
  });

  const handleStickerSetSelect = useLastCallback((index: number) => {
    setMetaCategory(ChatFolderIconMetaCategory.CustomEmoji);
    selectStickerSet(index);
  });

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    handleSearchInputReset();
    onCustomEmojiSelect(emoji);
  });

  const handleSearchQueryChange = useDebouncedCallback((value: string) => {
    // Limit the search query by MAX_EMOJI_QUERY_LENGTH
    if (value.length > MAX_EMOJI_QUERY_LENGTH) {
      setSearchQueryError('Too many characters');
      setTimeout(() => setSearchQueryError(''), ERROR_SHOWN_TIME);
    }
    const newQuery = value.slice(0, MAX_EMOJI_QUERY_LENGTH);
    setSearchQuery(newQuery.toLowerCase());
  }, [], 300, true);

  function renderEmojiCover() {
    const buttonClassName = buildClassName(
      pickerStyles.stickerCover,
      metaCategory === ChatFolderIconMetaCategory.EmojiOrSvgIcon && styles.activated,
    );

    return (
      <Button
        // className={`symbol-set-button ${metaCategory === ChatFolderIconMetaCategory.EmojiOrSvgIcon ? 'activated' : ''}`}
        className={buttonClassName}
        round
        faded
        color="translucent"
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => setMetaCategory(ChatFolderIconMetaCategory.EmojiOrSvgIcon)} // set smilys and svg icons as rendered
        ariaLabel="Emojis and svg icons"
      >
        <Icon name="smile" />
      </Button>
    );
  }

  function renderCustomEmojiCover(filteredSet: FilteredCustomEmojiSetDataWithIndex) {
    const { set, index } = filteredSet;
    const firstSticker = set.stickers?.[0];
    const buttonClassName = buildClassName(
      pickerStyles.stickerCover,
      index === activeSetIndex && styles.activated,
    );

    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;
    const isHq = selectIsAlwaysHighPriorityEmoji(getGlobal(), set as ApiStickerSet);

    if (set.id === TOP_SYMBOL_SET_ID) {
      return undefined;
    }

    if (STICKER_SET_IDS_WITH_COVER.has(set.id) || set.hasThumbnail || !firstSticker) {
      const isRecent = set.id === RECENT_SYMBOL_SET_ID || set.id === POPULAR_SYMBOL_SET_ID;
      const isFaded = FADED_BUTTON_SET_IDS.has(set.id);
      return (
        <Button
          key={set.id}
          className={buttonClassName}
          ariaLabel={set.title}
          round
          faded={isFaded}
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => handleStickerSetSelect(isRecent ? 0 : index)}
        >
          {isRecent ? (
            <Icon name="recent" />
          ) : (
            <StickerSetCover
              stickerSet={set as ApiStickerSet}
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
        key={set.id}
        sticker={firstSticker}
        size={STICKER_SIZE_PICKER_HEADER}
        title={set.title}
        className={buttonClassName}
        noPlay={!canAnimate || !canLoadAndPlay}
        observeIntersection={observeIntersectionForCovers}
        noContextMenu
        isCurrentUserPremium
        sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
        withTranslucentThumb
        onClick={handleStickerSetSelect}
        clickArg={index}
        forcePlayback
      />
    );
  }

  const fullClassName = buildClassName('SettingsFolderIconPicker', styles.root, className);

  if (!shouldRenderContent) {
    return (
      <div className={fullClassName}>
        {noPopulatedSets ? (
          <div className={pickerStyles.pickerDisabled}>{lang('NoStickers')}</div>
        ) : (
          <Loading />
        )}
      </div>
    );
  }

  const headerClassName = buildClassName(
    pickerStyles.header,
    'no-scrollbar',
    !shouldHideTopBorder && pickerStyles.headerWithBorder,
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
        <div className="shared-canvas-container">
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
          {renderEmojiCover()}
          {filteredCustomEmojiSets.map(renderCustomEmojiCover)}
        </div>
      </div>
      <div
        className="search-input-container"
      >
        <SearchInput
          className={styles.search}
          value={searchQuery}
          onChange={handleSearchQueryChange}
          onReset={handleSearchInputReset}
          // placeholder={lang('SearchEmojisHint')}
          placeholder="Search Emoji"
        />
        {/* {searchQueryError && ( */}
        <div className={buildClassName('search-input-container__error', searchQueryError && 'shown')}>
          {searchQueryError}
        </div>
        {/* )} */}
      </div>
      <div
        ref={containerRef}
        onScroll={handleContentScroll}
        className={listClassName}
      >
        {metaCategory === ChatFolderIconMetaCategory.EmojiOrSvgIcon && (
          <div className="symbol-set">
            <div className="symbol-set-container">
              {SVG_ICONS_CATEGORY.icons.map((iconName) => (
                <SvgIconButton
                  key={iconName}
                  iconName={iconName}
                  onClick={handleSvgIconSelect}
                />
              ))}
            </div>
          </div>
        )}
        {metaCategory === ChatFolderIconMetaCategory.EmojiOrSvgIcon
          && filteredCategories.map((indexedCategory) => (
            <EmojiCategory
              category={indexedCategory.data}
              index={indexedCategory.index}
              allEmojis={emojis}
              observeIntersection={observeIntersection}
              shouldRender={
                (activeCategoryIndex >= indexedCategory.index - 1
                && activeCategoryIndex <= indexedCategory.index + 1)
                || filteredCategories.length < allCategories.length
              }
              onEmojiSelect={handleEmojiSelect}
            />
          ))}
        {metaCategory === ChatFolderIconMetaCategory.CustomEmoji && filteredCustomEmojiSets.map(
          ({ set: stickerSet, index: i }) => {
            const shouldHideHeader = stickerSet.id === TOP_SYMBOL_SET_ID
              || (stickerSet.id === RECENT_SYMBOL_SET_ID);
            const isChatEmojiSet = stickerSet.id === chatEmojiSetId;

            return (
              <StickerSet
                key={stickerSet.id}
                stickerSet={stickerSet}
                loadAndPlay={Boolean(canAnimate && canLoadAndPlay)}
                index={i}
                idPrefix={prefix}
                observeIntersection={observeIntersectionForSet}
                observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
                observeIntersectionForShowingItems={observeIntersectionForShowingItems}
                isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
                isSavedMessages={false}
                isStatusPicker={false}
                isReactionPicker={false}
                shouldHideHeader={shouldHideHeader}
                withDefaultTopicIcon={false && stickerSet.id === RECENT_SYMBOL_SET_ID}
                withDefaultStatusIcon={false && stickerSet.id === RECENT_SYMBOL_SET_ID}
                isChatEmojiSet={isChatEmojiSet}
                isCurrentUserPremium={isCurrentUserPremium}
                selectedReactionIds={undefined}
                availableReactions={undefined}
                isTranslucent
                onStickerSelect={handleCustomEmojiSelect}
                forcePlayback
              />
            );
          },
        )}
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
  (global, { chatId }): StateProps => {
    const {
      stickers: {
        setsById: stickerSetsById,
      },
      customEmojis: {
        featuredIds: customEmojiFeaturedIds,
      },
    } = global;

    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;

    return {
      stickerSetsById,
      addedCustomEmojiIds: global.customEmojis.added.setIds,
      canAnimate: selectCanPlayAnimatedEmojis(global),
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      customEmojiFeaturedIds,
      chatEmojiSetId: chatFullInfo?.emojiSet?.id,
    };
  },
)(SettingsFolderIconPicker));
