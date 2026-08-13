// App controller — state, role switcher, and the three role views.
// The only module that touches the DOM. Business rules live in the feature
// modules (allergens.js, foodcost.js, prep.js); this file only orchestrates.
import { loadStore } from "./data.js";
import { esc, czk, pct, WEEKDAYS, tomorrowWeekday, statusClass } from "./ui.js";
import { classifyRecipe, matchesDiet, allergenMatrix } from "./allergens.js";
import { analyzeMenu, marginAlerts } from "./foodcost.js";
import { buildPrepList, summariseWaste } from "./prep.js";

const state = {
  store: null,
  role: "waiter",
  avoid: new Set(), // allergen codes the guest avoids
  diets: new Set(), // required diet tags
  prepWeekday: tomorrowWeekday(),
  wasteLog: [], // { recipe_id, qty, reason } — in-memory only (no persistence)
};

const root = () => document.getElementById("view");

// --- small render helpers ---------------------------------------------------

function allergenChips(codes) {
  const { allergenIndex } = state.store;
  if (!codes.length) return `<span class="badge safe">No declared allergens</span>`;
  return `<span class="chips">${codes
    .map((c) => {
      const a = allergenIndex.get(c);
      return `<span class="chip" title="${esc(a?.name)}">${esc(a?.icon ?? "")} ${esc(a?.name ?? c)}</span>`;
    })
    .join("")}</span>`;
}

function dietBadges(recipe) {
  return (recipe.diet_tags || [])
    .map((t) => `<span class="badge diet">${esc(t)}</span>`)
    .join(" ");
}

function groupByCategory(recipes) {
  const map = new Map();
  for (const r of recipes) {
    if (!map.has(r.category)) map.set(r.category, []);
    map.get(r.category).push(r);
  }
  return map;
}

// --- WAITER: order screen with guest allergen/diet filter -------------------

function renderWaiter() {
  const { recipes, ingredientIndex, allergens } = state.store;
  const avoid = [...state.avoid];
  const diets = [...state.diets];

  const suitable = recipes.filter(
    (r) => matchesDiet(r, diets) && classifyRecipe(r, ingredientIndex, avoid).status === "safe",
  );

  const allergenToggles = allergens
    .map(
      (a) => `
      <button class="toggle" data-avoid="${esc(a.code)}" data-active="${state.avoid.has(a.code)}"
              aria-pressed="${state.avoid.has(a.code)}">
        ${esc(a.icon)} ${esc(a.name)}
      </button>`,
    )
    .join("");

  const dietToggles = ["vegetarian", "vegan"]
    .map(
      (d) => `
      <button class="toggle diet" data-diet="${d}" data-active="${state.diets.has(d)}"
              aria-pressed="${state.diets.has(d)}">${d}</button>`,
    )
    .join("");

  const menuHtml = [...groupByCategory(recipes).entries()]
    .map(([category, items]) => {
      const rows = items
        .map((r) => {
          const dietOk = matchesDiet(r, diets);
          const cls = classifyRecipe(r, ingredientIndex, avoid);
          const ok = dietOk && cls.status === "safe";
          const reasons = [];
          if (!dietOk) reasons.push(`not ${diets.join(" / ")}`);
          for (const code of cls.offending) reasons.push(state.store.allergenIndex.get(code)?.name ?? code);
          const badge = ok
            ? `<span class="badge safe">✓ Suitable</span>`
            : `<span class="badge danger">✕ ${esc(reasons.join(", "))}</span>`;
          return `
            <li class="row" style="${ok ? "" : "opacity:.55"}">
              <div class="row-main">
                <span class="row-title">${esc(r.name)} ${dietBadges(r)}</span>
                ${allergenChips(cls.allergens)}
              </div>
              <div class="right nowrap">
                <div>${czk(r.price_czk)}</div>
                ${badge}
              </div>
            </li>`;
        })
        .join("");
      return `<section class="section"><h2>${esc(category)}</h2><ul class="row-list">${rows}</ul></section>`;
    })
    .join("");

  const filterSummary =
    avoid.length || diets.length
      ? `<span class="badge neutral">${suitable.length} of ${recipes.length} dishes suitable</span>`
      : `<span class="muted">Tap allergens a guest must avoid, or a diet, to filter the menu.</span>`;

  return `
    <div class="view-title">
      <div>
        <h1>Order screen</h1>
        <div class="subtitle">Answer "what can I eat?" with confidence — allergens come straight from the recipes.</div>
      </div>
    </div>
    <div class="card section">
      <h3>Guest filter</h3>
      <p class="muted" style="margin-top:-4px">Avoid allergens</p>
      <div class="filter-group">${allergenToggles}</div>
      <p class="muted" style="margin:12px 0 4px">Diet</p>
      <div class="filter-group">${dietToggles}</div>
      <div style="margin-top:12px">${filterSummary}
        ${avoid.length || diets.length ? `<button class="btn small" id="clear-filter" style="margin-left:8px">Clear</button>` : ""}
      </div>
    </div>
    ${menuHtml}`;
}

