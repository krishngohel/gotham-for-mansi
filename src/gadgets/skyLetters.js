// Confetti lettering for the party popper: a 5x7 bitmap font and a layout that turns a line of
// text into points (one per inked cell), centered on the origin, y up. Pure.
export const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
};

export function birthdayLine(name) {
  return `HAPPY BIRTHDAY ${String(name).toUpperCase()}!`;
}

// Greedy word wrap at `maxPerLine` characters.
export function textLines(text, maxPerLine = 14) {
  const lines = [];
  let cur = '';
  for (const w of String(text).toUpperCase().split(/\s+/).filter(Boolean)) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxPerLine) cur += ` ${w}`;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// One point per inked cell. Characters advance 6 cells (5 plus a gap); lines are 7 cells tall
// with `lineGap` cells between them. Unknown characters are blank.
export function letterPoints(text, { cell = 0.5, maxPerLine = 14, lineGap = 2 } = {}) {
  const lines = textLines(text, maxPerLine);
  const widthCells = Math.max(...lines.map((l) => l.length * 6 - 1));
  const heightCells = lines.length * 7 + (lines.length - 1) * lineGap;
  const points = [];
  lines.forEach((line, li) => {
    const lineW = line.length * 6 - 1;
    const x0 = -lineW / 2;
    const y0 = heightCells / 2 - li * (7 + lineGap);
    [...line].forEach((ch, ci) => {
      const g = GLYPHS[ch];
      if (!g) return;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if (g[r][c] !== '#') continue;
        points.push({ x: (x0 + ci * 6 + c + 0.5) * cell, y: (y0 - r - 0.5) * cell });
      }
    });
  });
  return { points, width: widthCells * cell, height: heightCells * cell };
}
