// Exports Mixamo clips (on the account's primary character, Y Bot by default) as FBX with skin,
// 30 fps, no keyframe reduction, and saves them to assets-src/mixamo/<Clip>.fbx (git-ignored:
// Mixamo's terms allow the moves in a game, not redistribution of the files).
// Needs a Chrome the owner is logged into Mixamo in, started with --remote-debugging-port=9555
// and its own --user-data-dir. Everything runs as page scripts in that tab: no clicks, no typing,
// and the session token never leaves the page.
//   node scripts/mixamo-fetch.mjs [ClipName ...]   (no names: the whole list)
// Then: node scripts/fbx2glb.mjs assets-src/mixamo/*.fbx, and scripts/retarget-mocap.mjs --map mixamo.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Clip name in the game: [Mixamo name, start of its description].
export const MIXAMO_CLIPS = {
  // Batman's strikes (replace the code-posed ones of the same name).
  Punch_Jab: ['Lead Jab', 'Med Head Jab'],
  Punch_Cross: ['Cross Punch', 'A Cross Punch'],
  Punch_Hook_L: ['Boxing', 'Boxing Lead Hand Hook'],
  Punch_Uppercut: ['Boxing', 'Boxing Back Hand Uppercut'],
  Elbow_Strike: ['Elbow Punching', 'Male Elbow Punch'],
  Melee_Hook: ['Hook Punch', 'A Hook Punch'],
  Kick_Side: ['Mma Kick', 'Mma Side Kick'],
  Kick_Low: ['Mma Kick', 'Mma Low Kick'],
  Kick_Axe: ['Martelo 2', 'Capoeira High Kick'],
  Kick_Flip: ['Flip Kick', 'Front Flip To Kick'],
  Hero_Throw: ['Shoulder Throw, Aggressor', 'Throwing Opponent Over The Shoulder'],
  // Compared on film against the motion-captured clips already in the game.
  Kick_Round_MX: ['Mma Kick', 'Mma Roundhouse Kick'],
  Kick_Front_MX: ['Kicking', 'Male Front Snap Kick With The Lead Foot'],
  Knee_Strike_MX: ['Illegal Knee', 'Muay Thai Illegal Knee'],
  Kick_Spin_MX: ['Mma Kick', 'Mma Spinning Back Kick'],
  Roll_MX: ['Stand To Roll', 'Dive Roll From Standing'],
  // Goons.
  Goon_Fight_Idle: ['Fighting Idle', 'Male Fight Idle Boxing Stance'],
  Goon_Bounce_Idle: ['Bouncing Fight Idle', 'Bouncing Fight Idle With Guard Up'],
  Goon_Strafe_L: ['Left Strafe Walk', 'Walking Strafe To The Left'],
  Goon_Strafe_R: ['Right Strafe Walk', 'Walking Strafe To The Right'],
  Goon_Hook: ['Hook', 'Long Hook Punch To The Head'],
  Goon_Cross: ['Punching', 'Cross Punch'],
  Goon_Haymaker: ['Right Hook', 'Right Hook Punch From Idle'],
  Goon_Stab: ['Stabbing', 'Male Knife Stab With The Rear Hand And R'],
  Goon_Knife_Idle: ['Knife Idle', 'Knife On The Rear Hand'],
  Goon_Overhead: ['Bash', 'Overhead Bashing Swing'],
  Goon_Headbutt: ['Illegal Headbutt', 'Illegal Headbutt With Step'],
  Goon_Taunt_A: ['Taunt', 'Taunting Throwing Arms Back'],
  Goon_Taunt_B: ['Threatening', 'Being Threatening While Standing'],
  // Reactions (shared by everyone on the skeleton).
  Hit_Head: ['Medium Hit To Head', 'Receiving A Medium Hit From A Straight'],
  Hit_Head_Snap: ['Receiving An Uppercut', 'Getting Hit By An Uppercut'],
  Hit_Chest: ['Hit Reaction', 'Receive Punch To The Body'],
  Hit_Gut_Fold: ['Stomach Hit', 'Receiving A Hit In The Stomach'],
  Hit_Spin: ['Big Hit To Head', 'Receiving A Big Hit From A Left Punch'],
  Hit_Knockback: ['Stunned', 'Male Knocked Down From A Punch'],
  Goon_GetUp: ['Getting Up', 'Getting Up From Back'],
  Sweep_Fall: ['Sweep Fall', 'Getting Feet Swept Out'],
  Fall_Flat: ['Fall Flat', 'Falling Flat On Face From A Hit'],
  Goon_Thrown: ['Shoulder Throw, Victim', 'Thrown Over The Shoulder'],
  Getting_Thrown: ['Getting Thrown', 'Being Thrown To The Side'],
};

