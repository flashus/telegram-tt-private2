import { type CaretPosition, computeMarkerVisibility } from '../src/util/ast/markerVisibility';

describe('computeMarkerVisibility', () => {
  test('returns empty array when no entities', () => {
    const pos: CaretPosition = 0;
    expect(computeMarkerVisibility([], pos)).toEqual([]);
  });

  test('returns index when caret is within a single entity', () => {
    const entities = [{ offset: 2, length: 3 }];
    const pos: CaretPosition = 3;
    const result = computeMarkerVisibility(entities, pos);
    expect(result).toEqual([0]);
  });

  test('returns empty when caret is outside entity bounds', () => {
    const entities = [{ offset: 2, length: 3 }];
    const pos: CaretPosition = 6;
    const result = computeMarkerVisibility(entities, pos);
    expect(result).toEqual([]);
  });

  test('handles multiple entities correctly', () => {
    const entities = [
      { offset: 0, length: 1 },
      { offset: 5, length: 2 },
      { offset: 10, length: 3 },
    ];
    const pos: CaretPosition = 6;
    const result = computeMarkerVisibility(entities, pos);
    expect(result).toEqual([1]);
  });

  test('includes boundary positions (start and end inclusive)', () => {
    const entities = [{ offset: 5, length: 2 }];
    const pos: CaretPosition = 5;
    const result = computeMarkerVisibility(entities, pos);
    expect(result).toEqual([0]);
    const pos2: CaretPosition = 7;
    const result2 = computeMarkerVisibility(entities, pos2);
    expect(result2).toEqual([0]);
  });
});
