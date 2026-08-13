// Tests for the allergen-aware order thread
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { indexIngredients } from "../assets/js/allergens.js";
import {
  emptyOrder,
  addLine,
  setQty,
  removeLine,
  orderCount,
  orderTotal,
  createTicket,
  annotateTicket,
} from "../assets/js/order.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(root, "data", f), "utf8"));

const ingredients = load("ingredients.json");
const recipes = load("recipes.json");
const idx = indexIngredients(ingredients);
const recipeIndex = new Map(recipes.map((r) => [r.id, r]));

test("addLine merges quantities for the same dish", () => {
  let o = emptyOrder();
  o = addLine(o, "rec-schnitzel");
  o = addLine(o, "rec-schnitzel", 2);
  assert.equal(o.lines.length, 1);
  assert.equal(o.lines[0].qty, 3);
  assert.equal(orderCount(o), 3);
});

test("setQty removes a line when qty drops to zero", () => {
  let o = addLine(emptyOrder(), "rec-fries", 2);
  o = setQty(o, "rec-fries", 0);
  assert.equal(o.lines.length, 0);
});

test("removeLine deletes a dish", () => {
  let o = addLine(addLine(emptyOrder(), "rec-fries"), "rec-pilsner");
  o = removeLine(o, "rec-fries");
  assert.deepEqual(
    o.lines.map((l) => l.recipe_id),
    ["rec-pilsner"],
  );
});

test("orderTotal sums price x qty", () => {
  let o = addLine(emptyOrder(), "rec-pilsner", 2); // 59 * 2
  o = addLine(o, "rec-fries", 1); // 59
  assert.equal(orderTotal(o, recipeIndex), 59 * 2 + 59);
});

test("createTicket snapshots the guest profile immutably", () => {
  const guest = { avoid: ["1"], diets: [] };
  const ticket = createTicket(addLine(emptyOrder(), "rec-schnitzel"), guest, {
    id: "T-1",
    createdAt: "2026-08-13T10:00:00Z",
  });
  guest.avoid.push("7"); // mutate original after snapshot
  assert.deepEqual(ticket.guest.avoid, ["1"]); // unaffected
});

test("annotateTicket flags a dish that conflicts with the guest profile", () => {
  // Guest avoids gluten (1); schnitzel contains gluten -> conflict.
  const ticket = createTicket(addLine(emptyOrder(), "rec-schnitzel"), { avoid: ["1"] }, { id: "T-2" });
  const annotated = annotateTicket(ticket, recipeIndex, idx);
  assert.equal(annotated.hasConflict, true);
  assert.equal(annotated.lines[0].conflict, true);
  assert.deepEqual(annotated.lines[0].offending, ["1"]);
});

test("annotateTicket marks a safe dish as no conflict", () => {
  const ticket = createTicket(addLine(emptyOrder(), "rec-lentil-curry"), { avoid: ["1", "7"] }, { id: "T-3" });
  const annotated = annotateTicket(ticket, recipeIndex, idx);
  assert.equal(annotated.hasConflict, false);
  assert.equal(annotated.lines[0].conflict, false);
});
