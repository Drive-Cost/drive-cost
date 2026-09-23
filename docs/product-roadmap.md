# DriveCost Product Roadmap

This is the source of truth for product sequencing. It prioritizes product risk
over infrastructure novelty and describes intended user outcomes, not
engineering completion. Implementation progress belongs in the
[development roadmap](development-roadmap.md); metric definitions belong in
[cost semantics](cost-semantics.md).

## Phase 0 — Foundation

Status: complete.

- [x] Establish product principles, cost semantics, and Definition of Done.
- [x] Establish a concise product, architecture, and roadmap documentation set.
- [x] Keep delivery scoped through issue-sized tasks.

## Phase 1 — Product Truth

Make recorded ownership costs more complete and each calculation more honest.

### DC-101 — Cost semantics

Status: complete. Define trusted cost metrics and the provenance required to
explain them.

### DC-102 — Ownership expenses

Let people record material ownership costs beyond fuel/charging and
maintenance: insurance, tax, inspection, tyres, tolls, parking, car wash,
financing interest, modifications/accessories, and other costs.

Preserve the distinction between recorded payments and any later normalized
view. Depreciation is not part of this expense-tracking milestone.

### DC-103 — Recurring expenses

Represent cadence and renewal information for recurring costs without
conflating payment timing with normalized ownership cost.

### DC-104 — Expense sync

Make ownership expenses available through the same safe, local-first sync
experience as other ownership records.

### DC-110 — Full and partial fill-ups

Support consumption calculations only across valid tank boundaries. Partial
fill-ups must never create a misleading consumption figure.

### DC-111 — Fuel and charging domain split

Make combustion fill-ups and EV charging clear product concepts while retaining
a unified energy-cost view where it helps the user.

## Phase 2 — Core Experience

Reduce friction in the primary ownership loop and make the product feel like a
consumer experience rather than a set of database screens.

### DC-201 — Navigation redesign

Target information architecture:

- Home
- History
- Add
- Garage
- Settings

The Add action is context-aware by vehicle type. All existing actions remain
reachable, while irrelevant permanent navigation disappears.

### DC-202 — Quick Add

Create low-friction flows for fill-ups, charges, maintenance, expenses, and
odometer updates. Each flow collects only what is needed to record the event
correctly.

### DC-203 — Progressive onboarding

Initial vehicle setup requests only brand, model, year, vehicle/energy type,
and current odometer. Advanced profile details are optional and can be added
when they improve an insight.

### DC-204 — Home redesign

Home answers, “What is this vehicle costing me?” through tracked monthly cost,
tracked cost per distance, current-year tracked cost, category breakdown,
useful insights, and recent activity. Every value is explainable and clearly
limited to the recorded data. Successful sync and tracking-model internals do
not occupy normal states.

## Phase 3 — Intelligence

Turn trustworthy history into useful, deterministic decision support.

### DC-301 — Trends

Add period-based trends for tracked cost, cost per distance, energy spend,
consumption, maintenance, and distance.

### DC-302 — Maintenance schedules

Support maintenance due by date and/or distance.

### DC-303 — Insights engine

Implement deterministic insights before considering generated analysis, such as
changes in energy spending, consumption, maintenance, usage, and upcoming
service.

### DC-304 — 12-month forecast

Forecast ownership cost from recurring costs, usage, recent energy costs, and
known maintenance schedules. Forecasts always expose their provenance and are
never presented as history.

## Phase 4 — Beta Readiness

- polished empty and recoverable-error states
- distance-unit, locale, and currency handling
- dark mode and accessibility pass
- crash reporting, privacy review, and minimal product analytics
- TestFlight and Play closed testing

## Phase 5 — Monetization and Differentiation

Only after the core loop demonstrates retention:

- cloud and multi-device convenience features
- OCR receipt capture
- advanced exports and reports
- shared or family vehicles
- multi-vehicle comparison and ownership intelligence
- advanced forecasting and maintenance intelligence
- vehicle comparison and keep-versus-replace decision support
