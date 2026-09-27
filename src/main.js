import './ui/style.css';
import MANSI from './mansi.config.js';
import { startLookTest } from './lookTest.js';
import { startGame } from './game/game.js';

const params = new URLSearchParams(location.search);
const loading = document.getElementById('loading');
document.getElementById('loading-name').textContent = MANSI.name;

if (matchMedia('(pointer: coarse)').matches && !params.has('force')) {
  loading.classList.add('mobile');
} else {
  const bar = loading.querySelector('.bar i');
  const start = params.has('look') ? startLookTest : startGame;
  start({
    canvas: document.getElementById('game'),
    hudRoot: document.body,
    params,
    onProgress: (f) => { bar.style.animation = 'none'; bar.style.width = `${Math.round(f * 100)}%`; },
  })
    .then(() => loading.remove())
    .catch((err) => { console.error(err); loading.classList.add('error'); });
}
