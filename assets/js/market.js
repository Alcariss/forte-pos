// Demo slice — Market change generator
// Pure functions: no DOM, no timers. Simulates moving ingredient prices so the
// manager dashboard (F2) recomputes live. Prices are never written back to the
// seed JSON — the generator maintains an OVERLAY (ingredient_id -> pack price).
import { latestPackPrice } from "./foodcost.js";

// Per-ingredient volatility (max fractional move per tick). Only "core"
// ingredients move; staples like flour/sugar stay flat.
export const VOLATILITY = {
  "ing-salmon-fillet": 0.06,
  "ing-butter": 0.05,
  "ing-parmesan": 0.05,
  "ing-beef-sirloin": 0.04,
  "ing-edam-cheese": 0.04,
  "ing-pork-loin": 0.03,
  "ing-oil": 0.03,
};

// Emoji for the ticker strip.
export const ICONS = {
  "ing-salmon-fillet": "🐟",
  "ing-butter": "🧈",
  "ing-beef-sirloin": "🥩",
  "ing-pork-loin": "🐷",
  "ing-oil": "🫒",
  "ing-edam-cheese": "🧀",
  "ing-parmesan": "🧀",
};

// Named shocks that occasionally fire, for narrative colour.
export const SCENARIOS = [
  { label: "Dairy shortage — butter up", moves: [{ id: "ing-butter", pct: 0.15 }] },
  { label: "Import costs — salmon up", moves: [{ id: "ing-salmon-fillet", pct: 0.12 }] },
  { label: "Cheese prices climb", moves: [{ id: "ing-parmesan", pct: 0.16 }, { id: "ing-edam-cheese", pct: 0.12 }] },
  { label: "Beef supply tight", moves: [{ id: "ing-beef-sirloin", pct: 0.1 }] },
  { label: "Good harvest — oil down", moves: [{ id: "ing-oil", pct: -0.08 }] },
];

const CLAMP_LOW = 0.6; // never below 60% of baseline
const CLAMP_HIGH = 1.6; // never above 160% of baseline
const REVERSION = 0.15; // pull back toward baseline each tick

/** Seeded PRNG (mulberry32) — deterministic for rehearsable demos. */
export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Baseline overlay = each ingredient's current seed price. Tick 0 == dashboard. */
export function baselineOverlay(ingredients) {
  const o = {};
  for (const ing of ingredients) o[ing.id] = latestPackPrice(ing);
  return o;
}

/** One tick of the bounded, mean-reverting random walk. Returns a new overlay. */
export function nextPrices(overlay, ingredients, rng, opts = {}) {
  const reversion = opts.reversion ?? REVERSION;
  const baseIdx = new Map(ingredients.map((i) => [i.id, latestPackPrice(i)]));
  const next = { ...overlay };
  for (const id of Object.keys(overlay)) {
    const vol = VOLATILITY[id] ?? 0;
    if (vol === 0) continue; // staple — stays put
    const baseline = baseIdx.get(id) ?? overlay[id];
    const current = overlay[id];
    const revert = ((baseline - current) / baseline) * reversion;
    const shock = (rng() * 2 - 1) * vol;
    let p = current * (1 + revert + shock);
    p = Math.min(baseline * CLAMP_HIGH, Math.max(baseline * CLAMP_LOW, p));
    next[id] = Math.round(p * 100) / 100;
  }
  return next;
}

/** Apply a named scenario's percentage moves. Returns a new overlay. */
export function applyScenario(overlay, scenario) {
  const next = { ...overlay };
  for (const m of scenario.moves) {
    if (next[m.id] != null) next[m.id] = Math.round(next[m.id] * (1 + m.pct) * 100) / 100;
  }
  return next;
}

/**
 * Advance the market one step. Deterministic in (tick, seed): a shock may fire
 * with low probability. Returns { overlay, moves, event }.
 */
export function stepMarket(overlay, ingredients, tick, seed = 1) {
  const rng = makeRng((seed ^ (tick * 0x9e3779b1)) >>> 0);
  let next = nextPrices(overlay, ingredients, rng);
  let event = null;
  if (rng() < 0.18) {
    const scenario = SCENARIOS[Math.floor(rng() * SCENARIOS.length)];
    next = applyScenario(next, scenario);
    event = scenario.label;
  }
  const moves = describeMoves(overlay, next, ingredients);
  return { overlay: next, moves, event };
}

/** Diff two overlays into ticker-ready move descriptors for core ingredients. */
export function describeMoves(prev, next, ingredients) {
  const nameIdx = new Map(ingredients.map((i) => [i.id, i.name]));
  const moves = [];
  for (const id of Object.keys(next)) {
    if (!(id in VOLATILITY)) continue;
    const a = prev[id];
    const b = next[id];
    if (a == null || b == null || a === b) continue;
    const pct = (b - a) / a;
    if (Math.abs(pct) < 0.001) continue;
    moves.push({ id, name: nameIdx.get(id) ?? id, icon: ICONS[id] ?? "", pct, dir: pct > 0 ? "up" : "down" });
  }
  return moves.sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct));
}

/**
 * Produce a new ingredients array with overlay prices applied, without mutating
 * the seed data. Feed the result through indexIngredients() for the F2 engine.
 */
export function applyOverlay(ingredients, overlay) {
  if (!overlay) return ingredients;
  return ingredients.map((ing) =>
    overlay[ing.id] != null ? { ...ing, pack_price_czk: overlay[ing.id], price_history: [] } : ing,
  );
}
