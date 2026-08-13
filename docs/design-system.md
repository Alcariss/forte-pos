# Design system — "Pianoforte"

Piano.cz blocks scraping, so the visual language here is derived from the
**Piano brand concept** rather than copied pixel-for-pixel: a premium, restrained
aesthetic fitting the Septim group's fine-dining clientele (Michelin venues),
built around the metaphor of a piano — **black keys, ivory keys, brass pedals**.

## Palette

| Token            | Value      | Use                                        |
|------------------|------------|--------------------------------------------|
| `--ink`          | `#16181d`  | Piano black — primary text, top bar, brand |
| `--ink-soft`     | `#2b2f36`  | Elevated dark surfaces                      |
| `--ivory`        | `#faf8f3`  | App background (ivory key)                   |
| `--surface`      | `#ffffff`  | Cards, panels                                |
| `--line`         | `#e7e2d8`  | Hairline borders                             |
| `--muted`        | `#6b7280`  | Secondary text                               |
| `--brass`        | `#b8873b`  | Accent — brand highlights, active nav        |
| `--brass-soft`   | `#f0e6d2`  | Accent tint backgrounds                      |
| `--safe`         | `#1f8a5b`  | Allergen SAFE, healthy margin                |
| `--warn`         | `#e08a1e`  | Watch / near-threshold                       |
| `--danger`       | `#d23b4e`  | CONTAINS allergen, margin breach             |

Semantic colours are **functional, not decorative** — the allergen and food-cost
features depend on green/amber/red to convey state at a glance.

## Typography

- **Display / brand:** `"Fraunces", Georgia, serif` — a warm high-contrast serif
  that reads "hospitality," used for the wordmark and section titles.
- **UI / body:** `"Manrope", system-ui, sans-serif` — clean, legible on small
  touch targets.
- Fonts load from Google Fonts with a system fallback so the app still renders if
  offline.

## Scale & spacing

- Base font 16px; modular scale ~1.2.
- Spacing tokens: `--s1: 4px … --s6: 32px` (4-point grid).
- Radius: `--r: 12px` cards, `--r-sm: 8px` controls; generous but not playful.

## Components

- **Top bar:** piano-black, brand wordmark left, role switcher right.
- **Cards:** white surface, hairline border, soft shadow; the workhorse.
- **Pills/badges:** allergen chips and diet tags; colour-coded by semantics.
- **Stat tiles:** large number + label for the manager dashboard.
- **Data tables:** the allergen matrix and cost table; sticky header, zebra rows.

## Responsive intent

- **Phone (waiter):** single column, big touch targets, bottom-safe spacing.
- **Tablet (kitchen):** two-column prep/matrix.
- **Desktop (manager):** multi-tile dashboard grid.

Breakpoints: 480 / 768 / 1024 px.

## Accessibility

- Never rely on colour alone — pair semantic colour with an icon or text label
  (e.g. "CONTAINS" text next to the red chip).
- Visible focus rings (`--brass`), semantic landmarks, and ARIA on the role
  switcher and tables.