function wireWaiter() {
  root()
    .querySelectorAll("[data-avoid]")
    .forEach((btn) =>
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-avoid");
        state.avoid.has(code) ? state.avoid.delete(code) : state.avoid.add(code);
        render();
      }),
    );
  root()
    .querySelectorAll("[data-diet]")
    .forEach((btn) =>
      btn.addEventListener("click", () => {
        const d = btn.getAttribute("data-diet");
        state.diets.has(d) ? state.diets.delete(d) : state.diets.add(d);
        render();
      }),
    );
  const clear = root().querySelector("#clear-filter");
  if (clear)
    clear.addEventListener("click", () => {
      state.avoid.clear();
      state.diets.clear();
      render();
    });
}

// --- CHEF: prep list, allergen matrix, waste logging ------------------------

function renderChef() {
  const { recipes, ingredientIndex, sales, allergens, recipeIndex } = state.store;
  const prep = buildPrepList(recipes, ingredientIndex, sales, { weekday: state.prepWeekday });

  const weekdayOptions = WEEKDAYS.map(
    (w, i) => `<option value="${i}" ${i === state.prepWeekday ? "selected" : ""}>${w}</option>`,
  ).join("");

  const prepRows = prep.items
    .filter((it) => it.prepQty > 0)
    .map(
      (it) => `
      <tr>
        <td>${esc(it.recipe.name)}</td>
        <td class="right">${it.forecast.toFixed(1)}</td>
        <td class="right"><strong>${it.prepQty}</strong></td>
      </tr>`,
    )
    .join("");

  const ingRows = prep.ingredients
    .map(
      (i) => `<tr><td>${esc(i.name)}</td><td class="right">${Math.round(i.qty)} ${esc(i.unit)}</td></tr>`,
    )
    .join("");

  const matrix = allergenMatrix(recipes, ingredientIndex, allergens);
  const matrixHead = matrix.columns
    .map((c) => `<th title="${esc(c.name)}">${esc(c.icon)}</th>`)
    .join("");
  const matrixRows = matrix.rows
    .map(
      (row) => `
      <tr>
        <td>${esc(row.recipe.name)}</td>
        ${row.cells.map((hit) => `<td class="mark ${hit ? "hit" : ""}">${hit ? "●" : "·"}</td>`).join("")}
      </tr>`,
    )
    .join("");

  const wasteOptions = recipes.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("");
  const valuedWaste = summariseWaste(state.wasteLog, recipeIndex, ingredientIndex);
  const wasteRows = valuedWaste.byItem
    .map(
      (w) =>
        `<tr><td>${esc(recipeIndex.get(w.recipe_id)?.name ?? w.recipe_id)}</td><td class="right">${w.qty}</td><td class="right">${czk(w.costCzk)}</td></tr>`,
    )
    .join("");

  return `
    <div class="view-title">
      <div>
        <h1>Kitchen</h1>
        <div class="subtitle">Prep the right amount, keep the allergen matrix correct, log what you waste.</div>
      </div>
    </div>

    <section class="section">
      <div class="view-title">
        <h2>Prep list</h2>
        <label>Forecast for
          <select id="prep-weekday" class="btn small">${weekdayOptions}</select>
        </label>
      </div>
      <div class="grid grid-two">
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Dish</th><th class="right">Forecast</th><th class="right">Prep</th></tr></thead>
            <tbody>${prepRows}</tbody>
          </table>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Ingredient to prep</th><th class="right">Quantity</th></tr></thead>
            <tbody>${ingRows}</tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>Allergen matrix</h2>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Dish</th>${matrixHead}</tr></thead>
          <tbody>${matrixRows}</tbody>
        </table>
      </div>
      <p class="muted">Columns are the 14 EU allergens. Values are derived from ingredients, so this is always current.</p>
    </section>

    <section class="section">
      <h2>Log waste</h2>
      <div class="card">
        <div class="filter-group" style="align-items:center">
          <select id="waste-item" class="btn small">${wasteOptions}</select>
          <input id="waste-qty" class="btn small" type="number" min="1" value="1" style="width:80px" />
          <input id="waste-reason" class="btn small" type="text" placeholder="reason (optional)" />
          <button id="waste-add" class="btn primary small">Log waste</button>
        </div>
        ${
          state.wasteLog.length
            ? `<div class="table-wrap" style="margin-top:12px">
                 <table class="data">
                   <thead><tr><th>Dish</th><th class="right">Qty</th><th class="right">Cost</th></tr></thead>
                   <tbody>${wasteRows}</tbody>
                   <tfoot><tr><td><strong>Total</strong></td><td></td><td class="right"><strong>${czk(valuedWaste.totalCzk)}</strong></td></tr></tfoot>
                 </table>
               </div>`
            : `<p class="muted" style="margin-top:12px">No waste logged this session.</p>`
        }
      </div>
    </section>`;
}

