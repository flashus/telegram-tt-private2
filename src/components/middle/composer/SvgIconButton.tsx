import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';

import './SvgIconButton.scss';

type OwnProps = {
  iconName: IconName;
  focus?: boolean;
  onClick: (icon: IconName) => void;
};

const SvgIconButton: FC<OwnProps> = ({
  iconName, focus, onClick,
}) => {
  const handleClick = useLastCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    // Preventing safari from losing focus on Composer MessageInput
    e.preventDefault();

    onClick(iconName);
  });

  const className = buildClassName(
    'SvgIconButton',
    focus && 'focus',
  );

  return (
    <div
      className={className}
      onMouseDown={handleClick}
    >
      <Icon name={iconName} />
    </div>
  );
};

export default memo(SvgIconButton);
