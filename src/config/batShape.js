// Right half of the bat emblem, clockwise from the top center. 100 units wide, y up.
export const BAT_RIGHT_HALF = [
  [0, 12], [3, 13], [5.5, 22], [8, 12], [13, 11], [20, 15], [31, 21], [49, 23],
  [45, 14], [45, 5], [39, 9], [34, 1], [28, 5], [21, -5], [15, -1], [7, -10], [0, -21],
];

export function batOutline(half = BAT_RIGHT_HALF) {
  const left = half.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
  return [...half, ...left];
}

export function batSvgPath(scale = 1, cx = 0, cy = 0) {
  return batOutline()
    .map(([x, y], i) => `${i ? 'L' : 'M'}${(cx + x * scale).toFixed(2)} ${(cy - y * scale).toFixed(2)}`)
    .join(' ') + ' Z';
}
