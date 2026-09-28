// Gadgets at run time: the wheel (hold to open with time at 20%, pick with the mouse, the right
// stick or 1 to 8, let go to equip), the equipped gadget and its HUD panel, firing through
// combat's input buffer (the useGadget hook), each gadget's live effects (handlers in ./g/),
// unlock announcements and the help list.
import { GADGETS, GADGET_IDS, gadgetById, unlockedIds, gadgetsLocked, freeForGadget } from './gadgetDefs.js';
import { createGadgetState } from './gadgetState.js';
import { createWheelLogic, createWheelCursor, slotFromDir, WHEEL_DIGITS } from './wheelMath.js';
import { HANDLER_FACTORIES } from './g/index.js';
import { STEPS } from '../game/story.js';
import { bindingLabel } from '../core/bindings.js';
import { promptText } from '../ui/prompts.js';

// How long the returning-player summary card stays up before the party popper gets its own.
export const NEWS_CARD_S = 9;
// Mouse pixels (pointer lock) for a full push toward a slot. Small, so a short trackpad swipe
// (a MacBook in Safari) is enough: past the 0.35 dead zone after about 25 px.
const WHEEL_PX = 70;

export function createGadgetSystem(deps) {
  const {
    hero, combat, follow, time, events, input, fx, gfx, breakables, progress, save, collision, camera, effects,
    wheelUi, gadgetHud, getBindings, isPlaying, devAll = false, factories = HANDLER_FACTORIES, stealth = null,
  } = deps;
  const saved = progress.gadgets;
  const state = createGadgetState({ equipped: saved.equipped, unlocked: unlockedIds(progress, STEPS, saved.unlocked), tune: effects });
  if (devAll) state.unlock(GADGET_IDS);
  const handlers = GADGETS.filter((g) => factories[g.id]).map((g) => factories[g.id]());
  const byId = new Map(handlers.map((h) => [h.id, h]));
  const wheel = createWheelLogic();
  const cursor = createWheelCursor({ pxPerUnit: WHEEL_PX });
  const st = {};
  let hudCode = -1, pickCode = -1;
  // The last slot the mouse and the stick pointed at: they only move the pick when that changes,
  // so a key pick (1 to 8) isn't overwritten by a cursor resting on another slot.
  let cursorSlot = null, stickSlot = null;
  // Set when the wheel opens; the next update, if it is still open, it has been on screen for a
  // rendered frame and 'wheelSeen' fires (the tutorial prompt only counts from then).
  let unseen = false;

  const sys = {
    hero, combat, api: combat.gadgetApi, follow, time, events, input, fx, gfx, breakables, collision, camera, state, effects, progress,
    stealth,
    cameraFocus: null, cameraMode: null, wheelOpen: false,
    // A ?gadgets=all dev run: handlers must not write progress or call save() while it is set.
    devAll,
    hint(id, arg) { events.emit('hint', { id, arg }); },
    // A short gadget pose (throw, spray, fire). On the ground it holds locomotion off for `dur`, so
    // the clip isn't cut by the idle, and replaces a combat move in its chain window, as the next
    // punch would; otherwise it just plays. A move that can't be cut keeps its own clip.
    pose(clip, dur = 0.3, timeScale = 2) {
      if (!freeForGadget(hero)) return;
      hero.bat.animator.play(clip, { once: true, timeScale, fade: 0.05 });
      if (hero.state !== 'ground') return;
      let t = 0;
      hero.control = { name: 'gadgetPose', combat: true, canChain: () => t > dur * 0.7, update(dt) { t += dt; return t > dur; } };
    },
  };

  // Gadgets a returning save earned before they existed (a save past their unlock steps, or one
  // that finished the story): unlocked now, never announced. They are told on the first live play
  // frame (one summary card, then the party popper's own card) and only then remembered, so the
  // news never repeats. A ?gadgets=all run has no news and never writes.
  const news = devAll ? [] : [...state.unlocked].filter((id) => id !== 'batarang' && !saved.unlocked.includes(id));
  let newsT = 0;
  // The wheel tutorial, once per run while more than one gadget is unlocked and the wheel has
  // never been opened (progress.gadgets.wheelUsed).
  let wheelTip = !devAll && !saved.wheelUsed;

  // Every gadget the story has unlocked is remembered in the save, so a new game keeps it.
  function remember() {
    if (devAll) return;
    let dirty = false;
    for (const id of state.unlocked) {
      if (id !== 'batarang' && !news.includes(id) && !saved.unlocked.includes(id)) { saved.unlocked.push(id); dirty = true; }
    }
    if (dirty) save();
  }
  remember();

  // Runs every play frame; does nothing once the news is out (a length check and a Set size).
  function updateNews(real) {
    if (wheelTip && state.unlocked.size > 1 && isPlaying()) { wheelTip = false; events.emit('gadgetWheelTip'); }
    if (!news.length || !isPlaying()) return;
    newsT -= real;
    if (newsT > 0) return;
    const popper = news.indexOf('popper');
    const rest = news.length - (popper >= 0 ? 1 : 0);
    if (rest > 1) {
      const ids = news.filter((id) => id !== 'popper');
      events.emit('gadgetNews', { ids });
      news.length = 0;
      if (popper >= 0) { news.push('popper'); newsT = NEWS_CARD_S; }
    } else {
      // One gadget (the popper, or any other on its own) gets its normal unlock card.
      const id = rest ? news.find((g) => g !== 'popper') : 'popper';
      news.splice(news.indexOf(id), 1);
      events.emit('gadgetUnlocked', { id });
      if (news.length) newsT = NEWS_CARD_S;
    }
    remember();
  }

  function unlockCheck() {
    if (devAll) return;
    const fresh = state.unlock(unlockedIds(progress, STEPS, saved.unlocked));
    remember();
    for (const id of fresh) events.emit('gadgetUnlocked', { id });
  }
  events.on('step', unlockCheck);
  // The Joker only answers to the batarang: his fight starts with it in hand. Not saved, so the
  // gadget picked before still comes back on the next load.
  events.on('step', (e) => {
    if (e?.step?.type !== 'boss' || state.equipped === 'batarang') return;
    state.equip('batarang');
    hudCode = -1;
  });

  function equip(id) {
    if (!state.equip(id)) return false;
    // ?gadgets=all is a dev run: its picks never reach the real save.
    if (!devAll && saved.equipped !== id) { saved.equipped = id; save(); }
    hudCode = -1;
    events.emit('gadgetEquip', { id });
    return true;
  }

  function info(i) {
    const id = GADGET_IDS[i];
    if (!state.isUnlocked(id)) return { name: '???', text: gadgetById(id).unlockText };
    state.status(id, st);
    return { name: st.name, text: st.text };
  }
  // Only in live play: never dead, in a cutscene or comic, paused, in photo mode, mid chain
  // takedown or the Bat Swarm (gadgetDefs NO_GADGET_CONTROLS), in a challenge countdown or while
  // steering the remote batarang.
  function canUseWheel() {
    return isPlaying() && !hero.dead && !gadgetsLocked(hero) && !byId.get('remote')?.active;
  }
  function openWheel() {
    if (wheel.open || !canUseWheel()) return;
    wheel.press(GADGET_IDS.indexOf(state.equipped));
    cursor.reset();
    cursorSlot = null;
    stickSlot = null;
    sys.wheelOpen = true;
    time.hold('wheel', 0.2);
    pickCode = state.hudCode(GADGET_IDS[wheel.pick]);
    wheelUi.show(GADGET_IDS.map((id) => state.isUnlocked(id)), wheel.pick, info(wheel.pick));
    unseen = true;
    events.emit('wheelOpen');
  }
  function closeWheel(apply = true) {
    // Always drop the hold, even if the wheel was already shut: it must never outlive the wheel.
    time.release('wheel');
    if (!wheel.open) return;
    const slot = wheel.release((i) => apply && state.isUnlocked(GADGET_IDS[i]));
    sys.wheelOpen = false;
    wheelUi.hide();
    events.emit('wheelClose');
    if (slot !== null && GADGET_IDS[slot] !== state.equipped) equip(GADGET_IDS[slot]);
  }
  function updateWheel() {
    if (wheel.open && unseen) {
      unseen = false;
      wheelTip = false;
      if (!devAll && !saved.wheelUsed) { saved.wheelUsed = true; save(); }
      events.emit('wheelSeen');
    }
    if (input.pressed('gadgetWheel')) openWheel();
    if (!wheel.open) return;
    // Play stopped or a chain began under the wheel: shut it without equipping.
    if (!canUseWheel()) { closeWheel(false); return; }
    const before = wheel.pick;
    cursor.move(input.look.dx, input.look.dy);
    const cs = cursor.slot();
    if (cs !== cursorSlot) { cursorSlot = cs; wheel.choose(cs); }
    const ss = slotFromDir(input.stick?.lx ?? 0, input.stick?.ly ?? 0, { dead: 0.5 });
    if (ss !== stickSlot) { stickSlot = ss; wheel.choose(ss); }
    for (let i = 0; i < WHEEL_DIGITS.length; i++) {
      if (!input.codePressed(WHEEL_DIGITS[i])) continue;
      wheel.choose(i);
      input.swallow(WHEEL_DIGITS[i]);
    }
    const code = state.hudCode(GADGET_IDS[wheel.pick]);
    if (wheel.pick !== before) {
      pickCode = code;
      wheelUi.setPick(wheel.pick, info(wheel.pick));
      events.emit('wheelPick', { slot: wheel.pick });
    } else if (code !== pickCode) {
      pickCode = code;
      wheelUi.setInfo(info(wheel.pick));
    }
    if (!input.down('gadgetWheel')) closeWheel(true);
  }

  // combat's useGadget hook. Returns true when the buffered press is used up.
  function fire(ctx, opts = {}) {
    const id = state.equipped;
    const h = byId.get(id);
    if (!h || wheel.open) return true;
    if (!h.manualSpend && !state.ready(id)) {
      const g = gadgetById(id);
      sys.hint(g.kind === 'charges' ? 'gadget-empty' : 'gadget-cooldown', g.name);
      return true;
    }
    const ok = h.fire(sys, ctx, opts);
    if (ok && !h.manualSpend) { state.use(id); events.emit('gadgetUse', { id }); }
    return ok || !h.retry;
  }

  function update(real, dt, ctx) {
    state.tick(dt);
    updateNews(real);
    updateWheel();
    ctx.lockInput = wheel.open;
    sys.wheelOpen = wheel.open;
    for (const h of handlers) h.update?.(sys, real, dt, ctx);
    const id = state.equipped;
    const code = state.hudCode(id) + (state.ready(id) ? 0.5 : 0);
    if (code !== hudCode) {
      hudCode = code;
      gadgetHud.set(state.status(id, st), bindingLabel(getBindings(), 'batarang'));
    }
  }

  // A pause, the help screen or photo mode: shut the wheel without equipping and drop every time
  // hold, so slow time never survives into a menu or out the other side of one.
  function halt() {
    closeWheel(false);
    time.releaseAll();
  }
  // Play stopped (a cutscene, the finale, a death, a new run): as halt, and drop anything in flight.
  function interrupt() {
    halt();
    for (const h of handlers) h.cancel?.(sys);
  }
  events.on('heroDown', interrupt);
  events.on('cutscene', (e) => { if (e?.on) interrupt(); });
  events.on('photoOpen', halt);

  return {
    state, fire, update, equip, openWheel, closeWheel, unlockCheck, halt, interrupt,
    helpList(bindings) {
      return GADGETS.map((g) => (state.isUnlocked(g.id)
        ? { name: g.name, html: promptText(g.promptId, bindings) }
        : { name: '???', html: g.unlockText }));
    },
    handler: (id) => byId.get(id) ?? null,
    refresh() { hudCode = -1; },
    get wheelOpen() { return wheel.open; },
    get cameraFocus() { return sys.cameraFocus; },
    get cameraMode() { return sys.cameraMode; },
    get debug() {
      return { equipped: state.equipped, wheel: wheel.open, pick: wheel.pick, unlocked: [...state.unlocked], held: time.held, status: GADGET_IDS.map((id) => ({ ...state.status(id) })) };
    },
  };
}
