import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiVideo } from '../../../api/types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { selectCurrentMessageList, selectIsChatWithSelf, selectTabState } from '../../../global/selectors';
import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import buildClassName from '../../../util/buildClassName';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import { REM } from '../../common/helpers/mediaDimensions';

import useDebouncedCallback from '../../../hooks/useDebouncedCallback';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useScrolledState from '../../../hooks/useScrolledState';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import GifButton from '../../common/GifButton';
import Icon from '../../common/icons/Icon';
import SymbolSearch, { type EmojiGroupIconName, MSG_EMOJI_GROUP_TO_SEARCH_MAPPING } from '../../common/SymbolSearch';
import GifSearch from '../../right/GifSearch';
import Button from '../../ui/Button';
import Loading from '../../ui/Loading';
import EmojiButton from './EmojiButton';

import styles from './GifPicker.module.scss';

type OwnProps = {
  className: string;
  loadAndPlay: boolean;
  canSendGifs?: boolean;
  onGifSelect?: (gif: ApiVideo, isSilent?: boolean, shouldSchedule?: boolean) => void;
};

type StateProps = {
  savedGifs?: ApiVideo[];
  isSavedMessages?: boolean;
  gifSearch: {
    query?: string;
    offset?: string;
    results?: ApiVideo[];
  };
};

const INTERSECTION_DEBOUNCE = 300;

const MAX_GIF_QUERY_LENGTH = 30;

const EMOJIS_AS_GIF_GROUP_COVERS: Emoji[] = [
  {
    id: '+1', names: Array(2), native: '👍', image: '1f44d',
  },
  {
    id: 'heart_eyes', names: Array(1), native: '😍', image: '1f60d',
  },
  {
    id: 'kissing_heart', names: Array(1), native: '😘', image: '1f618',
  },
  {
    id: 'rage', names: Array(1), native: '😡', image: '1f621',
  },
  {
    id: 'partying_face', names: Array(1), native: '🥳', image: '1f973',
  },
  {
    id: 'joy', names: Array(1), native: '😂', image: '1f602',
  },
  {
    id: 'open_mouth', names: Array(1), native: '😮', image: '1f62e',
  },
  {
    id: 'face_with_rolling_eyes', names: Array(1), native: '🙄', image: '1f644',
  },
  {
    id: 'sunglasses', names: Array(1), native: '😎', image: '1f60e',
  },
  {
    id: '-1', names: Array(2), native: '👎', image: '1f44e',
  },
];

const HEADER_BUTTON_WIDTH = 2.5 * REM; // px (including margin)

