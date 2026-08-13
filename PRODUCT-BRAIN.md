# Product Brain — Forte (allergen intelligence plugin)

> Living reference for the Forte concept: what we learned, what we chose to build
> and why, and the raw material for vision / mission / strategy. This is a
> thinking document, not a spec. The spec lives in
> [`requirements/requirements.yaml`](requirements/requirements.yaml).

---

## 1. Context

Forte is a prototype under the **Piano** brand (the payment/technology arm of the
**Septim** group; **Qerko** provides QR pay-at-table in the same family). The bet:
rather than build yet another full POS, build the **allergen intelligence layer**
that plugs into an existing till and makes allergen safety automatic.

The instrument pun is deliberate — the full name of the piano is the *pianoforte*:
**Piano** the group, **Forte** the product ("strong").

---

## 2. Market research — Czech POS landscape

Desk analysis of the "pokladní systém / gastro pokladna" software Czech pubs and
restaurants actually run.

### Players

| System | Segment | Notes |
|---|---|---|
| **Dotykačka** (Seyfor) | Mass-market gastro + retail | Market leader, 75+ features, biggest integration ecosystem, Android/cloud |
| **Storyous** (Teya, ex-SaltPay) | Pubs, cafés, events | All-in-one device, tight payment coupling, strong at festivals |
| **Septim** | Premium restaurants, chains, hotels | Deep operations (warehouse, recipe costing, staff), Michelin venues (FIELD, Ambiente, Kolkovna) |
| **iKelp** | SMB gastro + retail | Best price/performance, bring-your-own-hardware |
| **Markeeta** | Budget/micro | Merged into Dotykačka |
| **Quorion** | Traditional registers + POS | Proprietary hardware |

### Universal features (table stakes across all of them)

Order entry (table map, quick keys) · kitchen/bar routing (print or KDS) · bill
splitting, table transfer, open tabs · card terminal integration · daily/lunch
menu · receipts · cash drawer & shift Z-reports · remote management + sales
dashboards · user roles · mobile waiter · basic stock · discounts / happy hours ·
delivery-platform integration (Wolt/Bolt/Foodora) · meal-voucher acceptance ·
tips · multi-VAT · loyalty · API. All of them are preparing for **EET 2.0**
(fiscal reporting, effective 2027-01-01).

### Identified gaps (where nobody is strong)

1. **Allergen & dietary intelligence** — legally required (EU 1169/2011), but
   maintained by hand in Word and forgotten. Static labels, not derived from
   recipes. *This is the wedge.*
2. Real-time food-cost / margin (mostly month-late, from the accountant).
3. Waste tracking & sustainability (absent).
4. Staff scheduling with labour-law compliance (only basic attendance).
5. Unified multi-channel menu (one source of truth across dine-in/QR/delivery).
6. Deep reservation ↔ table ↔ pre-order integration.
7. Data portability / vendor lock-in.

---

## 3. Why allergens as the wedge

- **Legal pressure.** EU 1169/2011 (transposed into CZ law) mandates declaring 14
  allergens per item; inspections fine non-compliance.
- **Emotional pressure.** Every owner fears an allergic-reaction incident and the
  liability that follows.
- **Universally hated chore.** The allergen matrix is maintained manually and
  drifts out of date the moment a supplier or recipe changes.
- **Demo-able in 30 seconds.** "Change one ingredient's allergen → every dish
  updates" makes people say *"I need that."*

The insight that makes it defensible: **allergens must be derived from recipe
ingredients, never stored as labels on the dish.** Then the info is always
current and can *follow the order to the pass* as a safety net.

---

## 4. Feature selection & rationale

We deliberately kept scope narrow. Positioning: **not a replacement POS** — the
intelligence layer that plugs into one.

### Core (kept)

1. **Allergen & dietary intelligence** (the wedge) — derive allergens from
   ingredients; classify each dish SAFE/CONTAINS for a guest; filter the menu to
   what a guest *can* eat; auto-generate the compliance matrix.
2. **Real-time food cost engine** — live food-cost % and margin per dish from the
   latest ingredient prices; alert when a dish slips below target margin.
3. **Smart prep & waste reduction** — weekday-based demand forecast → prep list;
   waste logging valued at plate cost.

These three share **one data model** (ingredients → recipes → sales), so the
prototype is small but coherent, and each module doubles as a spec for a future
backend service.

### Deliberately dropped / deferred

