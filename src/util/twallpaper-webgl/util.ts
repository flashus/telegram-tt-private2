// https://github.com/crashmax-dev/twallpaper-webgl - all regards to the author crashmax-dev

export function distance(p1: number[], p2: number[]) {
  return Math.sqrt(
    // (p1[0] - p2[0]) * (p1[0] - p2[0]),
    (p1[1] - p2[1]) * (p1[1] - p2[1]),
  );
}
