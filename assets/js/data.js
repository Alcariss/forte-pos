// Data layer — the only I/O boundary in the app (see docs/architecture.md).
// Loads the JSON mock store and builds lookup indexes. Tests bypass this and
// import the JSON directly.
import { indexIngredients } from "./allergens.js";

const FILES = ["allergens", "suppliers", "ingredients", "recipes", "sales", "roles"];

/**
 * Fetch and parse all JSON files, returning the store plus prebuilt indexes.
 * @returns {Promise<object>}
 */
export async function loadStore() {
  const entries = await Promise.all(
    FILES.map(async (name) => {
      const res = await fetch(`data/${name}.json`);
      if (!res.ok) throw new Error(`Failed to load data/${name}.json (${res.status})`);
      return [name, await res.json()];
    }),
  );
  const store = Object.fromEntries(entries);

  store.ingredientIndex = indexIngredients(store.ingredients);
  store.recipeIndex = new Map(store.recipes.map((r) => [r.id, r]));
  store.allergenIndex = new Map(store.allergens.map((a) => [a.code, a]));
  return store;
}
