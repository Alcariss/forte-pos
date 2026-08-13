# Data model

The prototype's "database" is a set of read-only JSON files in [`/data`](../data).
They are intentionally small but realistic for a Czech pub/restaurant menu.

## Entity relationships

```
supplier ─┐
          │ 1
          ▼ n
      ingredient ──< allergens (EU codes 1..14)
          │ n
          │ (component: qty + unit)
          ▼
        recipe (sellable menu item)
          │ 1
          ▼ n
         sale (historical, per day)
```

## Files

### `allergens.json`
The 14 EU-mandated allergens (Regulation 1169/2011). Reference data.
```json
{ "code": "1", "name": "Gluten", "icon": "🌾" }
```

### `suppliers.json`
```json
{ "id": "sup-makro", "name": "Makro" }
```

### `ingredients.json`
The heart of the model. Allergens live **here**, not on the recipe — that is what
lets allergen info propagate automatically (requirement F1-R2). Price history lets
the food cost engine reflect spikes (F2-R6).
```json
{
  "id": "ing-butter",
  "name": "Butter",
  "unit": "g",
  "pack_price_czk": 180,
  "pack_size": 1000,
  "supplier_id": "sup-makro",
  "allergens": ["7"],
  "price_history": [
    { "date": "2026-07-01", "pack_price_czk": 160 },
    { "date": "2026-08-01", "pack_price_czk": 180 }
  ]
}
```
- **unit cost** = `pack_price_czk / pack_size` → 180 / 1000 = 0.18 CZK per g.

### `recipes.json`
A sellable item composed of ingredient lines. No allergens are stored here; they
are computed. `target_food_cost_pct` drives the margin alert (F2-R5).
```json
{
  "id": "rec-schnitzel",
  "name": "Wiener Schnitzel",
  "category": "Mains",
  "price_czk": 249,
  "target_food_cost_pct": 0.32,
  "diet_tags": [],
  "components": [
    { "ingredient_id": "ing-pork-loin", "qty": 200, "unit": "g" },
    { "ingredient_id": "ing-flour", "qty": 40, "unit": "g" },
    { "ingredient_id": "ing-egg", "qty": 1, "unit": "pcs" },
    { "ingredient_id": "ing-breadcrumbs", "qty": 60, "unit": "g" }
  ]
}
```

### `sales.json`
Historical sales used by the forecast (F3-R1). One row per item per day.
```json
{ "date": "2026-08-07", "recipe_id": "rec-schnitzel", "qty": 18, "weekday": 3 }
```

### `roles.json`
Hard-coded personas for the UI role switcher (no auth in the prototype).

## Units & money

- Quantities use `g`, `ml`, or `pcs`. Components must use the same unit as their
  ingredient — the prototype does not convert units.
- All money is **CZK**, integer or one-decimal; costs are rounded for display
  only, never in intermediate math.

## Invariants (enforced by tests)

- Every `component.ingredient_id` resolves to an ingredient.
- Every `ingredient.supplier_id` resolves to a supplier.
- Every `ingredient.allergens[*]` is a valid allergen `code`.
- Every `sale.recipe_id` resolves to a recipe.
