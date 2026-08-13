// Feature 1 — Allergen & dietary intelligence (F1)
// Pure functions: no DOM, no I/O. See requirements F1-R1..R6.
//
// The key idea (F1-R2): a recipe's allergens are DERIVED from its ingredients,
// never stored on the recipe. Change an ingredient's allergens and every
// dependent dish updates automatically.

/**
 * Build a Map of ingredient id -> ingredient for O(1) lookup.
 * @param {Array} ingredients
 * @returns {Map<string, object>}
 */
export function indexIngredients(ingredients) {
  return new Map(ingredients.map((i) => [i.id, i]));
}

/**
 * F1-R1 / F1-R2: derive the set of allergen codes for a recipe as the union of
 * its ingredients' allergens.
 * @param {object} recipe
 * @param {Map<string, object>} ingredientIndex
 * @returns {string[]} sorted unique allergen codes
 */
export function recipeAllergens(recipe, ingredientIndex) {
  const codes = new Set();
  for (const c of recipe.components) {
    const ing = ingredientIndex.get(c.ingredient_id);
    if (!ing) continue;
    for (const a of ing.allergens) codes.add(a);
  }
  return [...codes].sort((a, b) => Number(a) - Number(b));
}

/**
 * F1-R3: classify a recipe against a set of allergens the guest must avoid.
 * @param {object} recipe
 * @param {Map<string, object>} ingredientIndex
 * @param {Iterable<string>} avoid allergen codes to avoid
 * @returns {{ status: "safe"|"contains", offending: string[], allergens: string[] }}
 */
export function classifyRecipe(recipe, ingredientIndex, avoid = []) {
  const avoidSet = new Set([...avoid].map(String));
  const allergens = recipeAllergens(recipe, ingredientIndex);
  const offending = allergens.filter((a) => avoidSet.has(a));
  return {
    status: offending.length ? "contains" : "safe",
    offending,
    allergens,
  };
}

/**
 * Does a recipe satisfy the given diet tags (e.g. ["vegan"])?
 * All requested tags must be present on the recipe.
 * @param {object} recipe
 * @param {Iterable<string>} diets
 * @returns {boolean}
 */
export function matchesDiet(recipe, diets = []) {
  const tags = new Set(recipe.diet_tags || []);
  for (const d of diets) if (!tags.has(d)) return false;
  return true;
}

/**
 * F1-R4 / F1-R6: filter a menu to only the items a guest CAN eat, given
 * allergens to avoid and required diet tags. Positive framing by design.
 * @param {Array} recipes
 * @param {Map<string, object>} ingredientIndex
 * @param {{ avoid?: string[], diets?: string[] }} opts
 * @returns {Array} recipes that are safe AND match the diet
 */
export function safeMenu(recipes, ingredientIndex, { avoid = [], diets = [] } = {}) {
  return recipes.filter((r) => {
    if (!matchesDiet(r, diets)) return false;
    return classifyRecipe(r, ingredientIndex, avoid).status === "safe";
  });
}

/**
 * F1-R5: build the compliance matrix — every recipe against all 14 allergens.
 * @param {Array} recipes
 * @param {Map<string, object>} ingredientIndex
 * @param {Array} allergens the allergen reference list (with `code`)
 * @returns {{ columns: object[], rows: object[] }}
 *   rows: { recipe, present: Set<string>, cells: boolean[] }
 */
export function allergenMatrix(recipes, ingredientIndex, allergens) {
  const columns = [...allergens].sort((a, b) => Number(a.code) - Number(b.code));
  const rows = recipes.map((recipe) => {
    const present = new Set(recipeAllergens(recipe, ingredientIndex));
    const cells = columns.map((col) => present.has(col.code));
    return { recipe, present, cells };
  });
  return { columns, rows };
}
