// App controller — state, role switcher, and the three role views.
// The only module that touches the DOM. Business rules live in the feature
// modules (allergens.js, foodcost.js, prep.js); this file only orchestrates.
import { loadStore } from "./data.js";
import { esc, czk, pct, WEEKDAYS, tomorrowWeekday, statusClass } from "./ui.js";
import { classifyRecipe, matchesDiet, allergenMatrix } from "./allergens.js";
import { analyzeMenu } from "./foodcost.js";
import { buildPrepList } from "./prep.js";
import {
  emptyOrder,
  addLine,
  setQty,
  removeLine,
  orderCount,
  orderTotal,
  createTicket,
  annotateTicket,
  randomGuestProfile,
} from "./order.js";
import { indexIngredients } from "./allergens.js";
import { baselineOverlay, stepMarket, applyOverlay } from "./market.js";

const STORAGE_KEY = "forte.demo.v1"; // namespaced + versioned demo cache
const MARKET_SEED = 1; // deterministic market for rehearsable demos

const state = {
  store: null,
  role: "waiter",
  avoid: new Set(), // allergen codes the guest avoids (= guest profile)
  diets: new Set(), // required diet tags (= guest profile)
  guest: null, // simulated walk-in { name, avatar, avoid: [] } — NOT auto-applied to the filter
  prepWeekday: tomorrowWeekday(),
  order: emptyOrder(), // current draft order (waiter)
  tickets: [], // sent kitchen tickets (chef)
  market: { overlay: null, tick: 0, lastMoves: [], lastEvent: null },
};

const root = () => document.getElementById("view");

// Ingredient index with the current market overlay applied (for F2 recompute).
function pricedIndex() {
  return indexIngredients(applyOverlay(state.store.ingredients, state.market.overlay));
}


// --- demo persistence (localStorage + cross-tab sync) -----------------------

let suppressSave = false; // guard against save loops during hydration

function persist() {
  if (suppressSave) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        avoid: [...state.avoid],
        diets: [...state.diets],
        guest: state.guest,
        order: state.order,
        tickets: state.tickets,
        market: { overlay: state.market.overlay, tick: state.market.tick },
      }),
    );
  } catch {
    /* storage unavailable (private mode) — demo still works in memory */
  }
}

function hydrate() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    saved = null;
  }
  if (!saved) return false;
  suppressSave = true;
  state.avoid = new Set(saved.avoid ?? []);
  state.diets = new Set(saved.diets ?? []);
  state.guest = saved.guest ?? null;
  state.order = saved.order ?? emptyOrder();
  state.tickets = saved.tickets ?? [];
  if (saved.market?.overlay) {
    state.market.overlay = saved.market.overlay;
    state.market.tick = saved.market.tick ?? 0;
  }
  suppressSave = false;
  return true;
}

// Seed one illustrative ticket so #chef is never blank on a fresh demo.
function seedDemo() {
  let o = addLine(emptyOrder(), "rec-lentil-curry");
  o = addLine(o, "rec-schnitzel"); // deliberately conflicts with "avoid gluten"
  state.tickets = [createTicket(o, { avoid: ["1"], diets: [] }, { id: "T-sample" })];
  persist();
}


// --- small render helpers ---------------------------------------------------