function wireChef() {
  const sel = root().querySelector("#prep-weekday");
  if (sel)
    sel.addEventListener("change", () => {
      state.prepWeekday = Number(sel.value);
      render();
    });
  const add = root().querySelector("#waste-add");
  if (add)
    add.addEventListener("click", () => {
      const recipe_id = root().querySelector("#waste-item").value;
      const qty = Math.max(1, Number(root().querySelector("#waste-qty").value) || 1);
      const reason = root().querySelector("#waste-reason").value.trim();
      state.wasteLog.push({ recipe_id, qty, reason });
      render();
    });
}

// --- MANAGER: food-cost dashboard -------------------------------------------

function renderManager() {
  const { recipes, ingredientIndex, recipeIndex } = state.store;
  const menu = analyzeMenu(recipes, ingredientIndex);
  const alerts = marginAlerts(recipes, ingredientIndex);
  const avgFc = menu.reduce((a, m) => a + m.foodCostPct, 0) / menu.length;
  const waste = summariseWaste(state.wasteLog, recipeIndex, ingredientIndex);

  const tiles = `
    <div class="grid grid-tiles dashboard-grid section">
      <div class="tile"><div class="tile-label">Menu items</div><div class="tile-value">${recipes.length}</div></div>
      <div class="tile ${avgFc > 0.33 ? "is-warn" : "is-safe"}"><div class="tile-label">Avg food cost</div><div class="tile-value">${pct(avgFc)}</div></div>
      <div class="tile ${alerts.length ? "is-danger" : "is-safe"}"><div class="tile-label">Margin alerts</div><div class="tile-value">${alerts.length}</div></div>
      <div class="tile ${waste.totalCzk ? "is-warn" : "is-safe"}"><div class="tile-label">Waste (session)</div><div class="tile-value">${czk(waste.totalCzk)}</div></div>
    </div>`;

  const alertHtml = alerts.length
    ? `<ul class="row-list">${alerts
        .map(
          (a) => `
          <li class="row">
            <div class="row-main">
              <span class="row-title">${esc(a.recipe.name)}</span>
              <span class="muted">food cost ${pct(a.foodCostPct, 1)} vs target ${pct(a.target, 0)}</span>
            </div>
            <span class="badge danger">margin below target</span>
          </li>`,
        )
        .join("")}</ul>`
    : `<div class="empty">No dishes are below target margin. 🎯</div>`;

  const costRows = menu
    .map(
      (m) => `
      <tr>
        <td>${esc(m.recipe.name)}</td>
        <td class="right">${czk(m.price)}</td>
        <td class="right">${czk(m.plateCost, 1)}</td>
        <td class="right">${pct(m.foodCostPct, 1)}</td>
        <td class="right">${czk(m.marginCzk, 1)}</td>
        <td class="right"><span class="badge ${statusClass(m.status)}">${m.status}</span></td>
      </tr>`,
    )
    .join("");

  return `
    <div class="view-title">
      <div>
        <h1>Dashboard</h1>
        <div class="subtitle">Live margins from current ingredient prices — not last month's report.</div>
      </div>
    </div>
    ${tiles}
    <section class="section">
      <h2>Margin alerts</h2>
      ${alertHtml}
    </section>
    <section class="section">
      <h2>Food cost by dish</h2>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Dish</th><th class="right">Price</th><th class="right">Plate cost</th><th class="right">Food cost</th><th class="right">Margin</th><th class="right">Status</th></tr></thead>
          <tbody>${costRows}</tbody>
        </table>
      </div>
    </section>`;
}

// --- shell ------------------------------------------------------------------

const VIEWS = {
  waiter: { render: renderWaiter, wire: wireWaiter },
  chef: { render: renderChef, wire: wireChef },
  manager: { render: renderManager, wire: () => {} },
};

function render() {
  const view = VIEWS[state.role];
  root().innerHTML = view.render();
  view.wire();
  // reflect active role on the switcher
  document.querySelectorAll("[data-role]").forEach((b) => {
    const active = b.getAttribute("data-role") === state.role;
    b.setAttribute("aria-pressed", String(active));
  });
}

function setRole(role) {
  if (!VIEWS[role]) return;
  state.role = role;
  if (location.hash.slice(1) !== role) location.hash = role; // deep-linkable roles
  render();
}

function wireRoleSwitch() {
  document.querySelectorAll("[data-role]").forEach((btn) =>
    btn.addEventListener("click", () => setRole(btn.getAttribute("data-role"))),
  );
  window.addEventListener("hashchange", () => setRole(location.hash.slice(1) || "waiter"));
}

async function init() {
  try {
    state.store = await loadStore();
    const fromHash = location.hash.slice(1);
    if (VIEWS[fromHash]) state.role = fromHash;
    wireRoleSwitch();
    render();
  } catch (err) {
    root().innerHTML = `<div class="empty">Could not load data.<br><span class="muted">${esc(err.message)}</span><br><br>Serve the folder over HTTP (see README) rather than opening the file directly.</div>`;
  }
}

init();
