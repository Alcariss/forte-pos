// Tests for Feature 3 — Smart prep & waste reduction
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { indexIngredients } from "../assets/js/allergens.js";
import { plateCost } from "../assets/js/foodcost.js";
import {
  forecastForWeekday,
  roundToBatch,
  buildPrepList,
  valueWaste,
  summariseWaste,
} from "../assets/js/prep.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(root, "data", f), "utf8"));

const ingredients = load("ingredients.json");
const recipes = load("recipes.json");
const sales = load("sales.json");
const idx = indexIngredients(ingredients);
const recipeIndex = new Map(recipes.map((r) => [r.id, r]));
const byId = (id) => recipes.find((r) => r.id === id);
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test("F3-R1: forecast equals the moving average of that weekday's sales", () => {
  const weekday = 4; // Saturday in our 0=Mon scheme
  const samples = sales
    .filter((s) => s.recipe_id === "rec-schnitzel" && s.weekday === weekday)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-4)
    .map((s) => s.qty);
  const expected = samples.reduce((a, b) => a + b, 0) / samples.length;
  assert.ok(approx(forecastForWeekday("rec-schnitzel", weekday, sales, 4), expected));
});

test("F3-R1: unknown recipe/weekday forecasts zero", () => {
  assert.equal(forecastForWeekday("rec-nope", 2, sales), 0);
});

test("F3-R2: roundToBatch rounds up to the batch size", () => {
  assert.equal(roundToBatch(0, 5), 0);
  assert.equal(roundToBatch(1, 5), 5);
  assert.equal(roundToBatch(11, 5), 15);
  assert.equal(roundToBatch(20, 5), 20);
});

test("F3-R2: prep list produces per-item and aggregate ingredient quantities", () => {
  const { items, ingredients: ingList } = buildPrepList(recipes, idx, sales, { weekday: 3 });
  assert.equal(items.length, recipes.length);
  for (const it of items) assert.ok(it.prepQty >= it.forecast, "prep rounds up");

  // Flour is shared by several recipes; its aggregate must equal the manual sum.
  const flour = ingList.find((i) => i.ingredient_id === "ing-flour");
  let manual = 0;
  for (const it of items) {
    const comp = it.recipe.components.find((c) => c.ingredient_id === "ing-flour");
    if (comp) manual += comp.qty * it.prepQty;
  }
  assert.ok(approx(flour.qty, manual));
});

test("F3-R3: valueWaste equals qty x plate cost", () => {
  const v = valueWaste({ recipe_id: "rec-schnitzel", qty: 3, reason: "burnt" }, recipeIndex, idx);
  const unit = plateCost(byId("rec-schnitzel"), idx);
  assert.ok(approx(v.unitCost, unit));
  assert.ok(approx(v.costCzk, unit * 3));
});

test("F3-R4: summariseWaste totals CZK and ranks offenders by cost", () => {
  const entries = [
    { recipe_id: "rec-schnitzel", qty: 2, reason: "burnt" },
    { recipe_id: "rec-salmon", qty: 1, reason: "returned" },
    { recipe_id: "rec-schnitzel", qty: 1, reason: "dropped" },
  ];
  const { totalCzk, byItem } = summariseWaste(entries, recipeIndex, idx);
  const schnitzelUnit = plateCost(byId("rec-schnitzel"), idx);
  const salmonUnit = plateCost(byId("rec-salmon"), idx);
  assert.ok(approx(totalCzk, schnitzelUnit * 3 + salmonUnit * 1));
  // schnitzel aggregated across two entries -> qty 3
  const schnitzel = byItem.find((b) => b.recipe_id === "rec-schnitzel");
  assert.equal(schnitzel.qty, 3);
  // sorted by cost descending
  for (let i = 1; i < byItem.length; i++) {
    assert.ok(byItem[i - 1].costCzk >= byItem[i].costCzk);
  }
});
