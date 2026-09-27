// Encounters. Positions are offsets (dx, dz) from the fight's site; y is found by collision.
const g = (dx, dz) => ({ type: 'grunt', dx, dz });
const k = (dx, dz) => ({ type: 'knife', dx, dz });
const b = (dx, dz) => ({ type: 'brute', dx, dz });

export const FIGHTS = {
  docksRoof: { site: 'wh3Roof', radius: 14, waves: [[g(-4, -5), g(5, -3)]] },
  yard: { site: 'yard', radius: 13, waves: [[g(-6, 0), g(6, 1), g(0, 3)], [g(-10, -1), g(10, 2)]] },
  freighter: { site: 'freighter', radius: 14, waves: [[g(-4, -6), g(4, -4), g(0, 6)], [g(-4, 10), g(4, 12), g(0, -10)]] },
  gazette: { site: 'gazetteRoof', radius: 15, waves: [[k(-5, -4), g(5, -4), g(0, 6)], [k(6, 6), g(-6, 5)]] },
  street: { site: 'neonStreet', radius: 14, waves: [[g(-3, -6), g(3, -8), k(0, 8), g(2, 10)], [k(-3, -12), k(3, 12), g(0, -14)]] },
  monarch: { site: 'monarchRoof', radius: 15, waves: [[g(-6, -6), g(6, -6), k(0, 7), g(-7, 6)], [k(-5, 0), k(5, 0), g(0, -10), g(0, 10)]] },
  aceYard: { site: 'aceYard', radius: 16, waves: [[g(-6, -4), g(6, -4), b(0, 8)], [g(-8, 4), k(8, 6)]] },
  factory: { site: 'factoryRoof', radius: 18, waves: [[g(-8, -6), g(8, -6), k(0, 8), k(-8, 8)], [b(0, -8), g(8, 6), g(-10, 0)]] },
  vats: { site: 'vatDeck', radius: 11, waves: [[g(-5, -5), g(5, -5), k(0, 6)], [b(-5, 4), k(5, 5), g(0, -7)], [b(0, 0), g(-6, 0), g(6, 0)]] },
};
