/**
 * Compute indexes of entities for which raw markers should be shown,
 * based on caret position.
 */
export function computeMarkerVisibility(
  entities: { offset: number; length: number }[],
  caretOffset: number,
): number[] {
  return entities.reduce<number[]>((acc, e, idx) => {
    if (caretOffset + 1 >= e.offset && caretOffset - 1 <= e.offset + e.length) {
      acc.push(idx);
    }
    return acc;
  }, []);
}
