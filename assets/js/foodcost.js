// Feature 2 — Real-time food cost engine (F2)
// Pure functions: no DOM, no I/O. See requirements F2-R1..R6.
//
// "Real-time" here means: always cost from the LATEST price in an ingredient's
// price_history, so a supplier price spike is reflected immediately (F2-R6).

const STATUS_WARN_BAND = 0.9; // within 90-100% of target => "warn"

/**
 * F2-R6: the current pack price is the most recent price_history entry,
 * falling back to pack_price_czk when no history exists.
 * @param {object} ingredient
 * @returns {number} pack price in CZK
 */
export function latestPackPrice(ingredient) {
  const hist = ingredient.price_history;
  if (Array.isArray(hist) && hist.length) {
    const latest = [...hist].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
    return latest.pack_price_czk;
  }
  return ingredient.pack_price_czk;
}

/**
 * F2-R1: unit cost of an ingredient = latest pack price / pack size.
 * @param {object} ingredient
 * @returns {number} CZK per base unit (g / ml / pcs)
 */
export function unitCost(ingredient) {
  if (!ingredient.pack_size) return 0;
  return latestPackPrice(ingredient) / ingredient.pack_size;
}

/**
 * F2-R2: plate cost = sum of (component qty x ingredient unit cost).
 * @param {object} recipe
 * @param {Map<string, object>} ingredientIndex
 * @returns {number} CZK
 */
export function plateCost(recipe, ingredientIndex) {
  let total = 0;
  for (const c of recipe.components) {
    const ing = ingredientIndex.get(c.ingredient_id);
    if (!ing) continue;
    total += c.qty * unitCost(ing);
  }
  return total;
}

/**
 * F2-R3: food-cost % = plate cost / sell price.
 * @returns {number} fraction (0..1)
 */
export function foodCostPct(recipe, ingredientIndex) {
  if (!recipe.price_czk) return 0;
  return plateCost(recipe, ingredientIndex) / recipe.price_czk;
}

/**
 * F2-R4 / F2-R5: full analysis of one recipe.
 * status: "danger" if over target, "warn" if within the warn band, else "safe".
 * @returns {{
 *   recipe: object, plateCost: number, price: number,
 *   foodCostPct: number, marginCzk: number, marginPct: number,
 *   target: number, status: "safe"|"warn"|"danger", overTarget: boolean
 * }}
 */
export function analyzeRecipe(recipe, ingredientIndex) {
  const cost = plateCost(recipe, ingredientIndex);
  const price = recipe.price_czk;
  const fcPct = price ? cost / price : 0;
  const target = recipe.target_food_cost_pct ?? null;
  const marginCzk = price - cost;
  const marginPct = price ? marginCzk / price : 0;

  let status = "safe";
  let overTarget = false;
  if (target != null) {
    if (fcPct > target) {
      status = "danger";
      overTarget = true;
    } else if (fcPct >= target * STATUS_WARN_BAND) {
      status = "warn";
    }
  }

  return {
    recipe,
    plateCost: cost,
    price,
    foodCostPct: fcPct,
    marginCzk,
    marginPct,
    target,
    status,
    overTarget,
  };
}

/**
 * Analyze the whole menu, most expensive food-cost % first (worst offenders top).
 * @returns {Array} analyzeRecipe results
 */
export function analyzeMenu(recipes, ingredientIndex) {
  return recipes
    .map((r) => analyzeRecipe(r, ingredientIndex))
    .sort((a, b) => b.foodCostPct - a.foodCostPct);
}

/**
 * F2-R5: the dishes whose margin has slipped below target (status "danger").
 * @returns {Array} analyzeRecipe results that breach target
 */
export function marginAlerts(recipes, ingredientIndex) {
  return analyzeMenu(recipes, ingredientIndex).filter((a) => a.overTarget);
}