function allergenChips(codes) {
  const { allergenIndex } = state.store;
  if (!codes.length) return `<span class="badge safe">No declared allergens</span>`;
  return `<span class="chips">${codes
    .map((c) => {
      const a = allergenIndex.get(c);
      return `<span class="chip" title="EU allergen ${esc(c)}: ${esc(a?.name)}"><strong>${esc(c)}</strong> ${esc(a?.icon ?? "")} ${esc(a?.name ?? c)}</span>`;
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

  const CATEGORY_ORDER = ["Drinks", "Starters", "Mains"];
  const isSuitable = (r) => matchesDiet(r, diets) && classifyRecipe(r, ingredientIndex, avoid).status === "safe";
  const displayedRecipes = recipes.filter((r) => CATEGORY_ORDER.includes(r.category));
  const suitableCount = displayedRecipes.filter(isSuitable).length;

  const allergenToggles = allergens
    .map(
      (a) => `
      <button class="toggle" data-avoid="${esc(a.code)}" data-active="${state.avoid.has(a.code)}"
              aria-pressed="${state.avoid.has(a.code)}">
        <strong>${esc(a.code)}</strong> ${esc(a.icon)} ${esc(a.name)}
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

  const byCat = groupByCategory(recipes);
  const menuHtml = CATEGORY_ORDER.filter((category) => byCat.has(category))
    .map((category) => {
      const evaluated = byCat.get(category).map((r) => {
        const dietOk = matchesDiet(r, diets);
        const cls = classifyRecipe(r, ingredientIndex, avoid);
        return { r, dietOk, cls, ok: dietOk && cls.status === "safe" };
      });
      // suitable dishes first, unsuitable greyed at the bottom (sort is stable)
      evaluated.sort((a, b) => Number(b.ok) - Number(a.ok));
      const rows = evaluated
        .map(({ r, dietOk, cls, ok }) => {
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
                <button class="btn small" data-add="${esc(r.id)}" style="margin-top:4px">+ Add</button>
              </div>
            </li>`;
        })
        .join("");
      return `<section class="section"><h2>${esc(category)}</h2><ul class="row-list">${rows}</ul></section>`;
    })
    .join("");

  const filterSummary =
    avoid.length || diets.length
      ? `<span class="badge neutral">${suitableCount} of ${displayedRecipes.length} dishes suitable</span>`
      : "";

  return `
    <div class="view-title">
      <div>
        <h1>Order screen</h1>
        <div class="subtitle">Help the guest choose with confidence — allergens come straight from the recipes.</div>
      </div>
    </div>
    ${renderGuestDemoPanel()}
    <div class="card section">
      <h3>Allergen filter</h3>
      <div class="filter-group">${allergenToggles}</div>
      <p class="muted" style="margin:12px 0 4px">Diet</p>
      <div class="filter-group">${dietToggles}</div>
      <div style="margin-top:12px">${filterSummary}
        ${avoid.length || diets.length ? `<button class="btn small" id="clear-filter" style="margin-left:8px">Clear</button>` : ""}
      </div>
    </div>
    ${renderOrderPanel()}
    ${menuHtml}`;
}

// Demo mode — a walk-in guest states their allergies; the waiter reacts by
// selecting them in the filter. We do NOT auto-apply the filter.
const GUEST_AVATARS = ["🧑", "👩", "👨", "🧓", "👵", "🧑‍🦱", "👩‍🦰", "👨‍🦳", "👱", "🧕"];
const GUEST_NAMES = ["Petr", "Jana", "Eva", "Tomáš", "Lucie", "Martin", "Klára", "Ondřej", "Nikola", "Adéla"];

function makeGuest() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const g = randomGuestProfile(state.store.allergens.map((a) => a.code));
  return { name: pick(GUEST_NAMES), avatar: pick(GUEST_AVATARS), avoid: g.avoid };
}

function renderGuestDemoPanel() {
  const g = state.guest;
  const { allergenIndex } = state.store;

  let body;
  if (!g) {
    body = `<p class="muted" style="margin:0">
        Press “New random guest” to simulate a walk-in who tells you their allergies.
        Then record those allergens in the filter below to see what they can eat.
      </p>`;
  } else {
    const chips = g.avoid
      .map((c) => {
        const a = allergenIndex.get(c);
        return `<span class="chip" title="EU allergen ${esc(c)}: ${esc(a?.name ?? c)}"><strong>${esc(c)}</strong> ${esc(a?.icon ?? "")} ${esc(a?.name ?? c)}</span>`;
      })
      .join("");
    body = `
      <div class="row" style="align-items:flex-start">
        <div class="row-main">
          <span class="row-title" style="display:flex;align-items:center;gap:8px">
            <span style="font-size:1.8rem;line-height:1">${g.avatar}</span> ${esc(g.name)}
          </span>
          <span class="muted">“Hi — I'm allergic to:”</span>
          <span class="chips" style="margin-top:6px">${chips}</span>
        </div>
      </div>`;
  }

  return `
    <div class="card section">
      <div class="view-title" style="margin-bottom:8px">
        <h3 style="margin:0">Demo mode</h3>
        <button class="btn primary small" id="guest-demo">New random guest</button>
      </div>
      ${body}
    </div>`;
}

// Order panel — the draft ticket the waiter is building.
function renderOrderPanel() {
  const { recipeIndex } = state.store;
  const avoid = [...state.avoid];
  const lines = state.order.lines;
  const total = orderTotal(state.order, recipeIndex);

  const body = lines.length
    ? `<ul class="row-list">${lines
        .map((l) => {
          const r = recipeIndex.get(l.recipe_id);
          const cls = r ? classifyRecipe(r, state.store.ingredientIndex, avoid) : { offending: [] };
          const warn = cls.offending.length
            ? `<span class="badge danger">⚠ contains ${esc(
                cls.offending.map((c) => state.store.allergenIndex.get(c)?.name ?? c).join(", "),
              )}</span>`
            : "";
          return `
            <li class="row">
              <div class="row-main">
                <span class="row-title">${esc(r?.name ?? l.recipe_id)} ${warn}</span>
                <span class="muted">${czk(r?.price_czk ?? 0)} each</span>
              </div>
              <div class="right nowrap">
                <button class="btn small" data-dec="${esc(l.recipe_id)}">−</button>
                <strong style="margin:0 6px">${l.qty}</strong>
                <button class="btn small" data-inc="${esc(l.recipe_id)}">+</button>
                <button class="btn small" data-del="${esc(l.recipe_id)}" style="margin-left:6px">✕</button>
              </div>
            </li>`;
        })
        .join("")}</ul>
       <div class="view-title" style="margin-top:12px">
         <strong>Total: ${czk(total)}</strong>
         <span>
           <button class="btn small" id="order-clear">Clear</button>
           <button class="btn primary small" id="order-send">Send to kitchen →</button>
         </span>
       </div>`
    : `<p class="muted">No items yet. Tap “+ Add” on a dish. The guest's allergen profile travels with the order to the kitchen.</p>`;

  return `
    <div class="card section">
      <div class="view-title" style="margin-bottom:8px">
        <h3 style="margin:0">Current order <span class="badge neutral">${orderCount(state.order)}</span></h3>
        ${
          avoid.length || state.diets.size
            ? `<span class="muted">guest avoids ${esc(
                avoid.map((c) => state.store.allergenIndex.get(c)?.name ?? c).join(", ") || "—",
              )}${state.diets.size ? ` · ${esc([...state.diets].join(", "))}` : ""}</span>`
            : `<span class="muted">no guest restrictions set</span>`
        }
      </div>
      ${body}
    </div>`;
}

function wireWaiter() {
  root()
    .querySelectorAll("[data-avoid]")
    .forEach((btn) =>
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-avoid");
        state.avoid.has(code) ? state.avoid.delete(code) : state.avoid.add(code);
        persist();
        render();
      }),
    );
  root()
    .querySelectorAll("[data-diet]")
    .forEach((btn) =>
      btn.addEventListener("click", () => {
        const d = btn.getAttribute("data-diet");
        state.diets.has(d) ? state.diets.delete(d) : state.diets.add(d);
        persist();
        render();
      }),
    );
  const clear = root().querySelector("#clear-filter");
  if (clear)
    clear.addEventListener("click", () => {
      state.avoid.clear();
      state.diets.clear();
      persist();
      render();
    });

  const guestDemo = root().querySelector("#guest-demo");
  if (guestDemo)
    guestDemo.addEventListener("click", () => {
      state.guest = makeGuest(); // show who walked in; the waiter records allergens manually
      persist();
      render();
    });

  // order panel
  const onOrderChange = () => {
    persist();
    render();
  };
  root()
    .querySelectorAll("[data-add]")
    .forEach((b) =>
      b.addEventListener("click", () => {
        state.order = addLine(state.order, b.getAttribute("data-add"));
        onOrderChange();
      }),
    );
  root()
    .querySelectorAll("[data-inc]")
    .forEach((b) =>
      b.addEventListener("click", () => {
        state.order = addLine(state.order, b.getAttribute("data-inc"));
        onOrderChange();
      }),
    );
  root()
    .querySelectorAll("[data-dec]")
    .forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-dec");
        const line = state.order.lines.find((l) => l.recipe_id === id);
        state.order = setQty(state.order, id, (line?.qty ?? 1) - 1);
        onOrderChange();
      }),
    );
  root()
    .querySelectorAll("[data-del]")
    .forEach((b) =>
      b.addEventListener("click", () => {
        state.order = removeLine(state.order, b.getAttribute("data-del"));
        onOrderChange();
      }),
    );
  const clearOrder = root().querySelector("#order-clear");
  if (clearOrder)
    clearOrder.addEventListener("click", () => {
      state.order = emptyOrder();
      onOrderChange();
    });
  const send = root().querySelector("#order-send");
  if (send)
    send.addEventListener("click", () => {
      if (!state.order.lines.length) return;
      const ticket = createTicket(state.order, { avoid: [...state.avoid], diets: [...state.diets] });
      state.tickets = [ticket, ...state.tickets];
      state.order = emptyOrder();
      onOrderChange();
    });
}

