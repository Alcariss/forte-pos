// Feature 3 — Smart prep & waste reduction (F3)
// Pure functions: no DOM, no I/O. See requirements F3-R1..R4.
//
// Forecasting is a deliberately simple, explainable moving average over the
// SAME weekday — a kitchen can understand and trust it, unlike a black box.

import { plateCost } from "./foodcost.js";

/**
 * F3-R1: forecast demand for a recipe on a given weekday as the moving average
 * of that weekday's historical sales (most recent `window` samples).
 * @param {string} recipeId
 * @param {number} weekday 0=Mon .. 6=Sun
 * @param {Array} sales
 * @param {number} window how many past same-weekday samples to average
 * @returns {number} forecast quantity (not rounded)
 */
export function forecastForWeekday(recipeId, weekday, sales, window = 4) {
  const samples = sales
    .filter((s) => s.recipe_id === recipeId && s.weekday === weekday)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-window)
    .map((s) => s.qty);
  if (!samples.length) return 0;
  const sum = samples.reduce((a, b) => a + b, 0);
  return sum / samples.length;
}

/**
 * Round a forecast up to a sensible batch size so the kitchen preps whole,
 * practical quantities.
 * @param {number} qty
 * @param {number} batch
 * @returns {number}
 */
export function roundToBatch(qty, batch = 5) {
  if (qty <= 0) return 0;
  return Math.ceil(qty / batch) * batch;
}

/**
 * F3-R2: build a prep list for a target weekday: forecast per item (rounded to
 * batch) plus the aggregate ingredient quantities required to prep it.
 * @param {Array} recipes
 * @param {Map<string, object>} ingredientIndex
 * @param {Array} sales
 * @param {{ weekday: number, window?: number, batch?: number }} opts
 * @returns {{ items: object[], ingredients: object[] }}
 */
export function buildPrepList(recipes, ingredientIndex, sales, { weekday, window = 4, batch = 5 } = {}) {
  const items = [];
  const ingredientTotals = new Map(); // ingredient_id -> qty

  for (const recipe of recipes) {
    const forecast = forecastForWeekday(recipe.id, weekday, sales, window);
    const prepQty = roundToBatch(forecast, batch);
    items.push({ recipe, forecast, prepQty });
    if (prepQty <= 0) continue;
    for (const c of recipe.components) {
      const prev = ingredientTotals.get(c.ingredient_id) || 0;
      ingredientTotals.set(c.ingredient_id, prev + c.qty * prepQty);
    }
  }

  const ingredients = [...ingredientTotals.entries()]
    .map(([id, qty]) => {
      const ing = ingredientIndex.get(id);
      return { ingredient_id: id, name: ing?.name ?? id, unit: ing?.unit ?? "", qty };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { items, ingredients };
}

/**
 * F3-R3: value a single waste entry using the food cost engine.
 * @param {{ recipe_id: string, qty: number, reason?: string }} entry
 * @param {Map<string, object>} recipeIndex
 * @param {Map<string, object>} ingredientIndex
 * @returns {{ recipe_id, qty, reason, unitCost: number, costCzk: number }}
 */
export function valueWaste(entry, recipeIndex, ingredientIndex) {
  const recipe = recipeIndex.get(entry.recipe_id);
  const unit = recipe ? plateCost(recipe, ingredientIndex) : 0;
  return {
    recipe_id: entry.recipe_id,
    qty: entry.qty,
    reason: entry.reason ?? "",
    unitCost: unit,
    costCzk: unit * entry.qty,
  };
}

/**
 * F3-R4: summarise a list of waste entries — total CZK and top offenders.
 * @param {Array} entries
 * @param {Map<string, object>} recipeIndex
 * @param {Map<string, object>} ingredientIndex
 * @returns {{ totalCzk: number, byItem: object[] }}
 */
export function summariseWaste(entries, recipeIndex, ingredientIndex) {
  const valued = entries.map((e) => valueWaste(e, recipeIndex, ingredientIndex));
  const totalCzk = valued.reduce((a, v) => a + v.costCzk, 0);

  const byItemMap = new Map();
  for (const v of valued) {
    const prev = byItemMap.get(v.recipe_id) || { recipe_id: v.recipe_id, qty: 0, costCzk: 0 };
    prev.qty += v.qty;
    prev.costCzk += v.costCzk;
    byItemMap.set(v.recipe_id, prev);
  }
  const byItem = [...byItemMap.values()].sort((a, b) => b.costCzk - a.costCzk);

  return { totalCzk, byItem };
}
