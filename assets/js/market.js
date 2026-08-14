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

// Curated market events. Each "Simulate market changes" click applies ONE event
// (cycled deterministically so a demo is rehearsable) as a target multiplier
// RELATIVE TO BASELINE. Applying relative to baseline makes the effect predictable
// and decisive: a "salmon down" event reliably drops the salmon plate cost enough
// to pull the dish out of the red, and "salmon up" pushes it deeper in.
export const EVENTS = [
  { label: "Norwegian glut \u2014 salmon down", set: { "ing-salmon-fillet": 0.78 } },
  { label: "Dairy shortage \u2014 butter up", set: { "ing-butter": 1.3 } },
  { label: "Cheese prices climb", set: { "ing-parmesan": 1.2, "ing-edam-cheese": 1.15 } },
  { label: "Beef supply tight \u2014 beef up", set: { "ing-beef-sirloin": 1.2 } },
  { label: "Salmon import spike \u2014 salmon up", set: { "ing-salmon-fillet": 1.18 } },
  { label: "Good harvest \u2014 oil down", set: { "ing-oil": 0.8 } },
  { label: "Cheap dairy \u2014 butter down", set: { "ing-butter": 0.78 } },
  { label: "Beef glut \u2014 beef down", set: { "ing-beef-sirloin": 0.84 } },
];

const FADE = 0.4; // each click, prices not touched by the event drift back toward baseline

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
 * Advance the market one click. Deterministic in (tick, seed): event N is chosen
 * by cycling EVENTS, applied relative to baseline; other volatile prices fade back
 * toward baseline. Returns { overlay, moves, event }.
 */
export function stepMarket(overlay, ingredients, tick, seed = 1) {
  const rng = makeRng((seed ^ (tick * 0x9e3779b1)) >>> 0);
  const baseIdx = new Map(ingredients.map((i) => [i.id, latestPackPrice(i)]));
  const event = EVENTS[(((tick - 1) % EVENTS.length) + EVENTS.length) % EVENTS.length];
  const eventIds = new Set(Object.keys(event.set));

  const next = { ...overlay };
  // Fade previous swings back toward baseline, except what this event drives.
  for (const id of Object.keys(VOLATILITY)) {
    if (next[id] == null || eventIds.has(id)) continue;
    const base = baseIdx.get(id);
    next[id] = Math.round((next[id] + (base - next[id]) * FADE) * 100) / 100;
  }
  // Apply this event relative to baseline, with a little jitter, clamped to bounds.
  for (const [id, mult] of Object.entries(event.set)) {
    const base = baseIdx.get(id);
    if (base == null) continue;
    const jitter = 1 + (rng() * 2 - 1) * 0.02;
    let p = base * mult * jitter;
    p = Math.min(base * 1.6, Math.max(base * 0.6, p));
    next[id] = Math.round(p * 100) / 100;
  }
  const moves = describeMoves(overlay, next, ingredients);
  return { overlay: next, moves, event: event.label };
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

// --- day simulation: generate one day of sales -----------------------------
// Base daily volume per recipe and a weekday multiplier (0=Mon..6=Sun), mirroring
// scripts/generate-sales.mjs so simulated days blend with the seed history.
const BASE_SALES = {
  "rec-schnitzel": 16,
  "rec-svickova": 14,
  "rec-goulash": 12,
  "rec-fried-cheese": 10,
  "rec-salmon": 8,
  "rec-lentil-curry": 6,
  "rec-caesar": 7,
  "rec-garlic-soup": 9,
  "rec-fries": 20,
  "rec-pilsner": 60,
  "rec-lemonade": 15,
};
const WEEKDAY_FACTOR = [0.8, 0.85, 0.9, 1.0, 1.3, 1.5, 1.2];

/**
 * Deterministically generate one simulated day of sales rows for every recipe.
 * @param {Array} recipes
 * @param {number} dayIndex 1-based index of the simulated day (drives the PRNG)
 * @param {string} dateIso YYYY-MM-DD for the day
 * @param {number} weekday 0=Mon .. 6=Sun
 * @param {number} seed
 * @returns {Array<{date, recipe_id, qty, weekday}>}
 */
export function nextDaySales(recipes, dayIndex, dateIso, weekday, seed = 1) {
  const rng = makeRng((seed ^ (dayIndex * 0x85ebca6b)) >>> 0);
  return recipes.map((r) => {
    const base = BASE_SALES[r.id] ?? 5;
    const noise = 0.85 + 0.3 * rng();
    const qty = Math.max(0, Math.round(base * WEEKDAY_FACTOR[weekday] * noise));
    return { date: dateIso, recipe_id: r.id, qty, weekday };
  });
}
