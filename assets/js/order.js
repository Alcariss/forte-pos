// Demo slice — Allergen-aware order thread
// Pure functions: no DOM, no I/O. The order carries the guest's allergen
// profile so the kitchen ticket can flag a dish the guest asked to avoid.
import { classifyRecipe } from "./allergens.js";

/** A fresh, empty order. */
export function emptyOrder() {
  return { lines: [] };
}

/** Add qty of a dish (merges with an existing line). Returns a new order. */
export function addLine(order, recipeId, qty = 1) {
  const lines = order.lines.map((l) => ({ ...l }));
  const existing = lines.find((l) => l.recipe_id === recipeId);
  if (existing) existing.qty += qty;
  else lines.push({ recipe_id: recipeId, qty });
  return { ...order, lines };
}

/** Set an explicit qty; a qty <= 0 removes the line. Returns a new order. */
export function setQty(order, recipeId, qty) {
  const lines = order.lines
    .map((l) => (l.recipe_id === recipeId ? { ...l, qty } : { ...l }))
    .filter((l) => l.qty > 0);
  return { ...order, lines };
}

/** Remove a dish from the order. Returns a new order. */
export function removeLine(order, recipeId) {
  return { ...order, lines: order.lines.filter((l) => l.recipe_id !== recipeId) };
}

/** Total number of items in the order. */
export function orderCount(order) {
  return order.lines.reduce((n, l) => n + l.qty, 0);
}

/** Order value in CZK. */
export function orderTotal(order, recipeIndex) {
  return order.lines.reduce((sum, l) => {
    const r = recipeIndex.get(l.recipe_id);
    return sum + (r ? r.price_czk * l.qty : 0);
  }, 0);
}

/**
 * Snapshot the current order + guest profile into an immutable kitchen ticket.
 * The guest profile is copied so later filter changes don't mutate sent tickets.
 */
export function createTicket(order, guest = {}, { id, createdAt } = {}) {
  return {
    id: id ?? `T-${Date.now()}`,
    createdAt: createdAt ?? new Date().toISOString(),
    guest: { avoid: [...(guest.avoid ?? [])], diets: [...(guest.diets ?? [])] },
    lines: order.lines.map((l) => ({ ...l })),
  };
}

/**
 * Annotate a ticket's lines with allergen conflicts against the guest profile.
 * A conflict means the dish contains an allergen the guest asked to avoid —
 * the safety net that catches a mis-keyed order at the pass.
 */
export function annotateTicket(ticket, recipeIndex, ingredientIndex) {
  const avoid = ticket.guest?.avoid ?? [];
  const lines = ticket.lines.map((l) => {
    const recipe = recipeIndex.get(l.recipe_id);
    const cls = recipe
      ? classifyRecipe(recipe, ingredientIndex, avoid)
      : { status: "safe", offending: [], allergens: [] };
    return {
      ...l,
      name: recipe?.name ?? l.recipe_id,
      allergens: cls.allergens,
      offending: cls.offending,
      conflict: cls.offending.length > 0,
    };
  });
  return { ...ticket, lines, hasConflict: lines.some((l) => l.conflict) };
}

/**
 * Generate a random guest profile for the waiter demo: 1..maxAllergens unique
 * allergen codes drawn from the supplied pool. `rng` is injectable for testing.
 */
export function randomGuestProfile(allergenCodes, rng = Math.random, maxAllergens = 3) {
  const pool = [...allergenCodes];
  const count = Math.min(pool.length, 1 + Math.floor(rng() * maxAllergens));
  const avoid = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    avoid.push(pool.splice(idx, 1)[0]);
  }
  avoid.sort((a, b) => Number(a) - Number(b));
  return { avoid, diets: [] };
}
