// Weighted completion for the Progress page, the title screen and the milestone captions. Pure.
// Categories register themselves, so later parts (Part D moves, the Part H post-game) add their
// own without editing this file. See "Extending the tracker" in docs/superpowers/plans/2026-09-28-plan-3c-content.md.
import { STEPS } from './story.js';
import { BALLOON_COUNT, DISTRICT_IDS } from '../core/save.js';
import { BALLOONS } from '../config/balloonSpots.js';
import { CHALLENGES } from './challenges.js';
import { DISTRICT_LABEL } from './crimes.js';

export const MILESTONES = [25, 50, 75, 100];
export const CRIME_TARGET = 10;
export const MEDAL_POINTS = { bronze: 1, silver: 2, gold: 3 };
export const CHAPTERS = [
  { name: 'The Signal', first: 'intro' },
  { name: 'The Docks', first: 'toDocks' },
  { name: 'Neon Row', first: 'toNeon' },
  { name: 'Ace Chemicals', first: 'toAce' },
  { name: 'The Clock Tower', first: 'toTower' },
];
export const BASE_MOVES = ['ladder', 'ledge', 'zipline', 'wallrun', 'divebomb', 'throw', 'slam', 'counter'];
export const MOVE_NAMES = {
  ladder: 'ladder', ledge: 'ledge grab', zipline: 'zipline', wallrun: 'wall run', divebomb: 'dive bomb',
  throw: 'throw', slam: 'ground slam', counter: 'counter', silentTakedown: 'silent takedown', perchDrop: 'perch drop',
};

const moves = [...BASE_MOVES];
// Part D adds 'silentTakedown' and 'perchDrop' when stealth ships. Returns an undo.
export function registerMoves(ids) {
  const added = ids.filter((id, i) => !moves.includes(id) && ids.indexOf(id) === i);
  moves.push(...added);
  return () => { for (const id of added) { const i = moves.indexOf(id); if (i >= 0) moves.splice(i, 1); } };
}
export const moveList = () => [...moves];

export function createProgressRegistry() {
  const cats = [];
  return {
    register(cat) {
      if (!cat || typeof cat.id !== 'string' || !cat.id) throw new Error('progress category needs an id');
      if (!(typeof cat.weight === 'number' && cat.weight > 0)) throw new Error(`progress category ${cat.id} needs a positive weight`);
      if (typeof cat.count !== 'function') throw new Error(`progress category ${cat.id} needs count(progress)`);
      const i = cats.findIndex((c) => c.id === cat.id);
      if (i >= 0) cats[i] = cat; else cats.push(cat);
      return () => { const j = cats.indexOf(cat); if (j >= 0) cats.splice(j, 1); };
    },
    get categories() { return cats.slice(); },
    score(progress) { return scoreProgress(progress, cats); },
  };
}

// Weighted mean of each active category's done/total. Shows 100 only when everything is done.
export function scoreProgress(progress, cats) {
  const parts = [];
  let weights = 0, earned = 0, complete = true;
  for (const c of cats) {
    if (c.active && !c.active(progress)) continue;
    const { done, total } = c.count(progress);
    const fraction = total > 0 ? Math.min(1, Math.max(0, done) / total) : 1;
    weights += c.weight;
    earned += c.weight * fraction;
    if (fraction < 1) complete = false;
    parts.push({ id: c.id, label: c.label, weight: c.weight, done, total, fraction, detail: c.detail ? c.detail(progress) : '' });
  }
  const percent = !weights ? 0 : complete ? 100 : Math.min(99, Math.floor((100 * earned) / weights + 1e-9));
  return { percent, parts };
}

export const milestonesCrossed = (from, to) => MILESTONES.filter((m) => m > from && m <= to);

export function storyCount(p, steps = STEPS) {
  const total = steps.length - 1; // reaching the credits step finishes the story
  return { done: p.finished ? total : Math.min(Math.max(0, p.step), total), total };
}

export function chapterOf(stepIndex, steps = STEPS) {
  let index = 0;
  CHAPTERS.forEach((c, i) => {
    const at = steps.findIndex((s) => s.id === c.first);
    if (at >= 0 && at <= stepIndex) index = i;
  });
  return { number: index + 1, of: CHAPTERS.length, name: CHAPTERS[index].name };
}

export function nextBalloonHint(p) {
  const i = BALLOONS.findIndex((_, k) => !p.balloons.includes(k));
  return i < 0 ? null : BALLOONS[i].where;
}

const medalPoints = (p) => CHALLENGES.reduce((n, ch) => n + (MEDAL_POINTS[p.challenges[ch.id]?.medal] ?? 0), 0);

export const BASE_CATEGORIES = [
  {
    id: 'story', label: 'Story', weight: 40, count: (p) => storyCount(p),
    detail: (p) => {
      if (p.finished) return 'Complete';
      const c = chapterOf(p.step);
      return `Chapter ${c.number} of ${c.of}: ${c.name}`;
    },
  },
  {
    id: 'balloons', label: 'Balloons', weight: 20, count: (p) => ({ done: p.balloons.length, total: BALLOON_COUNT }),
    detail: (p) => { const h = nextBalloonHint(p); return h ? `Next: ${h}` : 'All twelve found'; },
  },
  {
    id: 'challenges', label: 'Challenge medals', weight: 20, count: (p) => ({ done: medalPoints(p), total: CHALLENGES.length * 3 }),
    detail: (p) => `${CHALLENGES.filter((ch) => p.challenges[ch.id]?.medal === 'gold').length} of ${CHALLENGES.length} gold`,
  },
  {
    id: 'crimes', label: 'Street crimes', weight: 10, count: (p) => ({ done: Math.min(p.crimes.stopped, CRIME_TARGET), total: CRIME_TARGET }),
    detail: (p) => `Stopped ${p.crimes.stopped}`,
  },
  {
    id: 'moves', label: 'Moves learned', weight: 5, count: (p) => ({ done: moves.filter((m) => p.moves.includes(m)).length, total: moves.length }),
    detail: (p) => {
      const left = moves.filter((m) => !p.moves.includes(m));
      return left.length ? `Still to try: ${left.map((m) => MOVE_NAMES[m] ?? m).join(', ')}` : 'All learned';
    },
  },
  {
    id: 'districts', label: 'Districts visited', weight: 5, count: (p) => ({ done: p.districts.length, total: DISTRICT_IDS.length }),
    detail: (p) => {
      const left = DISTRICT_IDS.filter((d) => !p.districts.includes(d));
      return left.length ? `Not yet: ${left.map((d) => DISTRICT_LABEL[d]).join(', ')}` : 'All five visited';
    },
  },
];

export const tracker = createProgressRegistry();
for (const c of BASE_CATEGORIES) tracker.register(c);
