const PRESETS = {
  high: { name: 'high', pixelRatioCap: 2, normalScale: 1, shadows: true, shadowMapSize: 2048, rainCount: 2500,
    comic: { wobble: 1, hatch: 1, midDots: 1, skyDots: 1, colorEdges: 1, misreg: 1, palette: 0.35, paper: 1 } },
  low: { name: 'low', pixelRatioCap: 1, normalScale: 0.5, shadows: false, shadowMapSize: 0, rainCount: 850,
    comic: { wobble: 0, hatch: 0, midDots: 0, skyDots: 0, colorEdges: 0, misreg: 0, palette: 0, paper: 0 } },
};

export function getQuality(name) {
  return PRESETS[name] ?? PRESETS.high;
}
