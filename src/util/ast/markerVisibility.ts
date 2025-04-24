export interface CaretPosition { start: number; end: number }

/**
 * Compute indexes of entities for which raw markers should be shown,
 * based on caret position.
 */
export function computeMarkerVisibility(
  entities: { offset: number; length: number }[],
  caret: CaretPosition,
): number[] {
  const { start } = caret;
  return entities.reduce<number[]>((acc, e, idx) => {
    if (start >= e.offset && start <= e.offset + e.length) {
      acc.push(idx);
    }
    return acc;
  }, []);
}
