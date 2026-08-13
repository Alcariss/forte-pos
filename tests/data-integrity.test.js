// Data integrity tests — enforce the invariants documented in docs/data-model.md
// against the real seed data in /data. Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(root, "data", f), "utf8"));

const allergens = load("allergens.json");
const suppliers = load("suppliers.json");
const ingredients = load("ingredients.json");
const recipes = load("recipes.json");
const sales = load("sales.json");

const allergenCodes = new Set(allergens.map((a) => a.code));
const supplierIds = new Set(suppliers.map((s) => s.id));
const ingredientIds = new Set(ingredients.map((i) => i.id));
const recipeIds = new Set(recipes.map((r) => r.id));

test("allergens.json contains exactly the 14 EU allergens", () => {
  assert.equal(allergens.length, 14);
  for (let n = 1; n <= 14; n++) assert.ok(allergenCodes.has(String(n)), `missing ${n}`);
});

test("every ingredient.supplier_id resolves to a supplier", () => {
  for (const ing of ingredients) {
    assert.ok(supplierIds.has(ing.supplier_id), `${ing.id} -> ${ing.supplier_id}`);
  }
});

test("every ingredient.allergens[*] is a valid allergen code", () => {
  for (const ing of ingredients) {
    for (const code of ing.allergens) {
      assert.ok(allergenCodes.has(code), `${ing.id} has bad allergen ${code}`);
    }
  }
});

test("every recipe component.ingredient_id resolves to an ingredient", () => {
  for (const rec of recipes) {
    for (const c of rec.components) {
      assert.ok(ingredientIds.has(c.ingredient_id), `${rec.id} -> ${c.ingredient_id}`);
    }
  }
});

test("every recipe component uses its ingredient's unit", () => {
  const unitOf = new Map(ingredients.map((i) => [i.id, i.unit]));
  for (const rec of recipes) {
    for (const c of rec.components) {
      assert.equal(c.unit, unitOf.get(c.ingredient_id), `${rec.id}/${c.ingredient_id} unit`);
    }
  }
});

test("every sale.recipe_id resolves to a recipe and weekday is 0..6", () => {
  for (const s of sales) {
    assert.ok(recipeIds.has(s.recipe_id), `sale -> ${s.recipe_id}`);
    assert.ok(s.weekday >= 0 && s.weekday <= 6, `weekday ${s.weekday}`);
  }
});
