// Comic-page cutscenes: panels slide in one at a time with captions and speech balloons.
// Click, Space, Enter or E advances; Esc skips the scene.

export function createComic(root, { onSound = () => {}, onVoice = () => {}, onEnd = () => {} } = {}) {
  const el = document.createElement('div');
  el.className = 'comic';
  el.innerHTML = '<div class="comic-page"></div><div class="comic-help">Click or press Space to continue. Esc skips.</div>';
  root.appendChild(el);
  const pageEl = el.querySelector('.comic-page');
  let resolver = null;
  let pages = [];
  let pageIndex = 0;
  let panelIndex = 0;
  let panelEls = [];

  function renderPage() {
    const page = pages[pageIndex];
    pageEl.innerHTML = '';
    pageEl.className = `comic-page layout-${page.layout ?? 'grid'}`;
    panelEls = page.panels.map((p, i) => {
      const panel = document.createElement('div');
      panel.className = `panel ${p.span ?? ''}`;
      panel.style.setProperty('--tilt', `${((i * 37) % 5) - 2}deg`.replace('--', '-'));
      if (p.img) {
        const im = document.createElement('img');
        im.src = typeof p.img === 'string' ? p.img : p.img.toDataURL('image/jpeg', 0.9);
        im.alt = '';
        panel.appendChild(im);
      }
      if (p.caption) {
        const c = document.createElement('div');
        c.className = `caption ${p.captionPos ?? 'top'}`;
        c.textContent = p.caption;
        panel.appendChild(c);
      }
      for (const b of p.balloons ?? []) {
        const s = document.createElement('div');
        s.className = `balloon tail-${b.tail ?? 'down'} ${b.shout ? 'shout' : ''} ${b.joker ? 'joker' : ''}`;
        s.style.left = `${b.x}%`;
        s.style.top = `${b.y}%`;
        if (b.w) s.style.maxWidth = `${b.w}%`;
        s.textContent = b.text;
        panel.appendChild(s);
      }
      if (p.sfx) {
        const w = document.createElement('div');
        w.className = 'panel-sfx';
        w.textContent = p.sfx;
        panel.appendChild(w);
      }
      pageEl.appendChild(panel);
      return panel;
    });
    panelIndex = 0;
    reveal();
  }

  function reveal() {
    panelEls[panelIndex]?.classList.add('in');
    onSound('uiMove');
    const v = pages[pageIndex]?.panels[panelIndex]?.voice;
    if (v) onVoice(v);
  }

  function advance() {
    if (!resolver) return;
    if (panelIndex < panelEls.length - 1) { panelIndex++; reveal(); return; }
    if (pageIndex < pages.length - 1) { pageIndex++; renderPage(); return; }
    finish();
  }

  function finish() {
    onEnd();
    el.classList.remove('show');
    const r = resolver;
    resolver = null;
    setTimeout(() => { pageEl.innerHTML = ''; }, 300);
    r?.();
  }

  const onKey = (e) => {
    if (!resolver) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); onSound('uiBack'); finish(); return; }
    if (['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); advance(); }
  };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('mousedown', (e) => { e.stopPropagation(); if (e.button === 0) advance(); });

  return {
    get playing() { return !!resolver; },
    play(scenePages) {
      pages = scenePages;
      pageIndex = 0;
      el.classList.add('show');
      renderPage();
      return new Promise((resolve) => { resolver = resolve; });
    },
    skip: finish,
  };
}
