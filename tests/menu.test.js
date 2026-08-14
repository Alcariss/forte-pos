// Tests for menu engineering + the day-sales generator
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { indexIngredients } from "../assets/js/allergens.js";
import { salesInWindow, unitsByRecipe, menuEngineering } from "../assets/js/menu.js";
import { nextDaySales } from "../assets/js/market.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(root, "data", f), "utf8"));
const ingredients = load("ingredients.json");
const recipes = load("recipes.json");
const sales = load("sales.json");
const idx = indexIngredients(ingredients);

test("salesInWindow returns only the N days ending on endDate", () => {
  const w = salesInWindow(sales, "2026-08-12", 7);
  const dates = [...new Set(w.map((s) => s.date))].sort();
  assert.equal(dates[0], "2026-08-06");
  assert.equal(dates.at(-1), "2026-08-12");
  assert.equal(dates.length, 7);
});

test("unitsByRecipe sums quantities per recipe", () => {
  const rows = [
    { recipe_id: "a", qty: 3 },
    { recipe_id: "a", qty: 2 },
    { recipe_id: "b", qty: 5 },
  ];
  const m = unitsByRecipe(rows);
  assert.equal(m.get("a"), 5);
  assert.equal(m.get("b"), 5);
});

test("menuEngineering classifies the four quadrants (synthetic data)", () => {
  const ings = [
    { id: "i1", unit: "g", pack_price_czk: 100, pack_size: 100, allergens: [], price_history: [] },
  ];
  const ix = indexIngredients(ings);
  const cheap = [{ ingredient_id: "i1", qty: 10, unit: "g" }]; // cost 10 -> margin 90
  const dear = [{ ingredient_id: "i1", qty: 90, unit: "g" }]; // cost 90 -> margin 10
  const recs = [
    { id: "A", name: "A", price_czk: 100, components: cheap }, // hi margin
    { id: "B", name: "B", price_czk: 100, components: dear }, // lo margin
    { id: "C", name: "C", price_czk: 100, components: cheap }, // hi margin
    { id: "D", name: "D", price_czk: 100, components: dear }, // lo margin
  ];
  const salesRows = [
    { date: "2026-01-01", recipe_id: "A", qty: 100 },
    { date: "2026-01-01", recipe_id: "B", qty: 100 },
    { date: "2026-01-01", recipe_id: "C", qty: 1 },
    { date: "2026-01-01", recipe_id: "D", qty: 1 },
  ];
  const { rows } = menuEngineering(recs, ix, salesRows);
  const q = Object.fromEntries(rows.map((r) => [r.recipe.id, r.quadrant]));
  assert.equal(q.A, "star"); // popular + profitable
  assert.equal(q.B, "plowhorse"); // popular + thin margin
  assert.equal(q.C, "puzzle"); // unpopular + profitable
  assert.equal(q.D, "dog"); // unpopular + thin margin
});

test("menuEngineering on real data: one row per recipe, valid quadrants", () => {
  const { rows, popThreshold, avgMargin } = menuEngineering(recipes, idx, sales, {
    endDate: "2026-08-12",
    windowDays: 7,
  });
  assert.equal(rows.length, recipes.length);
  const valid = new Set(["star", "plowhorse", "puzzle", "dog"]);
  for (const r of rows) assert.ok(valid.has(r.quadrant), `${r.recipe.id} -> ${r.quadrant}`);
  assert.ok(popThreshold > 0);
  assert.ok(avgMargin > 0);
});

test("nextDaySales is deterministic and shaped correctly", () => {
  const a = nextDaySales(recipes, 1, "2026-08-13", 2, 1);
  const b = nextDaySales(recipes, 1, "2026-08-13", 2, 1);
  assert.deepEqual(a, b);
  assert.equal(a.length, recipes.length);
  for (const row of a) {
    assert.equal(row.date, "2026-08-13");
    assert.equal(row.weekday, 2);
    assert.ok(row.qty >= 0);
  }
  // a different day differs
  const c = nextDaySales(recipes, 2, "2026-08-14", 3, 1);
  assert.notDeepEqual(a, c);
});
