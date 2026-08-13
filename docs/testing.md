# Testing

All feature logic is written as **pure functions** so it can be unit-tested with
**Node's built-in test runner** — no Jest, no Babel, no dependencies.

## Run

```bash
npm test        # == node --test  (discovers tests/*.test.js)
```

## What is covered

| Suite                         | Feature | Requirements exercised            |
|-------------------------------|---------|-----------------------------------|
| `tests/data-integrity.test.js`| data    | referential integrity, units, EU-14 |
| `tests/allergens.test.js`     | F1      | F1-R1 … F1-R6                     |
| `tests/foodcost.test.js`      | F2      | F2-R1 … F2-R6                     |
| `tests/prep.test.js`          | F3      | F3-R1 … F3-R4                     |

Test names reference the requirement IDs from
[`requirements/requirements.yaml`](../requirements/requirements.yaml), so the
suite doubles as living traceability.

## Conventions

- Tests import the **real** JSON fixtures from `/data` (via `node:fs`), not
  hand-made mocks, so they validate the shipped seed data too.
- Logic modules never touch the DOM or `fetch`, which is what makes them
  runnable under Node unchanged.
- Numeric assertions use a small `approx()` helper to avoid floating-point
  brittleness.

## Continuous integration

`.github/workflows/ci.yml` runs `node --test` on every push to `main` and on
pull requests. There is nothing to install — the run is dependency-free.
