import { type CaretPosition, computeMarkerVisibility } from '../src/util/ast/markerVisibility';

describe('computeMarkerVisibility', () => {
  test('returns empty array when no entities', () => {
    const pos: CaretPosition = { start: 0, end: 0 };
    expect(computeMarkerVisibility([], pos)).toEqual([]);
  });

  test('returns index when caret is within a single entity', () => {
    const entities = [{ offset: 2, length: 3 }];
    const pos: CaretPosition = { start: 3, end: 3 };
    expect(computeMarkerVisibility(entities, pos)).toEqual([0]);
  });

  test('returns empty when caret is outside entity bounds', () => {
    const entities = [{ offset: 2, length: 3 }];
    const pos: CaretPosition = { start: 6, end: 6 };
    expect(computeMarkerVisibility(entities, pos)).toEqual([]);
  });

  test('handles multiple entities correctly', () => {
    const entities = [
      { offset: 0, length: 1 },
      { offset: 5, length: 2 },
      { offset: 10, length: 3 },
    ];
    const pos: CaretPosition = { start: 6, end: 6 };
    expect(computeMarkerVisibility(entities, pos)).toEqual([1]);
  });

  test('includes boundary positions (start and end inclusive)', () => {
    const entities = [{ offset: 5, length: 2 }];
    expect(computeMarkerVisibility(entities, { start: 5, end: 5 })).toEqual([0]);
    expect(computeMarkerVisibility(entities, { start: 7, end: 7 })).toEqual([0]);
  });
});
