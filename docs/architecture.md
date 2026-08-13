# Architecture

Forte is a **static, dependency-free** single-page prototype. Everything runs in
the browser; JSON files stand in for what a real product would serve from a
database and API.

## High-level view

```
┌──────────────────────────────────────────────────────────────┐
│                          index.html                          │
│   app shell · role switcher · view container · nav           │
└───────────────┬──────────────────────────────────────────────┘
                │ imports (ES modules)
   ┌────────────┼─────────────────────────────────────────────┐
   │            │                                              │
┌──▼───────┐ ┌──▼─────────┐ ┌───────────┐ ┌───────────┐ ┌──────▼─────┐
│ data.js  │ │ allergens  │ │ foodcost  │ │  prep.js  │ │  roles.js  │
│ (loader) │ │   .js (F1) │ │  .js (F2) │ │   (F3)    │ │ (surfaces) │
└──┬───────┘ └────────────┘ └───────────┘ └───────────┘ └────────────┘
   │ fetch()
┌──▼──────────────────────────────────────────────────────────┐
│  data/*.json  — ingredients, allergens, recipes, suppliers,  │
│                 sales, roles  (read-only mock store)         │
└──────────────────────────────────────────────────────────────┘
```

## Layering rules

1. **Logic modules are pure.** `allergens.js`, `foodcost.js`, and `prep.js`
   export functions that take plain data in and return plain data out. They do
   **not** touch the DOM, `fetch`, or globals. This is what makes them testable
   under `node --test` with no browser.
2. **`data.js` is the only I/O boundary.** It `fetch()`es the JSON files and
   hands parsed objects to the logic and UI. In tests we bypass it and import the
   JSON directly.
3. **UI/glue (`app.js`) is the only DOM layer.** It wires the role switcher to
   the logic outputs and renders with template literals. No business rules live
   here.

## Why this shape

- The same logic runs in the browser and in CI tests — one implementation, two
  execution contexts.
- Each logic module is a candidate microservice/endpoint later; the function
  signatures are effectively an API contract.
- Swapping the JSON loader for real `fetch('/api/...')` calls is a one-file change.

## Testing strategy

- `node --test` discovers `tests/*.test.js`.
- Tests import the logic modules **and** the JSON fixtures directly (via
  `node:fs`), so they exercise the real seed data.
- Each requirement ID in `requirements/requirements.yaml` has at least one
  assertion referencing it in a test name.

## Deployment

GitHub Pages, `main` branch, root folder. `.nojekyll` disables Jekyll so all
files are served verbatim. No build, no Actions required (though a link-check
Action could be added later).
