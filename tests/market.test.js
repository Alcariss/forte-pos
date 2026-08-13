// Tests for the market change generator
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { indexIngredients } from "../assets/js/allergens.js";
import { plateCost, latestPackPrice } from "../assets/js/foodcost.js";
import {
  makeRng,
  baselineOverlay,
  nextPrices,
  applyScenario,
  stepMarket,
  describeMoves,
  applyOverlay,
  VOLATILITY,
} from "../assets/js/market.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(root, "data", f), "utf8"));

const ingredients = load("ingredients.json");
const recipes = load("recipes.json");
const byId = (id) => recipes.find((r) => r.id === id);
const ingById = (id) => ingredients.find((i) => i.id === id);

test("baselineOverlay equals each ingredient's current price", () => {
  const o = baselineOverlay(ingredients);
  assert.equal(o["ing-butter"], latestPackPrice(ingById("ing-butter"))); // 180
  assert.equal(o["ing-flour"], 200);
});

test("makeRng is deterministic for a given seed", () => {
  const a = makeRng(42);
  const b = makeRng(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test("nextPrices keeps prices within clamp bounds over many ticks", () => {
  let overlay = baselineOverlay(ingredients);
  const rng = makeRng(7);
  for (let i = 0; i < 500; i++) overlay = nextPrices(overlay, ingredients, rng);
  for (const id of Object.keys(VOLATILITY)) {
    const baseline = latestPackPrice(ingById(id));
    assert.ok(overlay[id] >= baseline * 0.6 - 1e-6, `${id} below floor`);
    assert.ok(overlay[id] <= baseline * 1.6 + 1e-6, `${id} above ceiling`);
  }
});

test("nextPrices leaves non-volatile (staple) ingredients unchanged", () => {
  let overlay = baselineOverlay(ingredients);
  const rng = makeRng(3);
  for (let i = 0; i < 50; i++) overlay = nextPrices(overlay, ingredients, rng);
  assert.equal(overlay["ing-flour"], 200);
  assert.equal(overlay["ing-sugar"], 150);
});

test("applyScenario moves a targeted ingredient by the given percent", () => {
  const overlay = baselineOverlay(ingredients);
  const next = applyScenario(overlay, { label: "x", moves: [{ id: "ing-butter", pct: 0.15 }] });
  assert.equal(next["ing-butter"], Math.round(overlay["ing-butter"] * 1.15 * 100) / 100);
  assert.equal(next["ing-flour"], overlay["ing-flour"]); // untouched
});

test("stepMarket is deterministic in (tick, seed)", () => {
  const overlay = baselineOverlay(ingredients);
  const a = stepMarket(overlay, ingredients, 5, 1);
  const b = stepMarket(overlay, ingredients, 5, 1);
  assert.deepEqual(a.overlay, b.overlay);
  assert.equal(a.event, b.event);
});

test("applyOverlay changes F2 plate cost without mutating seed data", () => {
  const overlay = baselineOverlay(ingredients);
  overlay["ing-salmon-fillet"] = overlay["ing-salmon-fillet"] * 1.5; // spike salmon
  const priced = applyOverlay(ingredients, overlay);
  const idxBase = indexIngredients(ingredients);
  const idxPriced = indexIngredients(priced);
  const before = plateCost(byId("rec-salmon"), idxBase);
  const after = plateCost(byId("rec-salmon"), idxPriced);
  assert.ok(after > before, "spike raises plate cost");
  // seed array untouched
  assert.equal(ingById("ing-salmon-fillet").pack_price_czk, 900);
});

test("describeMoves reports direction and magnitude for core ingredients", () => {
  const prev = baselineOverlay(ingredients);
  const next = { ...prev, "ing-butter": prev["ing-butter"] * 1.1 };
  const moves = describeMoves(prev, next, ingredients);
  const butter = moves.find((m) => m.id === "ing-butter");
  assert.ok(butter);
  assert.equal(butter.dir, "up");
  assert.ok(Math.abs(butter.pct - 0.1) < 1e-6);
});
