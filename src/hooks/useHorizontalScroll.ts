import { useEffect } from '../lib/teact/teact';

const useHorizontalScroll = (
  containerRef: React.RefObject<HTMLDivElement>,
  isDisabled?: boolean,
  shouldPreventDefault = false,
) => {
  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    const container = containerRef.current!;

    function handleScroll(e: WheelEvent) {
      // Ignore horizontal scroll and let it work natively (e.g. on touchpad)
      if (!e.deltaX) {
        container.scrollLeft += e.deltaY / 4;
        if (shouldPreventDefault) e.preventDefault();
      }
    }

    container.addEventListener('wheel', handleScroll, { passive: !shouldPreventDefault });

    return () => {
      container.removeEventListener('wheel', handleScroll);
    };
  }, [containerRef, isDisabled, shouldPreventDefault]);
};

export default useHorizontalScroll;

/**
 * This kind of horizontal scroll can be used to fix handling scrolling for several elements
 * that are not overflowing (thus, not scrollable themselves) but are part of the same overflowing container
 */
export const useChildHorizontalScroll = (
  overflowingContainerRef: React.RefObject<HTMLDivElement>,
  trackingContainerRef: React.RefObject<HTMLDivElement>,
  isDisabled?: boolean,
  ignoreBounds?: boolean,
  shouldPreventDefault = false,
) => {
  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    const container = overflowingContainerRef.current!;
    const tracker = trackingContainerRef.current!;

    // capture the bounds *once*, before any scrolling
    const { left: startLeft, right: startRight } = tracker.getBoundingClientRect();

    function handleScroll(e: WheelEvent) {
      // If cursor is not within bounds of tracking container, do nothing
      if (!ignoreBounds && (e.clientX < startLeft || e.clientX > startRight)) {
        return;
      }

      // Ignore horizontal scroll and let it work natively (e.g. on touchpad)
      if (!e.deltaX) {
        container.scrollLeft += e.deltaY / 4;
        if (shouldPreventDefault) e.preventDefault();
      }
    }

    container.addEventListener('wheel', handleScroll, { passive: !shouldPreventDefault });

    return () => {
      container.removeEventListener('wheel', handleScroll);
    };
  }, [overflowingContainerRef, trackingContainerRef, isDisabled,
    shouldPreventDefault, ignoreBounds]);
};
