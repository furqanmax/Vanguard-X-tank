// Visual quality tiers. These only change how the game looks, never what it simulates.
export const QUALITY = {
  low: { label: 'Low', pixel: 1, shadows: false, shadowSize: 512, fog: [220, 650], effects: 0.5 },
  medium: { label: 'Medium', pixel: 1.5, shadows: true, shadowSize: 1024, fog: [200, 700], effects: 0.8 },
  high: { label: 'High', pixel: 2, shadows: true, shadowSize: 2048, fog: [180, 900], effects: 1 },
};