// One clip, inside the page: find it, export it, return the link to the finished FBX.
const exportOne = async ([name, desc]) => {
  const token = localStorage.getItem('access_token');
  if (!token) return { error: 'not logged in' };
  const H = { Authorization: `Bearer ${token}`, 'X-Api-Key': 'mixamo2', 'Content-Type': 'application/json', Accept: 'application/json' };
  const api = async (p, init = {}) => {
    const r = await fetch('https://www.mixamo.com/api/v1/' + p, { ...init, headers: H });
    if (!r.ok) throw new Error(`${p.split('?')[0]}: HTTP ${r.status}`);
    return r.json();
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const { primary_character_id: charId } = await api('characters/primary');
    const found = await api(`products?page=1&limit=96&order=&type=Motion&query=${encodeURIComponent(name)}`);
    const lc = (s) => (s ?? '').toLowerCase();
    const hit = (found.results ?? []).find((x) => lc(x.name) === lc(name) && lc(x.description).startsWith(lc(desc)));
    if (!hit) return { error: `not found: ${name} [${desc}]` };
    const prod = await api(`products/${hit.id}?similar=0&character_id=${charId}`);
    const gms = prod.details.gms_hash;
    const gmsHash = { ...gms, params: (gms.params ?? []).map((q) => q[1]).join(','), overdrive: 0, mirror: false, trim: gms.trim ?? [0, 100] };
    await api('animations/export', { method: 'POST', body: JSON.stringify({ character_id: charId, gms_hash: [gmsHash], preferences: { format: 'fbx7_2019', skin: 'true', fps: '30', reducekf: '0' }, product_name: hit.name, type: 'Motion' }) });
    let url = null;
    for (let i = 0; i < 80 && !url; i++) {
      await sleep(1500);
      const m = await api(`characters/${charId}/monitor`);
      if (m.status === 'completed') url = m.job_result;
      else if (m.status === 'failed') return { error: 'export failed' };
    }
    if (!url) return { error: 'export timed out' };
    // The finished export is a signed link on another host (the page itself may not read it):
    // Node downloads it.
    return { url, title: `${hit.name} [${hit.description}]` };
  } catch (err) { return { error: err.message }; }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dir = path.join(ROOT, 'assets-src', 'mixamo');
  mkdirSync(dir, { recursive: true });
  const want = process.argv.slice(2);
  const list = Object.entries(MIXAMO_CLIPS).filter(([k]) => !want.length || want.includes(k));
  const b = await chromium.connectOverCDP('http://127.0.0.1:9555');
  const page = b.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('mixamo.com'));
  if (!page) { console.error('no mixamo.com tab in the Chrome on :9555'); process.exit(1); }
  for (const [clip, spec] of list) {
    const file = path.join(dir, clip + '.fbx');
    if (existsSync(file) && !want.length) { console.log(`${clip}: already have it`); continue; }
    // Mixamo rate-limits exports (HTTP 429): back off and retry, and pace every clip.
    let r = null;
    for (let tries = 0; tries < 6; tries++) {
      r = await page.evaluate(exportOne, spec);
      if (!r.error?.includes('429')) break;
      await new Promise((ok) => setTimeout(ok, 30000 + tries * 30000));
    }
    await new Promise((ok) => setTimeout(ok, 6000));
    if (r.error) { console.log(`${clip}: ${r.error}`); continue; }
    const res = await fetch(r.url);
    if (!res.ok) { console.log(`${clip}: download HTTP ${res.status}`); continue; }
    const bytes = Buffer.from(await res.arrayBuffer());
    writeFileSync(file, bytes);
    console.log(`${clip}: ${r.title} (${(bytes.length / 1024).toFixed(0)} KB)`);
  }
  process.exit(0); // disconnect only: the owner's browser stays open
}
