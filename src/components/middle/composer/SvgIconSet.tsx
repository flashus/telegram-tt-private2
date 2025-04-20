import type { FC } from '../../../lib/teact/teact';
import React, { memo, useRef } from '../../../lib/teact/teact';

import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { IconName } from '../../../types/icons';

import { EMOJI_SIZE_PICKER } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import windowSize from '../../../util/windowSize';
import { REM } from '../../common/helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import { useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useMediaTransitionDeprecated from '../../../hooks/useMediaTransitionDeprecated';
import useOldLang from '../../../hooks/useOldLang';

import SvgIconButton from './SvgIconButton';

export type TSvgIconSet = {
  id: string;
  name: string;
  icons: IconName[];
};

const ICONS_PER_ROW_ON_DESKTOP = 8;
const ICON_MARGIN = 0.625 * REM;
const ICON_VERTICAL_MARGIN = 0.25 * REM;
const ICON_VERTICAL_MARGIN_MOBILE = 0.5 * REM;
const MOBILE_CONTAINER_PADDING = 0.5 * REM;

const DEFAULT_ID_PREFIX = 'svg-icon-set';

type OwnProps = {
  idPrefix?: string;
  set: TSvgIconSet;
  index: number;
  observeIntersection: ObserveFn;
  shouldRender: boolean;
  onSvgIconSelect: (icon: IconName) => void;
};

const SvgIconSet: FC<OwnProps> = ({
  idPrefix = DEFAULT_ID_PREFIX,
  set,
  index,
  observeIntersection,
  shouldRender,
  onSvgIconSelect,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  useOnIntersect(ref, observeIntersection);

  const transitionClassNames = useMediaTransitionDeprecated(shouldRender);

  const lang = useOldLang();
  const { isMobile } = useAppLayout();

  const iconsPerRow = isMobile
    ? Math.floor(
      (windowSize.get().width - MOBILE_CONTAINER_PADDING + ICON_MARGIN) / (EMOJI_SIZE_PICKER + ICON_MARGIN),
    )
    : ICONS_PER_ROW_ON_DESKTOP;
  const height = Math.ceil(set.icons.length / iconsPerRow)
    * (EMOJI_SIZE_PICKER + (isMobile ? ICON_VERTICAL_MARGIN_MOBILE : ICON_VERTICAL_MARGIN));

  return (
    <div
      ref={ref}
      key={set.id}
      id={`${idPrefix}-${index}`}
      className="symbol-set"
    >
      <div
        className={buildClassName('symbol-set-container', transitionClassNames)}
        style={`height: ${height}px;`}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {shouldRender && set.icons.map((iconName) => (
          <SvgIconButton
            key={iconName}
            iconName={iconName}
            onClick={onSvgIconSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(SvgIconSet);
