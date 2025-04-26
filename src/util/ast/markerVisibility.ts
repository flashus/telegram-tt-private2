/**
 * Compute indexes of entities for which raw markers should be shown,
 * based on caret position.
 */
export function computeMarkerVisibility(
  entities: { offset: number; length: number }[],
  caretOffset: number,
  validOffsetMargin: number = 0,
): number[] {
  return entities.reduce<number[]>((acc, e, idx) => {
    if (caretOffset + validOffsetMargin >= e.offset && caretOffset - validOffsetMargin <= e.offset + e.length) {
      acc.push(idx);
    }
    return acc;
  }, []);
}