// --- CHEF: prep list, allergen matrix, waste logging ------------------------

// Ticket board — sent orders, with allergen conflicts flagged at the pass.
function renderTicketBoard() {
  const { recipeIndex, ingredientIndex, allergenIndex } = state.store;
  if (!state.tickets.length) {
    return `<section class="section"><h2>Tickets</h2><div class="empty">No open tickets. Send one from the Waiter screen.</div></section>`;
  }
  const cards = state.tickets
    .map((t) => {
      const a = annotateTicket(t, recipeIndex, ingredientIndex);
      const avoidNames = a.guest.avoid.map((c) => allergenIndex.get(c)?.name ?? c);
      const guestLine = avoidNames.length
        ? `avoids ${esc(avoidNames.join(", "))}`
        : "no restrictions";
      const time = new Date(a.createdAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
      const lines = a.lines
        .map(
          (l) => `
          <li class="row" style="${l.conflict ? "border-color:var(--danger);background:var(--danger-soft)" : ""}">
            <div class="row-main">
              <span class="row-title">${l.qty}× ${esc(l.name)}</span>
              ${
                l.conflict
                  ? `<span class="badge danger msg">⚠ guest avoids ${esc(
                      l.offending.map((c) => allergenIndex.get(c)?.name ?? c).join(", "),
                    )} — dish contains it</span>`
                  : `<span class="badge safe msg">✓ ok for this guest</span>`
              }
            </div>
          </li>`,
        )
        .join("");
      return `
        <div class="card">
          <div class="view-title" style="margin-bottom:8px">
            <h3 style="margin:0">${esc(a.id)} ${a.hasConflict ? `<span class="badge danger">check allergens</span>` : ""}</h3>
            <span class="muted">${esc(time)} · ${guestLine}</span>
          </div>
          <ul class="row-list">${lines}</ul>
          <div style="margin-top:10px" class="right">
            <button class="btn small" data-bump="${esc(a.id)}">Mark done</button>
          </div>
        </div>`;
    })
    .join("");
  return `
    <section class="section">
      <div class="view-title"><h2>Tickets <span class="badge neutral">${state.tickets.length}</span></h2></div>
      <div class="grid grid-cards">${cards}</div>
    </section>`;
}

function renderChef() {
  const { recipes, ingredientIndex, sales, allergens } = state.store;
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
    .map((c) => `<th title="EU allergen ${esc(c.code)}: ${esc(c.name)}">${esc(c.code)} ${esc(c.icon)}</th>`)
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

  return `
    <div class="view-title">
      <div>
        <h1>Kitchen</h1>
        <div class="subtitle">Prep the right amount and keep the allergen matrix correct.</div>
      </div>
    </div>

    ${renderTicketBoard()}

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
    </section>`;
}

function wireChef() {
  const sel = root().querySelector("#prep-weekday");
  if (sel)
    sel.addEventListener("change", () => {
      state.prepWeekday = Number(sel.value);
      render();
    });
  root()
    .querySelectorAll("[data-bump]")
    .forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-bump");
        state.tickets = state.tickets.filter((t) => t.id !== id);
        persist();
        render();
      }),
    );
}

