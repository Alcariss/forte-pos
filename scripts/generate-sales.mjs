// Deterministic generator for data/sales.json
// Produces 4 weeks of daily sales per menu item using a seeded PRNG so the
// dataset is reproducible. Dev-only; not loaded by the app at runtime.
//
//   node scripts/generate-sales.mjs
//
// Model note: weekday is 0=Mon .. 6=Sun (see docs/data-model.md).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const recipes = JSON.parse(readFileSync(join(root, "data/recipes.json"), "utf8"));

// Seeded PRNG (mulberry32) — same seed => same output.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(12345);

// Base daily volume per recipe.
const BASE = {
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

// Weekday multiplier, index 0=Mon .. 6=Sun.
const WEEKDAY_FACTOR = [0.8, 0.85, 0.9, 1.0, 1.3, 1.5, 1.2];

const DAYS = 28;
const END = new Date("2026-08-12T00:00:00Z");

const rows = [];
for (let d = DAYS - 1; d >= 0; d--) {
  const date = new Date(END);
  date.setUTCDate(END.getUTCDate() - d);
  const iso = date.toISOString().slice(0, 10);
  const weekday = (date.getUTCDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0

  for (const r of recipes) {
    const base = BASE[r.id] ?? 5;
    const noise = 0.85 + 0.3 * rand(); // 0.85 .. 1.15
    const qty = Math.max(0, Math.round(base * WEEKDAY_FACTOR[weekday] * noise));
    rows.push({ date: iso, recipe_id: r.id, qty, weekday });
  }
}

writeFileSync(join(root, "data/sales.json"), JSON.stringify(rows, null, 2) + "\n");
console.log(`Wrote ${rows.length} sales rows to data/sales.json`);