const GifPicker: FC<OwnProps & StateProps> = ({
  className,
  loadAndPlay,
  canSendGifs,
  savedGifs,
  isSavedMessages,
  gifSearch,
  onGifSelect,
}) => {
  const { loadSavedGifs, saveGif, setGifSearchQuery } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);

  const [groupSearchQueryKey, setGroupSearchQueryKey] = useState<EmojiGroupIconName | undefined>();
  const [activeSetIndex, setActiveSetIndex] = useState<number>(0);

  const lang = useOldLang();

  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, debounceMs: INTERSECTION_DEBOUNCE });

  useEffect(() => {
    if (loadAndPlay) {
      loadSavedGifs();
    }
  }, [loadAndPlay, loadSavedGifs]);

  const handleUnsaveClick = useLastCallback((gif: ApiVideo) => {
    saveGif({ gif, shouldUnsave: true });
  });

  const handleSearchReset = useLastCallback(() => {
    setActiveSetIndex(0);
    setGroupSearchQueryKey(undefined);
    setGifSearchQuery({});
  });

  const handleSearchQueryChange = useDebouncedCallback((value: string) => {
    const newQuery = value.slice(0, MAX_GIF_QUERY_LENGTH);
    const lowercaseQuery = newQuery.toLowerCase();
    setGroupSearchQueryKey(undefined);
    setGifSearchQuery({ query: lowercaseQuery });
  }, [], 300, true);

  const handleGroupSearchQueryChange = useLastCallback((value: EmojiGroupIconName) => {
    setGroupSearchQueryKey(value);
    setGifSearchQuery({ query: MSG_EMOJI_GROUP_TO_SEARCH_MAPPING[value] });
  });

  const handleSelectRecent = useLastCallback(() => {
    handleSearchReset();
  });

  const handleSelectGifSetByEmojiCover = useLastCallback((native: string, id: string) => {
    const addRecentIndex = Number(savedGifs && savedGifs.length);
    setActiveSetIndex(EMOJIS_AS_GIF_GROUP_COVERS.findIndex((emoji) => emoji.native === native) + addRecentIndex);
    // Use 'native' instead??
    setGifSearchQuery({ query: id });
  });

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);

  useHorizontalScroll(headerRef, !canRenderContents || !headerRef.current);

  // Scroll container and header when active set changes
  useEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    // Just leave this 8 here for now
    const newLeft = (activeSetIndex - 8) * HEADER_BUTTON_WIDTH - (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

    animateHorizontalScroll(header, newLeft);
  }, [activeSetIndex]);

  function renderContents() {
    return (
      <div className={styles.gifItems}>
        {!canSendGifs ? (
          <div className={styles.pickerDisabled}>Sending GIFs is not allowed in this chat.</div>
        ) : canRenderContents && savedGifs && savedGifs.length && activeSetIndex === 0 ? (
          savedGifs.map((gif) => (
            <GifButton
              key={gif.id}
              gif={gif}
              observeIntersection={observeIntersection}
              isDisabled={!loadAndPlay}
              onClick={canSendGifs ? onGifSelect : undefined}
              onUnsaveClick={handleUnsaveClick}
              isSavedMessages={isSavedMessages}
            />
          ))
        ) : canRenderContents && savedGifs ? (
          <div className={styles.pickerDisabled}>No saved GIFs.</div>
        ) : (
          <Loading />
        )}
      </div>
    );
  }

  const fullClassName = buildClassName(styles.root, className);

  const mainClassName = buildClassName(
    styles.main,
    'gif-picker',
    'main', // is needed in SymbolMenu for querySelector
    IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
    styles.hasHeader,
  );

  const headerClassName = buildClassName(
    styles.header,
    'no-scrollbar',
    !shouldHideTopBorder && styles.headerWithBorder,
  );

  return (
    <div className={fullClassName}>
      <div ref={headerRef} className={headerClassName}>
        <div className="shared-canvas-container">
          {savedGifs && savedGifs.length > 0 && (
            <Button
              className={buildClassName(
                styles.symbolSetButton,
                activeSetIndex === 0 && styles.activated,
              )}
              ariaLabel={lang('RecentGifs')}
              round
              faded
              color="translucent"
              onClick={handleSelectRecent}
            >
              <Icon name="recent" />
            </Button>
          )}
          {EMOJIS_AS_GIF_GROUP_COVERS.map((emoji, index) => (
            <EmojiButton
              key={emoji.id}
              emoji={emoji}
              focus={activeSetIndex === index + Number(savedGifs && savedGifs.length)}
              onClick={handleSelectGifSetByEmojiCover}
            />
          ))}
        </div>
      </div>
      <div
        ref={containerRef}
        className={mainClassName}
        onScroll={handleContentScroll}
      >
        {canSendGifs && (
          <div className={styles.searchContainer}>
            <SymbolSearch
              className="search"
              value={!groupSearchQueryKey && activeSetIndex === 0 ? gifSearch.query : ''}
              groupValue={groupSearchQueryKey}
              onChange={handleSearchQueryChange}
              onGroupValueChange={handleGroupSearchQueryChange}
              onReset={handleSearchReset}
              placeholder={lang('SearchGifsTitle')}
            />
          </div>
        )}
        {canRenderContents && gifSearch.query ? (
          <GifSearch className={styles.gifItems} />
        ) : renderContents()}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const isSavedMessages = Boolean(chatId) && selectIsChatWithSelf(global, chatId);

    const tabState = selectTabState(global, getCurrentTabId());

    return {
      savedGifs: global.gifs.saved.gifs,
      isSavedMessages,
      gifSearch: tabState.gifSearch,
    };
  },
)(GifPicker));