// --- MANAGER: food-cost dashboard -------------------------------------------

function renderManager() {
  const { recipes } = state.store;
  const ingredientIndex = pricedIndex(); // F2 recomputes from the live market overlay
  const menu = analyzeMenu(recipes, ingredientIndex);

  const marketPanel = renderMarketPanel();

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
    ${marketPanel}
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

// Demo mode — simulate real-world market events that move ingredient prices.
function renderMarketPanel() {
  const m = state.market;
  const moves = m.lastMoves ?? [];
  const ticker = moves.length
    ? moves
        .map(
          (mv) =>
            `<span class="chip">${esc(mv.icon)} ${esc(mv.name)} <strong style="color:${mv.dir === "up" ? "var(--danger)" : "var(--safe)"}">${mv.dir === "up" ? "▲" : "▼"} ${pct(Math.abs(mv.pct), 1)}</strong></span>`,
        )
        .join("")
    : `<span class="muted">No changes yet — press “Simulate market changes” to see prices move.</span>`;
  const eventBadge = m.lastEvent ? `<span class="badge warn">📣 ${esc(m.lastEvent)}</span>` : "";

  return `
    <div class="card section">
      <div class="view-title" style="margin-bottom:4px">
        <h3 style="margin:0">Demo mode ${eventBadge}</h3>
        <span>
          <button class="btn primary small" id="mkt-step">Simulate market changes</button>
          <button class="btn small" id="mkt-reset">Reset</button>
          <span class="badge neutral" style="margin-left:6px">event ${m.tick}</span>
        </span>
      </div>
      <p class="muted" style="margin:0 0 10px">
        Demo mode simulates real-world events — supplier price swings and shocks like a
        dairy shortage or a salmon import spike. Each click advances the market and the
        dashboard below recomputes food cost, margins, and alerts live.
      </p>
      <div class="chips">${ticker}</div>
    </div>`;
}

function marketTick() {
  const { overlay, moves, event } = stepMarket(
    state.market.overlay,
    state.store.ingredients,
    state.market.tick + 1,
    MARKET_SEED,
  );
  state.market.overlay = overlay;
  state.market.tick += 1;
  state.market.lastMoves = moves;
  state.market.lastEvent = event;
  persist();
  if (state.role === "manager") render();
}

function wireManager() {
  const step = root().querySelector("#mkt-step");
  if (step)
    step.addEventListener("click", () => {
      marketTick();
      if (state.role !== "manager") render();
    });
  const reset = root().querySelector("#mkt-reset");
  if (reset)
    reset.addEventListener("click", () => {
      state.market.overlay = baselineOverlay(state.store.ingredients);
      state.market.tick = 0;
      state.market.lastMoves = [];
      state.market.lastEvent = null;
      persist();
      render();
    });
}

// --- shell ------------------------------------------------------------------

const VIEWS = {
  waiter: { render: renderWaiter, wire: wireWaiter },
  chef: { render: renderChef, wire: wireChef },
  manager: { render: renderManager, wire: wireManager },
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
  // Cross-tab demo sync: another tab (e.g. the kitchen screen) updated state.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    hydrate();
    render();
  });
}

async function init() {
  try {
    state.store = await loadStore();
    if (!hydrate()) seedDemo(); // first visit → seed a sample ticket
    if (!state.market.overlay) state.market.overlay = baselineOverlay(state.store.ingredients);
    const fromHash = location.hash.slice(1);
    if (VIEWS[fromHash]) state.role = fromHash;
    wireRoleSwitch();
    render();
  } catch (err) {
    root().innerHTML = `<div class="empty">Could not load data.<br><span class="muted">${esc(err.message)}</span><br><br>Serve the folder over HTTP (see README) rather than opening the file directly.</div>`;
  }
}

init();
