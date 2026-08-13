# Forte — the smart kitchen POS

> A prototype restaurant point-of-sale concept for the **Piano** group
> (Septim / Qerko family). The name is a nod to the instrument's full name,
> the *pianoforte*: **Piano** for the group, **Forte** for strength.

Forte is not "just another cash register." It differentiates on three things a
Czech restaurant actually loses sleep over:

1. **Allergen & dietary intelligence** — allergens derived from recipe
   ingredients, not hand-maintained labels. Filter the menu by what a guest
   *can* eat, and auto-generate the legally required allergen matrix.
2. **Real-time food cost engine** — live food-cost % and margin per dish as
   ingredient prices change, with alerts when a dish slips below target margin.
3. **Smart prep & waste reduction** — demand-based prep lists and waste logging
   so the kitchen makes the right amount and measures what it throws away.

All three share one data model (ingredients → recipes → sales), so the prototype
is deliberately small but coherent.

---

## Status

Early prototype. Static site: **HTML + CSS + vanilla JS**, with **JSON files as a
mock data store**. No backend, no build step, no runtime dependencies.

## Why vanilla (no framework)

- GitHub Pages serves static files — vanilla means push-to-deploy, zero build.
- Feature logic lives in pure **ES modules** that run unchanged in the browser
  and in **Node's built-in test runner** (`node --test`).
- The logic modules double as an executable spec for a future real backend.

## Run locally

```bash
# any static server works; this repo ships a convenience script
npm run serve      # -> http://localhost:8080
# or
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Tests

```bash
npm test           # runs node --test against tests/*.test.js
```

## Roles

The prototype ships a **role switcher** (top-right) to demo three hard-coded
surfaces without authentication. Each is also deep-linkable via the URL hash:

| Role      | Route       | Sees                                                        |
|-----------|-------------|-------------------------------------------------------------|
| Waiter    | `#waiter`   | Order screen with guest allergen/diet filter + a live order |
| Chef      | `#chef`     | Kitchen ticket board (allergen conflicts flagged), prep list, waste, allergen matrix |
| Manager   | `#manager`  | Food-cost dashboard with a live market simulator, margin alerts, waste |

## Demo features

Two thin "make it live" threads sit on top of the three core features:

- **Allergen-aware order thread** — the waiter builds an order carrying the
  guest's allergen profile and sends it to the kitchen. The Chef ticket flags any
  line whose dish contains an allergen the guest asked to avoid — the safety net
  at the pass. State is cached in `localStorage`, so it survives reloads and even
  **syncs across two browser windows** (open `#waiter` and `#chef` side by side to
  fake a handheld → kitchen display).
- **Demo mode** (Manager view) — a single **“Simulate market changes”** button
  advances a bounded, mean-reverting price walk with occasional named shocks
  (dairy shortage, salmon import spike). Food-cost %, margins, and alerts recompute
  live on each click. It's **deterministic** (fixed seed), so a rehearsed demo
  repeats: click ~6 times and a cheese shock tips a second dish into a margin
  alert, then it reverts. Reset returns prices to baseline.

## Project layout

```
forte-pos/
├── index.html              # app shell
├── assets/
│   ├── css/                # design tokens + components (Piano-inspired)
│   ├── js/                 # ES modules (logic + UI)
│   └── img/                # logo, icons
├── data/                   # JSON mock store (ingredients, recipes, sales …)
├── scripts/                # dev-only helpers (seeded sales generator)
├── requirements/
│   └── requirements.yaml   # structured core requirements
├── docs/                   # architecture, data model, design, testing, deploy
├── tests/                  # node --test suites for the logic modules
└── .github/workflows/      # CI (node --test)
```

## Requirements

Core product requirements are tracked as structured YAML in
[`requirements/requirements.yaml`](requirements/requirements.yaml).

## Documentation

- [Architecture](docs/architecture.md) — layering, why vanilla, testing strategy
- [Data model](docs/data-model.md) — entities, files, invariants
- [Design system](docs/design-system.md) — the "Pianoforte" palette & components
- [Testing](docs/testing.md) — how the suites map to requirement IDs
- [Deploy](docs/deploy.md) — GitHub Pages setup and deep links

## License

MIT — see [LICENSE](LICENSE). Prototype only; not affiliated with or endorsed by
Piano, Septim, or Qerko.
