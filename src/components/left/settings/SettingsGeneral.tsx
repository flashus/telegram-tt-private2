import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ILiveFormatSettings, ISettings, LiveFormatMode, TimeFormat,
} from '../../../types';
import type { IRadioOption } from '../../ui/RadioGroup';
import { SettingsScreens } from '../../../types';

import { pick } from '../../../util/iteratees';
import { setTimeFormat } from '../../../util/oldLangProvider';
import { getSystemTheme } from '../../../util/systemTheme';
import {
  IS_ANDROID, IS_ELECTRON, IS_IOS, IS_MAC_OS, IS_WINDOWS,
} from '../../../util/windowEnvironment';

import useAppLayout from '../../../hooks/useAppLayout';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import RangeSlider from '../../ui/RangeSlider';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps =
  Pick<ISettings, (
    'messageTextSize' |
    'animationLevel' |
    'messageSendKeyCombo' |
    'timeFormat'
  )> & {
    theme: ISettings['theme'];
    shouldUseSystemTheme: boolean;
    liveFormat: ILiveFormatSettings;
  };

const SettingsGeneral: FC<OwnProps & StateProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  messageTextSize,
  messageSendKeyCombo,
  timeFormat,
  theme,
  shouldUseSystemTheme,
  liveFormat,
}) => {
  const {
    setSettingOption,
    setLiveFormatSettings,
  } = getActions();

  const lang = useLang();

  const { isMobile } = useAppLayout();
  const isMobileDevice = isMobile && (IS_IOS || IS_ANDROID);

  const timeFormatOptions: IRadioOption[] = [{
    label: lang('SettingsTimeFormat12'),
    value: '12h',
  }, {
    label: lang('SettingsTimeFormat24'),
    value: '24h',
  }];

  const appearanceThemeOptions: IRadioOption[] = [{
    label: lang('EmptyChatAppearanceLight'),
    value: 'light',
  }, {
    label: lang('EmptyChatAppearanceDark'),
    value: 'dark',
  }, {
    label: lang('EmptyChatAppearanceSystem'),
    value: 'auto',
  }];

  const keyboardSendOptions = !isMobileDevice ? [
    { value: 'enter', label: lang('SettingsSendEnter'), subLabel: lang('SettingsSendEnterDescription') },
    {
      value: 'ctrl-enter',
      label: lang(IS_MAC_OS || IS_IOS ? 'SettingsSendCmdenter' : 'SettingsSendCtrlenter'),
      subLabel: lang('SettingsSendPlusEnterDescription'),
    },
  ] : undefined;

  const liveFormatOptions: IRadioOption<LiveFormatMode>[] = [
    { value: 'on', label: 'On'/* lang('SettingsLiveFormatOn') */ },
    { value: 'combo', label: 'Combo (cmd + alt + f)' /* lang('SettingsLiveFormatCombo') */ },
    { value: 'off', label: 'Off'/* lang('SettingsLiveFormatOff') */ },
  ];

  const handleMessageTextSizeChange = useCallback((newSize: number) => {
    document.documentElement.style.setProperty(
      '--composer-text-size', `${Math.max(newSize, IS_IOS ? 16 : 15)}px`,
    );
    document.documentElement.style.setProperty('--message-meta-height', `${Math.floor(newSize * 1.3125)}px`);
    document.documentElement.style.setProperty('--message-text-size', `${newSize}px`);
    document.documentElement.setAttribute('data-message-text-size', newSize.toString());

    setSettingOption({ messageTextSize: newSize });
  }, [setSettingOption]);

  const handleAppearanceThemeChange = useCallback((value: string) => {
    const newTheme = value === 'auto' ? getSystemTheme() : value as ISettings['theme'];

    setSettingOption({ theme: newTheme });
    setSettingOption({ shouldUseSystemTheme: value === 'auto' });
  }, [setSettingOption]);

  const handleTimeFormatChange = useCallback((newTimeFormat: string) => {
    setSettingOption({ timeFormat: newTimeFormat as TimeFormat });
    setSettingOption({ wasTimeFormatSetManually: true });

    setTimeFormat(newTimeFormat as TimeFormat);
  }, [setSettingOption]);

  const handleMessageSendComboChange = useCallback((newCombo: string) => {
    setSettingOption({ messageSendKeyCombo: newCombo as ISettings['messageSendKeyCombo'] });
  }, [setSettingOption]);

  const [isTrayIconEnabled, setIsTrayIconEnabled] = useState(false);
  useEffect(() => {
    window.electron?.getIsTrayIconEnabled().then(setIsTrayIconEnabled);
  }, []);

  const handleIsTrayIconEnabledChange = useCallback((isChecked: boolean) => {
    window.electron?.setIsTrayIconEnabled(isChecked);
  }, []);

  const handleLiveFormatModeChange = useCallback((newValue: LiveFormatMode) => {
    setLiveFormatSettings({ mode: newValue });
  }, [setLiveFormatSettings]);

  const handleLiveFormatValidOffsetMarginChange = useCallback((newValue: number) => {
    setLiveFormatSettings({ validOffsetMargin: newValue });
  }, [setLiveFormatSettings]);

  const handleLiveFormatKeepMarkerWidthChange = useCallback((isChecked: boolean) => {
    setLiveFormatSettings({ keepMarkerWidth: isChecked });
  }, [setLiveFormatSettings]);

  const handleLiveFormatComposerButtonShownChange = useCallback((isChecked: boolean) => {
    setLiveFormatSettings({ composerButtonShown: isChecked });
  }, [setLiveFormatSettings]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('Settings')}</h4>

        <RangeSlider
          label={lang('TextSize')}
          min={12}
          max={20}
          value={messageTextSize}
          onChange={handleMessageTextSizeChange}
        />

        <ListItem
          icon="photo"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.GeneralChatBackground)}
        >
          {lang('ChatBackground')}
        </ListItem>

        {IS_ELECTRON && IS_WINDOWS && (
          <Checkbox
            label={lang('SettingsTray')}
            checked={Boolean(isTrayIconEnabled)}
            onCheck={handleIsTrayIconEnabledChange}
          />
        )}
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('Theme')}
        </h4>
        <RadioGroup
          name="theme"
          options={appearanceThemeOptions}
          selected={shouldUseSystemTheme ? 'auto' : theme}
          onChange={handleAppearanceThemeChange}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('SettingsTimeFormat')}
        </h4>
        <RadioGroup
          name="timeformat"
          options={timeFormatOptions}
          selected={timeFormat}
          onChange={handleTimeFormatChange}
        />
      </div>

      {keyboardSendOptions && (
        <div className="settings-item">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('SettingsKeyboard')}</h4>

          <RadioGroup
            name="keyboard-send-settings"
            options={keyboardSendOptions}
            onChange={handleMessageSendComboChange}
            selected={messageSendKeyCombo}
          />
        </div>
      )}

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {'Live message formatting' /* {lang('SettingsLiveFormat')} */}
        </h4>
        <RadioGroup
          name="liveformat"
          options={liveFormatOptions}
          selected={liveFormat.mode}
          onChange={handleLiveFormatModeChange as (value: string) => void}
        />
        <RangeSlider
          // label={lang('SettingsLiveFormatValidOffset')}
          label="Marker visibility offset margin"
          min={0}
          max={10}
          value={liveFormat.validOffsetMargin}
          onChange={handleLiveFormatValidOffsetMarginChange}
        />
        <Checkbox
          // label={lang('SettingsComposerLiveFormatMarkerVisible')}
          label="Keep marker width when invisible"
          checked={Boolean(liveFormat.keepMarkerWidth)}
          onCheck={handleLiveFormatKeepMarkerWidthChange}
        />
        <Checkbox
          // label={lang('SettingsComposerLiveFormatButton')}
          label="Show settings button in composer"
          checked={Boolean(liveFormat.composerButtonShown)}
          onCheck={handleLiveFormatComposerButtonShownChange}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { theme, shouldUseSystemTheme } = global.settings.byKey;
    const { liveFormat } = global.settings;

    return {
      ...pick(global.settings.byKey, [
        'messageTextSize',
        'animationLevel',
        'messageSendKeyCombo',
        'isSensitiveEnabled',
        'canChangeSensitive',
        'timeFormat',
      ]),
      theme,
      shouldUseSystemTheme,
      liveFormat,
    };
  },
)(SettingsGeneral));
