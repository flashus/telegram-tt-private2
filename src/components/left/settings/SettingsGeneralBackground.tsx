import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiWallpaper } from '../../../api/types';
import type { TBGPatternScheme, ThemeKey } from '../../../types';
import { SettingsScreens, UPLOADING_WALLPAPER_SLUG } from '../../../types';

import { DARK_THEME_PATTERN_COLOR, DEFAULT_PATTERN_COLOR } from '../../../config';
import { selectTheme } from '../../../global/selectors';
import { getAverageColor, getPatternColor, rgb2hex } from '../../../util/colors';
import { validateFiles } from '../../../util/files';
import { throttle } from '../../../util/schedulers';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';

import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import WallpaperPatternTile from './WallpaperPatternTile';
import WallpaperTile from './WallpaperTile';

import './SettingsGeneralBackground.scss';

export const BG_PATTERN_SCHEMAS: TBGPatternScheme[] = [
  {
    colorScheme: {
      color1: '#e8ecc1', color2: '#9fc68b', color3: '#c9d6a2', color4: '#7ba676',
    },
    name: 'chat-bg-astronaut_cats',
    displayedName: 'astronaut_cats',
  },
  {
    colorScheme: {
      color1: '#e986d5', color2: '#e1d264', color3: '#44cbde', color4: '#b186eb',
    },
    name: 'chat-bg-animals',
    displayedName: 'animals',
  },
  {
    colorScheme: {
      color1: '#f19fba', color2: '#e8c06e', color3: '#eaa66f', color4: '#f0e387',
    },
    name: 'chat-bg-beach',
    displayedName: 'beach',
  },
  {
    colorScheme: {
      color1: '#e9ccff', color2: '#b9e2fe', color3: '#d7e7ce', color4: '#a3b4ff',
    },
    name: 'chat-bg-cats_and_dogs',
    displayedName: 'cats_and_dogs',
  },
  {
    colorScheme: {
      color1: '#b4d477', color2: '#efc07a', color3: '#7bbc7e', color4: '#ddcc64',
    },
    name: 'chat-bg-christmas',
    displayedName: 'christmas',
  },
  {
    colorScheme: {
      color1: '#6c8cd4', color2: '#aeafec', color3: '#b3afec', color4: '#d2a6c9',
    },
    name: 'chat-bg-fantasy',
    displayedName: 'fantasy',
  },
  {
    colorScheme: {
      color1: '#ea75aa', color2: '#f6db6f', color3: '#a868ea', color4: '#edab4e',
    },
    name: 'chat-bg-games',
    displayedName: 'games',
  },
  {
    colorScheme: {
      color1: '#68a5eb', color2: '#86d685', color3: '#d7ea97', color4: '#8de0d6',
    },
    name: 'chat-bg-late_night_delight',
    displayedName: 'late_night_delight',
  },
  {
    colorScheme: {
      color1: '#9232c0', color2: '#515cd4', color3: '#fcbe98', color4: '#dc6bb9',
    },
    name: 'chat-bg-magic',
    displayedName: 'magic',
  },
  {
    colorScheme: {
      color1: '#fb9ee5', color2: '#f9d9e6', color3: '#78ccff', color4: '#d6f5fe',
    },
    name: 'chat-bg-math',
    displayedName: 'math',
  },
  {
    colorScheme: {
      color1: '#db9fea', color2: '#679ded', color3: '#8ad6f2', color4: '#8a8dec',
    },
    name: 'chat-bg-paris',
    displayedName: 'paris',
  },
  {
    colorScheme: {
      color1: '#b8e8d5', color2: '#abdfd9', color3: '#afcbeb', color4: '#9fb1ea',
    },
    name: 'chat-bg-snowflakes',
    displayedName: 'snowflakes',
  },
  {
    colorScheme: {
      color1: '#ffe2a6', color2: '#ffc5b3', color3: '#fdc3b7', color4: '#e2c1fe',
    },
    name: 'chat-bg-space',
    displayedName: 'space',
  },
  {
    colorScheme: {
      color1: '#c8b1ee', color2: '#eeb7dc', color3: '#97bfeb', color4: '#b1e8ea',
    },
    name: 'chat-bg-star_wars',
    displayedName: 'star_wars',
  },
  {
    colorScheme: {
      color1: '#e7b7da', color2: '#b593e6', color3: '#deaee8', color4: '#8477c2',
    },
    name: 'chat-bg-sweets',
    displayedName: 'sweets',
  },
  {
    colorScheme: {
      color1: '#e5a5cc', color2: '#ebd692', color3: '#d2a5df', color4: '#edd495',
    },
    name: 'chat-bg-tattoos',
    displayedName: 'tattoos',
  },
  {
    colorScheme: {
      color1: '#faeacf', color2: '#bcd1ff', color3: '#509df7', color4: '#fec884',
    },
    name: 'chat-bg-underwater_world',
    displayedName: 'underwater_world',
  },
  {
    colorScheme: {
      color1: '#f9c37e', color2: '#fadda5', color3: '#936bb6', color4: '#d56ba2',
    },
    name: 'chat-bg-unicorn',
    displayedName: 'unicorn',
  },
  {
    colorScheme: {
      color1: '#996fe9', color2: '#fe8bb6', color3: '#f1da36', color4: '#319ed6',
    },
    name: 'chat-bg-zoo',
    displayedName: 'zoo',
  },
];

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  background?: string;
  patternScheme?: TBGPatternScheme;
  isBlurred?: boolean;
  invertMask?: boolean;
  loadedWallpapers?: ApiWallpaper[];
  theme: ThemeKey;
};

