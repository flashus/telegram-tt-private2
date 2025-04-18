import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import animateHorizontalScroll from '../../util/animateHorizontalScroll';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';

import useAppLayout from '../../hooks/useAppLayout';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';

import Button from '../ui/Button';
import Icon from './icons/Icon';

import styles from './EmojiCategoryCovers.module.scss';

interface OwnProps {
  activeSetIndex: number;
  categoriesStartIndex: number;
  categories: Pick<EmojiCategory, 'id' | 'name'>[] | undefined;
  onSelectSet: (index: number) => void;
}

const CATEGORY_BUTTON_WIDTH = 2 * REM; // Includes margins

const ICONS_BY_CATEGORY: Record<string, IconName> = {
  people: 'smile',
  nature: 'animals',
  foods: 'eats',
  activity: 'sport',
  places: 'car',
  objects: 'lamp',
  symbols: 'language',
  flags: 'flag',
};

const EmojiCategoryCovers: FC<OwnProps> = ({
  activeSetIndex,
  categoriesStartIndex,
  categories = [{ id: 'people', name: 'Emoji & People' }],
  onSelectSet,
}) => {
  // eslint-disable-next-line no-null/no-null
  const itemsRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useAppLayout();

  useHorizontalScroll(itemsRef, isMobile);

  const categoriesActive = activeSetIndex >= categoriesStartIndex
    && activeSetIndex < categoriesStartIndex + categories.length;

  function renderCategoryButton(category: Pick<EmojiCategory, 'id' | 'name'>, index: number) {
    const icon = ICONS_BY_CATEGORY[category.id];

    const buttonClassName = buildClassName(
      styles.symbolSetButton,
      categoriesActive && styles.smaller,
      index === activeSetIndex && styles.activated,
    );

    return icon && (
      <Button
        className={buttonClassName}
        round
        faded
        color="translucent"
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => onSelectSet(index)}
        ariaLabel={category.name}
      >
        <Icon name={icon} />
      </Button>
    );
  }

  // Scroll container and header when active set changes
  useEffect(() => {
    const items = itemsRef.current;
    if (!items || !categoriesActive) {
      return;
    }

    const effectiveActiveIndex = activeSetIndex - categoriesStartIndex;

    const newLeft = effectiveActiveIndex * CATEGORY_BUTTON_WIDTH - (items.offsetWidth / 2 - CATEGORY_BUTTON_WIDTH / 2);

    animateHorizontalScroll(items, newLeft);
  }, [activeSetIndex, categories, categoriesActive, categoriesStartIndex]);

  if (!categoriesActive) {
    return (
      <div className={styles.container}>
        <div ref={itemsRef} className={styles.items}>
          {renderCategoryButton(categories[0], categoriesStartIndex)}
        </div>
      </div>
    );
  }

  return (
    <div className={buildClassName(styles.container, styles.activated)}>
      <div ref={itemsRef} className={styles.items}>
        {categories.map((category, index) => {
          return renderCategoryButton(category, categoriesStartIndex + index);
        })}
      </div>
    </div>
  );
};

export default memo(EmojiCategoryCovers);
