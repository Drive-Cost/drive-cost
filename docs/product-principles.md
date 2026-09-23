# DriveCost Product Principles

## Authority

This is the source of truth for DriveCost's product philosophy, user value, and
experience standards. The product roadmap decides when product capabilities are
delivered; cost semantics define the meaning of their numbers. Neither should
override these principles without an explicit product decision.

## Product Promise

DriveCost helps people understand what their vehicle actually costs them and what is likely to cost them next.

The product should not be positioned as merely a fuel logger or maintenance notebook. Its value is the combination of low-friction tracking, trustworthy calculations, and useful ownership decisions.

## Core Product Loop

1. User records a real vehicle event with minimal friction.
2. DriveCost updates a trustworthy model of ownership cost and usage.
3. The dashboard explains what changed and why.
4. The user gets a useful insight, reminder, or decision aid.
5. The usefulness creates the habit of logging the next event.

If a feature does not strengthen this loop, it should have a strong reason to exist.

## Principles

### 1. Trust before intelligence

A boring correct number is better than an impressive wrong estimate.

Every important calculated value should be explainable. If data is incomplete, show that limitation instead of pretending precision.

### 2. Logging must be fast

The main competitor is not another app. It is the user's decision not to log the event.

Routine actions should require as few taps and fields as practical.

### 3. Progressive disclosure

Do not require detailed vehicle metadata before the user gets value.

Ask for the minimum needed to begin tracking, then invite users to enrich the vehicle profile for better insights.

### 4. Local-first is a product feature

The app should remain useful without sign-in, connectivity, or backend availability.

Cloud sync should feel like safety and convenience, not a prerequisite.

### 5. Explain, do not just report

Prefer:
- "Fuel spending is 12% higher than your 3-month average"

over:
- "Fuel this month: €184"

Raw values are useful, but interpretation is where DriveCost becomes differentiated.

### 6. Context-aware product behavior

The interface should adapt to the vehicle:
- ICE: fill-ups
- EV: charging
- PHEV: both

Do not expose irrelevant permanent navigation.

### 7. No developer concepts in user-facing UI

Terms such as `trackingStartMileage`, sync cursor, outbox, tombstone, replication, or internal baseline models must not appear in normal UX.

Translate implementation truth into human product language.

### 8. Monetization follows retention

Do not cripple the free core loop.

Premium value should come from advanced insight, cloud convenience, multiple vehicles, OCR, exports, forecasting, shared vehicles, and higher-value decision tools.

## Product boundaries

- DriveCost may report only the costs that have been recorded or responsibly
  estimated. It must not imply a complete economic ownership cost when material
  categories are absent.
- A feature earns its place by improving the core loop, reducing logging
  friction, or enabling a meaningful ownership decision.
- Product copy uses plain, human language. The technical model may be more
  detailed than the experience shown to the user.

## Target Users

### Everyday driver

Wants:
- monthly vehicle cost
- fuel/energy spend
- maintenance history
- cost per km
- reminders
- confidence that nothing important is forgotten

### Car enthusiast

Wants:
- richer history
- modifications
- multiple vehicles
- exports
- deeper trends
- ownership comparisons

### Future high-value use case

A user deciding whether to:
- keep the current car
- replace it
- add a second car
- change powertrain
- compare expected ownership cost

This is a future differentiation direction, not MVP scope.