- **Qerko pay-at-table** — hard to mock without payment infra (would come "for
  free" via the group later).
- **Staff scheduling & labour-law compliance** — a separate, heavy domain.
- **Unified multi-channel menu publishing** — integration-heavy, low demo value.
- **Full order-taking / payments / receipts / table map** — undifferentiated
  table stakes; building it would make Forte look like a weak general POS instead
  of a strong specialist.

### Demo-only "make it live" slices (prototype)

- **Allergen-aware order thread** — a thin order that carries the guest's allergen
  profile to a kitchen ticket, which flags any line that conflicts (safety net at
  the pass).
- **Waiter Demo mode** — a random walk-in guest states their allergies; the waiter
  reacts by recording them and suggesting suitable dishes.
- **Manager Demo mode** — simulated market events move ingredient prices so the
  food-cost table recomputes live.

---

## 5. Vision / Mission / Strategy — the Allergy Navigator

**Vision.** Eating out is never a gamble. Every guest orders without fear, and
every restaurant serves without the dread of an allergen mistake — because what's
in the food is always known, current, and impossible to lose track of.
*(One-liner: a world where nobody has to guess what's on the plate.)*

**Mission.** Give every restaurant a single, automatic source of truth for
allergens — derived from their real recipes, always up to date, and carried with
the guest from the menu all the way to the pass.
*(One-liner: make allergen safety automatic, current, and impossible to forget.)*

**Strategy — how we win.**

1. **Wedge — start where the pain is sharpest.** Lead with allergen compliance and
   safety, the one job every Czech venue is legally required to do (EU 1169/2011)
   yet maintains by hand. Win the demo in 30 seconds: change one ingredient's
   allergen and every dish updates itself.
2. **Position — a layer, not another till.** We are the allergen intelligence layer
   that plugs into the POS you already run. This avoids a feature race with
   Dotykačka and a price war at the bottom, and it's a realistic route to market
   inside the Piano / Septim / Qerko ecosystem where recipe and warehouse data
   already lives.
3. **Moat — build on data competitors can't easily copy.** Allergens are *derived*
   from recipe ingredients, never stored as labels. That keeps them always-current
   and lets safety *follow the order* to the kitchen — a labels-based competitor
   can't bolt this on without rebuilding their data model.
4. **Expand — grow into the intelligence the same data unlocks.**
   - Phase 1: allergen & dietary intelligence (the wedge).
   - Phase 2: real-time food cost & margin (same ingredient data).
   - Phase 3: smart prep & waste reduction (same recipe & sales data).
   - One shared model throughout: ingredients → recipes → sales.

**Positioning line.** *"The allergen intelligence layer for your POS."*

**Anti-goals.** No full-POS feature race (no payments / table-map / receipts
land-grab), no competing on price with the mass market, no replacing Septim's till.

**How we'll know it's working (candidate measures).**
- Allergen matrix maintained automatically, not in Word (time saved per venue).
- Fewer allergen incidents / near-misses reported by pilot venues.
- Waiter confidence: share of guests answered without a trip to the kitchen.
- Attach rate as a POS add-on within the group's install base.

**Naming note.** "Allergy Navigator" is the descriptive category name; **Forte**
remains the product/brand name (keeps the Piano → pianoforte tie-in). Tagline
candidate: *"Forte — your allergy navigator."*


---

## 6. Open questions

- Allergy **severity** (intolerance vs anaphylaxis) — should it change kitchen
  behaviour (dedicated prep, cross-contamination handling)?
- **Cross-contamination** (shared fryer/grill) — model it, or just warn?
- **Daily specials** — how to keep their allergens current when they're off-menu?
- **Guest self-service** (QR) — let guests enter their own allergens to remove the
  "mis-heard by the waiter" risk?
- **Tourist languages** — allergen input/output in EN/DE for guests who don't
  speak Czech.
- **Saved regulars** — remember a returning guest's allergen profile?

---

## 7. Raw user-interview snippets (imaginary)

> Unedited feedback gathered from waiters trialling the tool. Raw material only —
> **not yet acted upon.** Intended for a working session where we summarise the
> themes and turn them into a defined feature.

**Tereza — server, busy Prague pub, 6 years**
"Honestly the best part is I stop guessing. Before, a guest asks 'is there milk in
the svíčková' and I'd have to run to the kitchen and hope the chef remembers. Now
I just tap it. But — I do it fresh for every single guest, and on a Friday night
with a full terrace that's a lot of tapping. Can't it remember the last table or
give me a quick 'gluten + milk' button? Those two come up ten times a night."

**Marek — head waiter, hotel restaurant, 11 years**
"The thing I actually worry about isn't whether the dish 'contains' something —
it's *how bad*. A lactose intolerance and a peanut anaphylaxis are not the same
conversation. If a guest says 'I'll die if there's a trace of nuts', I want the
kitchen to see a big red flag and use a clean pan. Right now every allergy looks
the same on the ticket. That scares me a bit."

**Lucie — barista/server, café, 2 years**
"Cute and fast. My problem is the daily menu. The lunch specials change every day
and they're not in this thing, so for those I'm back to guessing. If it doesn't
cover the specials, half my lunch service isn't covered."

**Ondřej — waiter, tourist-area restaurant, 4 years**
"Half my guests are German or English and they describe allergies in their own
words — 'no gluten', 'kein Ei', 'sans arachide'. I'm translating in my head and
I mis-hear things. Could the guest just tap their own allergens on a tablet or
their phone? Then I'm not the weak link."

**Jana — server, bistro, 8 years**
"I love that it comes from the recipe and not from my memory. That takes a real
weight off. When a coeliac guest comes in I used to sweat. Now I feel like I can
actually promise something. That's worth a lot to me, honestly."

**Petr — waiter, brewery restaurant, 3 years**
"Same as the others — the fryer. Our fries and the fried cheese go in the same
oil. The system says fries are 'no allergens' but if someone's coeliac, the shared
fryer is a problem and it doesn't warn me. I found that out the hard way once."

**Klára — server, fine dining, 5 years**
"For regulars it's a bit repetitive. We have guests who come every week with the
exact same profile — no shellfish, no celery. It'd be lovely if the system just
knew 'oh, that's Mr. Novák, he can't have celery' when I seat him."

**Adéla — waitress, family restaurant, 1 year**
"Kids. Parents ask for substitutions constantly — 'can you do it without the
breadcrumb', 'swap the sauce'. The tool tells me the dish as-is contains egg, but
it can't tell me if the *modified* version is safe. I still have to ask the chef
for anything custom."

**Tomáš — waiter, gastropub, 7 years**
"It's quick, I'll give it that. But when it's slammed I don't even open it — I
just take the order and sort allergies later, which defeats the point. If it were
one tap from the order screen instead of a separate step, I'd actually use it
every time."

**Nikola — server, wine bar, 4 years**
"Two guests, two different allergies, one table. Right now I feel like I'm
setting one 'filter' for the whole table and then juggling in my head who can have
what. Per-guest on the same ticket would match how people actually eat out."
