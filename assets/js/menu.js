// Menu engineering (F2 + sales) — classify dishes by popularity x profitability.
// Pure functions: no DOM, no I/O. Uses the classic Kasavana-Smith method:
//   popularity  -> units sold in a rolling window; "popular" if >= 70% of the
//                  average per-item share (the 70% rule).
//   profitability -> unit contribution margin (price - plate cost); "high" if
//                  >= the average contribution margin across the menu.
import { analyzeRecipe } from "./foodcost.js";

/** Filter sales to the `days`-long window ending on endDateIso (inclusive). */
export function salesInWindow(sales, endDateIso, days = 7) {
  const end = new Date(endDateIso + "T00:00:00Z");
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));
  const startIso = start.toISOString().slice(0, 10);
  return sales.filter((s) => s.date >= startIso && s.date <= endDateIso);
}

/** Sum units sold per recipe id. */
export function unitsByRecipe(sales) {
  const m = new Map();
  for (const s of sales) m.set(s.recipe_id, (m.get(s.recipe_id) || 0) + s.qty);
  return m;
}

/**
 * Menu-engineering analysis. Optionally restrict sales to a rolling window.
 * @returns {{
 *   rows: Array<{recipe, units, marginCzk, foodCostPct, contributionCzk, quadrant}>,
 *   popThreshold: number, avgMargin: number, totalUnits: number, windowDays: number
 * }}
 * quadrant is one of: "star" | "plowhorse" | "puzzle" | "dog".
 */
export function menuEngineering(recipes, ingredientIndex, sales, { endDate, windowDays = 7 } = {}) {
  const windowSales = endDate ? salesInWindow(sales, endDate, windowDays) : sales;
  const units = unitsByRecipe(windowSales);

  const rows = recipes.map((r) => {
    const a = analyzeRecipe(r, ingredientIndex);
    const u = units.get(r.id) || 0;
    return {
      recipe: r,
      units: u,
      marginCzk: a.marginCzk,
      foodCostPct: a.foodCostPct,
      contributionCzk: a.marginCzk * u, // total contribution over the window
    };
  });

  const n = rows.length || 1;
  const totalUnits = rows.reduce((s, x) => s + x.units, 0);
  const popThreshold = 0.7 * (totalUnits / n); // 70% rule
  const avgMargin = rows.reduce((s, x) => s + x.marginCzk, 0) / n;

  for (const x of rows) {
    const hiPop = x.units >= popThreshold;
    const hiProf = x.marginCzk >= avgMargin;
    x.quadrant = hiPop ? (hiProf ? "star" : "plowhorse") : hiProf ? "puzzle" : "dog";
  }

  return { rows, popThreshold, avgMargin, totalUnits, windowDays };
}
