import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import buildClassName from '../../util/buildClassName';

import Button from '../ui/Button';
import Icon from './icons/Icon';

import styles from './EmojiCategoryCovers.module.scss';

interface OwnProps {
  activeSetIndex: number;
  categoriesStartIndex: number;
  categories: Pick<EmojiCategory, 'id' | 'name'>[] | undefined;
  onSelectSet: (index: number) => void;
}

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
  function renderCategoryButton(category: Pick<EmojiCategory, 'id' | 'name'>, index: number) {
    const icon = ICONS_BY_CATEGORY[category.id];

    const buttonClassName = buildClassName(
      styles.symbolSetButton,
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

  const categoriesActive = activeSetIndex >= categoriesStartIndex
    && activeSetIndex < categoriesStartIndex + categories.length;

  const containerClassName = buildClassName(
    styles.container,
  );

  if (!categoriesActive) {
    return (
      <div className={containerClassName}>
        {renderCategoryButton(categories[0], categoriesStartIndex)}
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {categories.map((category, index) => {
        return renderCategoryButton(category, categoriesStartIndex + index);
      })}
    </div>
  );
};

export default memo(EmojiCategoryCovers);
