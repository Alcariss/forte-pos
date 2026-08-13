// Tests for Feature 1 — Allergen & dietary intelligence
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  indexIngredients,
  recipeAllergens,
  classifyRecipe,
  matchesDiet,
  safeMenu,
  allergenMatrix,
} from "../assets/js/allergens.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(root, "data", f), "utf8"));

const allergens = load("allergens.json");
const ingredients = load("ingredients.json");
const recipes = load("recipes.json");
const byId = (id) => recipes.find((r) => r.id === id);
const idx = indexIngredients(ingredients);

test("F1-R1: schnitzel allergens are the union of its ingredients (gluten, eggs)", () => {
  const a = recipeAllergens(byId("rec-schnitzel"), idx);
  assert.deepEqual(a, ["1", "3"]); // gluten from flour/breadcrumbs, eggs from egg
});

test("F1-R1: lentil curry has no allergens", () => {
  assert.deepEqual(recipeAllergens(byId("rec-lentil-curry"), idx), []);
});

test("F1-R2: flipping an ingredient's allergen propagates to dependent recipes", () => {
  // Clone ingredients and add peanuts (5) to butter; salmon uses butter.
  const mutated = ingredients.map((i) =>
    i.id === "ing-butter" ? { ...i, allergens: [...i.allergens, "5"] } : i,
  );
  const mIdx = indexIngredients(mutated);
  assert.ok(!recipeAllergens(byId("rec-salmon"), idx).includes("5"), "clean before");
  assert.ok(recipeAllergens(byId("rec-salmon"), mIdx).includes("5"), "contains after");
});

test("F1-R3: classifyRecipe flags offending allergens", () => {
  const res = classifyRecipe(byId("rec-caesar"), idx, ["4"]); // avoid fish
  assert.equal(res.status, "contains");
  assert.deepEqual(res.offending, ["4"]);
});

test("F1-R3: classifyRecipe returns safe when nothing offends", () => {
  const res = classifyRecipe(byId("rec-fries"), idx, ["1", "7"]);
  assert.equal(res.status, "safe");
  assert.deepEqual(res.offending, []);
});

test("F1-R4: safeMenu returns only items the guest can eat (avoid gluten+milk)", () => {
  const menu = safeMenu(recipes, idx, { avoid: ["1", "7"] });
  const ids = menu.map((r) => r.id);
  assert.ok(ids.includes("rec-lentil-curry"));
  assert.ok(ids.includes("rec-fries"));
  assert.ok(!ids.includes("rec-schnitzel")); // gluten
  assert.ok(!ids.includes("rec-fried-cheese")); // milk + gluten
});

test("F1-R6: matchesDiet + safeMenu combine allergen and diet filters", () => {
  assert.equal(matchesDiet(byId("rec-lentil-curry"), ["vegan"]), true);
  assert.equal(matchesDiet(byId("rec-schnitzel"), ["vegan"]), false);
  const veganNoGluten = safeMenu(recipes, idx, { avoid: ["1"], diets: ["vegan"] });
  const ids = veganNoGluten.map((r) => r.id);
  assert.ok(ids.includes("rec-lentil-curry"));
  assert.ok(!ids.includes("rec-pilsner")); // gluten
});

test("F1-R5: allergenMatrix has 14 columns and one row per recipe", () => {
  const { columns, rows } = allergenMatrix(recipes, idx, allergens);
  assert.equal(columns.length, 14);
  assert.equal(rows.length, recipes.length);
  const schnitzel = rows.find((r) => r.recipe.id === "rec-schnitzel");
  const glutenCol = columns.findIndex((c) => c.code === "1");
  const peanutCol = columns.findIndex((c) => c.code === "5");
  assert.equal(schnitzel.cells[glutenCol], true);
  assert.equal(schnitzel.cells[peanutCol], false);
});
