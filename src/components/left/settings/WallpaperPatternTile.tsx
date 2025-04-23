import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef,
} from '../../../lib/teact/teact';

import type { TBGPatternScheme } from '../../../types';

import buildClassName from '../../../util/buildClassName';
import { TWallpaperWebGL } from '../../../util/twallpaper-webgl';

import useLastCallback from '../../../hooks/useLastCallback';

import styles from './WallpaperPatternTile.module.scss';

type OwnProps = {
  invertMask: boolean;
  isSelected: boolean;
  backgroundPatternScheme: TBGPatternScheme;
  onClick: (backgroundPatternScheme: TBGPatternScheme) => void;
};

const WallpaperPatternTile: FC<OwnProps> = ({
  invertMask,
  isSelected,
  backgroundPatternScheme,
  onClick,
}) => {
  const { name: patternName, colorScheme } = backgroundPatternScheme;

  // eslint-disable-next-line no-null/no-null
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);

  const twallpaperAnimator = TWallpaperWebGL.getMultitonInstance(patternName);

  useEffect(() => {
    if (!bgCanvasRef.current) {
      return;
    }

    // Animate if selected
    if (isSelected && twallpaperAnimator.isInitialized) {
      twallpaperAnimator.playAnimation();
      return;
    }

    // Initialize if selected and not initialized
    if (isSelected) {
      twallpaperAnimator.initCanvas(bgCanvasRef.current, colorScheme);
      twallpaperAnimator.renderGradientCanvas();
      return;
    }

    // If not selected, but is initialized, deinit
    if (twallpaperAnimator.isInitialized) {
      twallpaperAnimator.deinit();
    }

    // If not selected - render preview
    TWallpaperWebGL.renderPreview(bgCanvasRef.current, colorScheme);

    // eslint-disable-next-line consistent-return
    return () => {
      if (twallpaperAnimator.isInitialized) {
        twallpaperAnimator.deinit();
      }
    };
  }, [bgCanvasRef, twallpaperAnimator, colorScheme, isSelected]);

  const handleClick = useLastCallback(() => {
    onClick(backgroundPatternScheme);
  });

  const rootClassName = buildClassName(
    styles.root,
    isSelected && styles.selected,
    styles[patternName],
    invertMask && styles.inverted,
  );

  return (
    <div className={rootClassName} onClick={handleClick}>
      <div className={styles.background}>
        <canvas
          className={styles.canvas}
          ref={bgCanvasRef}
        />
        <div className={styles.pattern} />
      </div>
    </div>
  );
};

export default memo(WallpaperPatternTile);
