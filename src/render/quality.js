const PRESETS = {
  high: { name: 'high', pixelRatioCap: 2, normalScale: 1, shadows: true, shadowMapSize: 2048, rainCount: 6000 },
  low: { name: 'low', pixelRatioCap: 1, normalScale: 0.5, shadows: false, shadowMapSize: 0, rainCount: 2000 },
};

export function getQuality(name) {
  return PRESETS[name] ?? PRESETS.high;
}