const SUPPORTED_TYPES = 'image/jpeg';

const runThrottled = throttle((cb) => cb(), 60000, true);

const SettingsGeneralBackground: FC<OwnProps & StateProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  background,
  patternScheme,
  isBlurred,
  invertMask,
  loadedWallpapers,
  theme,
}) => {
  const {
    loadWallpapers,
    uploadWallpaper,
    setThemeSettings,
  } = getActions();

  const themeRef = useRef<ThemeKey>();
  themeRef.current = theme;
  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadWallpapers();
    });
  }, [loadWallpapers]);

  const handleFileSelect = useCallback((e: Event) => {
    const { files } = e.target as HTMLInputElement;

    const validatedFiles = validateFiles(files);
    if (validatedFiles?.length) {
      uploadWallpaper(validatedFiles[0]);
    }
  }, [uploadWallpaper]);

  const handleUploadWallpaper = useCallback(() => {
    openSystemFilesDialog(SUPPORTED_TYPES, handleFileSelect, true);
  }, [handleFileSelect]);

  const handleSetColor = useCallback(() => {
    onScreenSelect(SettingsScreens.GeneralChatBackgroundColor);
  }, [onScreenSelect]);

  const handleResetToDefault = useCallback(() => {
    setThemeSettings({
      theme,
      background: undefined,
      backgroundColor: undefined,
      isBlurred: true,
      patternColor: theme === 'dark' ? DARK_THEME_PATTERN_COLOR : DEFAULT_PATTERN_COLOR,
      patternScheme: BG_PATTERN_SCHEMAS[0],
    });
  }, [setThemeSettings, theme]);

  const handleWallPaperPatternSelect = useCallback((newPatternScheme: TBGPatternScheme) => {
    setThemeSettings({
      theme: themeRef.current!,
      patternScheme: newPatternScheme,
      background: undefined,
      backgroundColor: undefined,
      patternColor: themeRef.current === 'dark' ? DARK_THEME_PATTERN_COLOR : DEFAULT_PATTERN_COLOR,
    });
  }, [setThemeSettings]);

  const handleWallPaperSelect = useCallback((slug: string) => {
    setThemeSettings({ theme: themeRef.current!, background: slug });
    const currentWallpaper = loadedWallpapers && loadedWallpapers.find((wallpaper) => wallpaper.slug === slug);
    if (currentWallpaper?.document.thumbnail) {
      getAverageColor(currentWallpaper.document.thumbnail.dataUri)
        .then((color) => {
          const patternColor = getPatternColor(color);
          const rgbColor = `#${rgb2hex(color)}`;
          setThemeSettings({
            theme: themeRef.current!,
            backgroundColor: rgbColor,
            patternColor,
            patternScheme: BG_PATTERN_SCHEMAS[0],
          });
        });
    }
  }, [loadedWallpapers, setThemeSettings]);

  const handleWallPaperInvertMaskChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setThemeSettings({ theme: themeRef.current!, invertMask: e.target.checked });
  }, [setThemeSettings]);

  const handleWallPaperBlurChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setThemeSettings({ theme: themeRef.current!, isBlurred: e.target.checked });
  }, [setThemeSettings]);

  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const isUploading = loadedWallpapers?.[0] && loadedWallpapers[0].slug === UPLOADING_WALLPAPER_SLUG;

  return (
    <div className="SettingsGeneralBackground settings-content custom-scroll">
      <div className="settings-item">
        <ListItem
          icon="camera-add"
          className="mb-0"
          disabled={isUploading}
          onClick={handleUploadWallpaper}
        >
          {lang('UploadImage')}
        </ListItem>

        <ListItem
          icon="colorize"
          className="mb-0"
          onClick={handleSetColor}
        >
          {lang('SetColor')}
        </ListItem>

        <ListItem icon="favorite" onClick={handleResetToDefault}>
          {lang('ThemeResetToDefaults')}
        </ListItem>

        <Checkbox
          label={lang('Inverted')}
          checked={Boolean(invertMask)}
          onChange={handleWallPaperInvertMaskChange}
        />

        <Checkbox
          label={lang('BackgroundBlurred')}
          checked={Boolean(isBlurred)}
          onChange={handleWallPaperBlurChange}
        />
      </div>

      {loadedWallpapers ? (
        <div className="settings-wallpapers">
          {BG_PATTERN_SCHEMAS.map((pattern) => (
            <WallpaperPatternTile
              key={pattern.name}
              invertMask={invertMask ?? false}
              isSelected={!background && patternScheme?.name === pattern.name}
              backgroundPatternScheme={pattern}
              onClick={handleWallPaperPatternSelect}
            />
          ))}
          {loadedWallpapers.map((wallpaper) => (
            <WallpaperTile
              key={wallpaper.slug}
              wallpaper={wallpaper}
              theme={theme}
              isSelected={background === wallpaper.slug}
              onClick={handleWallPaperSelect}
            />
          ))}
        </div>
      ) : (
        <Loading />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const theme = selectTheme(global);
    const {
      background, patternScheme, isBlurred, invertMask,
    } = global.settings.themes[theme] || {};
    const { loadedWallpapers } = global.settings;

    return {
      background,
      patternScheme,
      isBlurred,
      invertMask,
      loadedWallpapers,
      theme,
    };
  },
)(SettingsGeneralBackground));
