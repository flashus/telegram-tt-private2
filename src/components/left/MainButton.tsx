import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';

import { APP_NAME, DEBUG, IS_BETA } from '../../config';
import buildClassName from '../../util/buildClassName';
import { IS_ELECTRON, IS_MAC_OS } from '../../util/windowEnvironment';

import useAppLayout from '../../hooks/useAppLayout';
import useFlag from '../../hooks/useFlag';
import useOldLang from '../../hooks/useOldLang';
import { useFullscreenStatus } from '../../hooks/window/useFullscreen';
import useLeftHeaderButtonRtlForumTransition from './main/hooks/useLeftHeaderButtonRtlForumTransition';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import LeftSideMenuItems from './main/LeftSideMenuItems';

import './MainButton.scss';

type OwnProps = {
  round?: boolean;
  hasMenu?: boolean;
  shouldHideSearch?: boolean;
  shouldSkipTransition?: boolean;
  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
  onReset?: NoneToVoidFunction;
};

type StateProps = {
};

const MainButton: FC<OwnProps & StateProps> = ({
  round,
  hasMenu,
  shouldHideSearch,
  shouldSkipTransition,
  onSelectSettings,
  onSelectContacts,
  onSelectArchived,
  onReset,
}) => {
  const { isMobile } = useAppLayout();

  const oldLang = useOldLang();

  const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();

  const MainButtonElement: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round={round}
        ripple={hasMenu && !isMobile}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={hasMenu ? onTrigger : () => onReset && onReset()}
        ariaLabel={hasMenu ? oldLang('AccDescrOpenMenu2') : 'Return to chat list'}
      >
        <div className={buildClassName(
          'animated-menu-icon',
          !hasMenu && 'state-back',
          shouldSkipTransition && 'no-animation',
        )}
        />
      </Button>
    );
  }, [round, hasMenu, isMobile, oldLang, onReset, shouldSkipTransition]);

  const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);

  const isFullscreen = useFullscreenStatus();

  // Disable dropdown menu RTL animation for resize
  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(shouldHideSearch);

  return (
    <DropdownMenu
      trigger={MainButtonElement}
      footer={`${APP_NAME} ${versionString}`}
      className={buildClassName(
        'main-menu',
        oldLang.isRtl && 'rtl',
        shouldHideSearch && oldLang.isRtl && 'right-aligned',
        shouldDisableDropdownMenuTransitionRef.current && oldLang.isRtl && 'disable-transition',
      )}
      forceOpen={isBotMenuOpen}
      positionX={shouldHideSearch && oldLang.isRtl ? 'right' : 'left'}
      transformOriginX={IS_ELECTRON && IS_MAC_OS && !isFullscreen ? 90 : undefined}
      onTransitionEnd={oldLang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
    >
      <LeftSideMenuItems
        onSelectArchived={onSelectArchived}
        onSelectContacts={onSelectContacts}
        onSelectSettings={onSelectSettings}
        onBotMenuOpened={markBotMenuOpen}
        onBotMenuClosed={unmarkBotMenuOpen}
      />
    </DropdownMenu>
  );
};

export default memo(MainButton);
