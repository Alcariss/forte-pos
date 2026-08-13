// Tests for Feature 2 — Real-time food cost engine
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { indexIngredients } from "../assets/js/allergens.js";
import {
  latestPackPrice,
  unitCost,
  plateCost,
  foodCostPct,
  analyzeRecipe,
  analyzeMenu,
  marginAlerts,
} from "../assets/js/foodcost.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(root, "data", f), "utf8"));

const ingredients = load("ingredients.json");
const recipes = load("recipes.json");
const byId = (id) => recipes.find((r) => r.id === id);
const ingById = (id) => ingredients.find((i) => i.id === id);
const idx = indexIngredients(ingredients);

const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test("F2-R6: latestPackPrice uses the most recent history entry", () => {
  assert.equal(latestPackPrice(ingById("ing-butter")), 180); // 150 -> 160 -> 180
});

test("F2-R6: latestPackPrice falls back to pack_price_czk when no history", () => {
  assert.equal(latestPackPrice(ingById("ing-flour")), 200);
});

test("F2-R1: unitCost = latest pack price / pack size", () => {
  assert.ok(approx(unitCost(ingById("ing-butter")), 180 / 1000)); // 0.18/g
  assert.ok(approx(unitCost(ingById("ing-egg")), 4)); // 120/30 CZK per pcs
});

test("F2-R2: plateCost sums component qty x unit cost", () => {
  // schnitzel: pork 200*0.15 + flour 40*0.02 + egg 1*4 + crumbs 60*0.03 + oil 30*0.04
  const expected = 200 * 0.15 + 40 * 0.02 + 1 * 4 + 60 * 0.03 + 30 * 0.04;
  assert.ok(approx(plateCost(byId("rec-schnitzel"), idx), expected));
});

test("F2-R3 & F2-R4: foodCostPct and margin are internally consistent", () => {
  const a = analyzeRecipe(byId("rec-schnitzel"), idx);
  assert.ok(approx(a.foodCostPct, a.plateCost / a.price));
  assert.ok(approx(a.marginCzk, a.price - a.plateCost));
  assert.ok(approx(a.marginPct, a.marginCzk / a.price));
});

test("F2-R5: salmon breaches its target and is flagged danger", () => {
  const a = analyzeRecipe(byId("rec-salmon"), idx);
  assert.ok(a.foodCostPct > a.target, "over target");
  assert.equal(a.status, "danger");
  assert.equal(a.overTarget, true);
});

test("F2-R5: caesar sits in the warn band (near but under target)", () => {
  const a = analyzeRecipe(byId("rec-caesar"), idx);
  assert.ok(a.foodCostPct <= a.target, "not over target");
  assert.equal(a.status, "warn");
});

test("F2-R6: a butter price spike raises dependent salmon food-cost %", () => {
  const cheaper = ingredients.map((i) =>
    i.id === "ing-butter"
      ? { ...i, price_history: [{ date: "2026-06-01", pack_price_czk: 100 }] }
      : i,
  );
  const cheapIdx = indexIngredients(cheaper);
  const low = foodCostPct(byId("rec-salmon"), cheapIdx);
  const high = foodCostPct(byId("rec-salmon"), idx); // butter now 180
  assert.ok(high > low, "spike increases food cost %");
});

test("F2: analyzeMenu is sorted worst-first and marginAlerts lists breaches", () => {
  const menu = analyzeMenu(recipes, idx);
  for (let i = 1; i < menu.length; i++) {
    assert.ok(menu[i - 1].foodCostPct >= menu[i].foodCostPct, "descending fc%");
  }
  const alerts = marginAlerts(recipes, idx);
  assert.ok(alerts.some((a) => a.recipe.id === "rec-salmon"));
  assert.ok(alerts.every((a) => a.overTarget));
});
