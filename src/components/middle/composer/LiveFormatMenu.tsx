import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { LiveFormatMode } from '../../../types';

import buildClassName from '../../../util/buildClassName';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useMouseInside from '../../../hooks/useMouseInside';

import Icon from '../../common/icons/Icon';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import ResponsiveHoverButton from '../../ui/ResponsiveHoverButton';
import Switcher from '../../ui/Switcher';

import './LiveFormatMenu.scss';

export type OwnProps = {
  isButtonVisible: boolean;
  liveFormatMode: LiveFormatMode;
  keepMarkerWidth: boolean;
  forceMenuClose?: boolean;
  onMenuOpen: NoneToVoidFunction;
  onMenuClose: NoneToVoidFunction;
};

const LiveFormatMenu: FC<OwnProps> = ({
  isButtonVisible,
  liveFormatMode,
  keepMarkerWidth,
  forceMenuClose,
  onMenuOpen,
  onMenuClose,
}) => {
  const {
    setLiveFormatSettings,
  } = getActions();

  const [isLiveFormatMenuOpen, openLiveFormatMenu, closeLiveFormatMenu] = useFlag();
  const [handleMouseEnter, handleMouseLeave, markMouseInside] = useMouseInside(
    isLiveFormatMenuOpen, closeLiveFormatMenu,
  );

  const isMenuOpen = isLiveFormatMenuOpen;

  useEffect(() => {
    if (isLiveFormatMenuOpen) {
      markMouseInside();
    }
  }, [isLiveFormatMenuOpen, markMouseInside]);

  useEffect(() => {
    if (isMenuOpen) {
      onMenuOpen();
    } else {
      onMenuClose();
    }
  }, [isMenuOpen, onMenuClose, onMenuOpen]);

  // Workaround to prevent forwarding refs
  useEffect(() => {
    if (forceMenuClose && isLiveFormatMenuOpen) {
      closeLiveFormatMenu();
    }
  }, [forceMenuClose, isLiveFormatMenuOpen]);

  const handleToggleLiveFormatMenu = useLastCallback(() => {
    if (isLiveFormatMenuOpen) {
      closeLiveFormatMenu();
    } else {
      openLiveFormatMenu();
    }
  });

  const handleLiveFormatOn = useLastCallback(() => {
    setLiveFormatSettings({ mode: 'on' });
  });

  const handleLiveFormatCombo = useLastCallback(() => {
    setLiveFormatSettings({ mode: 'combo' });
  });

  const handleLiveFormatOff = useLastCallback(() => {
    setLiveFormatSettings({ mode: 'off' });
  });

  const handleKeepMarkerWidthChange = useLastCallback(() => {
    setLiveFormatSettings({ keepMarkerWidth: !keepMarkerWidth });
  });

  if (!isButtonVisible) {
    return undefined;
  }

  return (
    <div className="LiveFormatMenu">
      <ResponsiveHoverButton
        id="replace-menu-button"
        className={buildClassName('LiveFormatMenu--button composer-action-button', isLiveFormatMenuOpen && 'activated')}
        round
        color="translucent"
        onActivate={handleToggleLiveFormatMenu}
        ariaLabel="Live format options"
        ariaControls="replace-menu-controls"
        hasPopup
      >
        <Icon name="settings" />
      </ResponsiveHoverButton>
      <Menu
        id="live-format-menu-controls"
        isOpen={isMenuOpen}
        autoClose
        positionX="right"
        positionY="bottom"
        onClose={closeLiveFormatMenu}
        className="LiveFormatMenu--menu fluid"
        onCloseAnimationEnd={closeLiveFormatMenu}
        onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
        onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
        noCloseOnBackdrop={!IS_TOUCH_ENV}
        ariaLabelledBy="live-format-menu-button"
      >
        <MenuItem
          icon="check"
          className={buildClassName('LiveFormatMenu--menu--item', liveFormatMode === 'on' && 'active')}
          onClick={handleLiveFormatOn}
        >
          On {/* lang('SettingsLiveFormatOn') */}
        </MenuItem>
        <MenuItem
          icon="keyboard"
          className={buildClassName('LiveFormatMenu--menu--item', liveFormatMode === 'combo' && 'active')}
          onClick={handleLiveFormatCombo}
        >
          Combo (cmd + alt + f) {/* lang('SettingsLiveFormatCombo') */}
        </MenuItem>
        <MenuItem
          icon="close"
          className={buildClassName('LiveFormatMenu--menu--item', liveFormatMode === 'off' && 'active')}
          onClick={handleLiveFormatOff}
        >
          Off {/* lang('SettingsLiveFormatOff') */}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          customIcon={(
            <Switcher
              id="live-format-keep-marker-width-switcher"
              // label={lang('SettingsLiveFormatKeepMarkerWidth')}
              label="Keep marker width"
              checked={keepMarkerWidth}
              inactive
            />
          )}
          className="LiveFormatMenu--menu--item"
          onClick={handleKeepMarkerWidthChange}
        >
          Keep marker width {/* lang('SettingsLiveFormatKeepMarkerWidth') */}
        </MenuItem>
      </Menu>
    </div>
  );
};

export default memo(LiveFormatMenu);
