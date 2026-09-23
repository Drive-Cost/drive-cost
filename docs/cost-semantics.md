# DriveCost Cost Semantics

This is the source of truth for the meaning and calculation boundaries of cost
metrics used by DriveCost. Product copy, UI, domain code, tests, and analytics
must defer to this document. It defines metrics, not feature sequencing or
storage design.

The goal is to prevent product copy, UI, and implementation from assigning different meanings to the same number.

## Fundamental Rule

A user-visible cost metric must be:

1. defined,
2. reproducible from stored data,
3. explicit about its time period,
4. explicit about what categories it includes,
5. honest when the underlying data is incomplete.

## Cost Categories

Initial tracked categories:

- fuel
- charging
- maintenance
- insurance
- vehicle tax
- inspection
- tyres
- tolls
- parking
- car wash
- accessories/modifications
- financing interest
- other

Future categories may include depreciation and more detailed financing semantics.

## Energy Event Compatibility

Fuel is the authoritative capture path for ICE vehicles. Charging is the
authoritative capture path for EVs. The two persisted concepts remain distinct
because their quantities and entry semantics differ.

Earlier app versions could store an EV charging event in `fuel_entries`. Those
rows are legacy charging records when their vehicle is an EV. They are not
migrated, copied, or deleted: their existing local row and `clientId` remain
the source of truth and retain their existing sync identity. EV aggregates and
history include each legacy row once alongside `charging_entries`; new EV
events are recorded only as charging entries. This avoids data loss and avoids
creating duplicate sync mutations merely to change a local representation.

## Tracked Cost

`trackedCost(period)`

The sum of eligible user-recorded costs assigned to the requested period.

Tracked cost does not imply complete economic ownership cost unless all material categories are represented.

The UI should say "Tracked cost" when the data model is incomplete.

### One-off ownership expenses

One-off ownership expenses are recorded as real payments, not normalized or
recurring costs. Their current categories are insurance, vehicle tax,
inspection, tolls, parking, car wash, financing interest, accessories, and
other. They must not be used for fuel, charging, service, repairs, tyres,
parts, oil, brakes, or other maintenance work; those remain their existing
energy or maintenance entries.

## Cash Spent

`cashSpent(period)`

The amount actually paid during the selected period based on entry transaction dates.

Example:

An annual €480 insurance payment made in January contributes:
- €480 to January cash spent
- €480 to yearly cash spent for that year

Cash spent is useful for budgeting but can make monthly comparisons noisy.

## Normalized Ownership Cost

`normalizedOwnershipCost(period)`

A time-normalized view of eligible recurring ownership costs.

Example:

An annual €480 insurance policy can contribute:
- €40/month to normalized monthly ownership cost

This is not a replacement for cash spent. The two metrics answer different questions.

MVP rule:
- store the real transaction/payment
- recurring semantics may additionally describe how a cost should be normalized
- never silently replace cash timing with normalized timing

### Recurring commitments

A recurring ownership expense is an active commitment, not a payment event. It
has an amount per recurrence, a calendar-month period, a start date, optional
next due date, category, and active state. Creating, editing, deactivating, or
reactivating a commitment never creates an `ExpenseEntry`, and commitments do
not appear in transaction history or the transaction-based **Tracked cost**.

The current supported periods are 1, 3, 6, and 12 months. For a valid active
commitment that has started, its normalized monthly equivalent is
`amount / periodMonths`. For example, an insurance commitment of €480 yearly
normalizes to €40/month. This is a planning metric, not cash spent.

The actual €480 insurance payment on 5 January remains a separate
`ExpenseEntry`: it contributes €480 to cash/transaction cost on that date and
is counted once in **Tracked cost** only when it meets that metric's entry
eligibility rules. The €40/month normalized figure is never added to that
transaction total.

For the current normalized tracked ownership view, `trackingStartDate` must be
known and the current local calendar date must be on or after it. An active
valid schedule contributes when its start date is on or before that current
date; a schedule that began before tracking still contributes because the
commitment overlaps tracking. A future schedule contributes nothing. If a
legacy vehicle has no tracking start date, schedules can be stored and shown,
but the normalized tracked monthly value is unavailable rather than inferred.
`nextDueDate` is metadata only in this version and is never advanced
automatically.

## Running Cost

`runningCost(period)`

Costs that scale directly or indirectly with using and maintaining the vehicle.

Initial categories:
- fuel/charging
- maintenance
- tyres
- tolls
- parking
- car wash

The exact category set should be represented centrally in domain logic rather than duplicated in UI.

## Fixed Ownership Cost

`fixedOwnershipCost(period)`

Costs primarily associated with having the vehicle available rather than using it.

Typical categories:
- insurance
- tax
- inspection
- fixed financing costs

## Total Tracked Ownership Cost

`trackedOwnershipCost(period)`

Running cost plus fixed ownership cost plus other eligible tracked ownership expenses.

Until depreciation is supported, do not label this metric simply "true ownership cost" without qualification.

Preferred early UI copy:
- "Tracked ownership cost"
- "Estimated monthly tracked cost"

## Cost Per Kilometer

`costPerKm(period) = eligibleTrackedCost(period) / eligibleDistance(period)`

Requirements:
- distance must be positive
- the calculation must use a clearly defined tracking interval
- only costs assigned to the same relevant tracking interval should be included where period filtering applies
- the UI must not imply full-lifetime ownership cost if the app only has partial history

Early product default:
- calculate using tracked ownership cost over tracked distance
- label clearly when only tracked data is included

## Current Tracked Interval

Until the product adds selectable periods, the primary view is **since
tracking**. Its interval has complementary mileage and calendar anchors:

- the interval starts at the vehicle's tracking-start odometer;
- `trackingStartDate`, when known, is the local calendar date from which
  DriveCost considers the vehicle tracked. It is not a purchase, ownership, or
  manufacture date;
- the latest eligible odometer is the greatest valid current or recorded event
  reading at or after that start;
- tracked distance is the difference between those readings;
- a fuel, charging, maintenance, or ownership-expense cost with an odometer is
  eligible when it belongs to the vehicle and has a valid odometer within the
  inclusive interval. An entry at the tracking-start odometer is included; an
  earlier entry is excluded. A valid ownership-expense odometer may establish
  the latest eligible odometer, just like another recorded event.

New vehicles receive `trackingStartDate` as the device's local calendar date
when tracking begins. Existing vehicles migrate with an unknown (`null`) date;
DriveCost never infers it from migration time, ownership, or historical events.
People may set or correct the date later.

Ownership expenses may not have an odometer. When `trackingStartDate` is known,
a valid date-only expense is eligible on or after that date (including the
start date) and excluded before it. It is then aligned with the same
since-tracking period and does not by itself make **Tracked cost / km**
unavailable. When the date anchor is unknown, DriveCost retains the legacy
conservative behaviour: a valid date-only expense is included in **Tracked
cost** and provenance rather than silently discarded, but **Tracked cost / km**
is unavailable because its distance alignment cannot be proven. Date-only
expenses never advance tracked distance.

An ownership expense with both odometer and date must satisfy both known
anchors: its odometer must be within the inclusive mileage interval and, when
`trackingStartDate` is known, its date must be on or after it. If those facts
contradict each other, the expense is excluded rather than silently choosing
the more favourable dimension.

If no eligible latest odometer exists, tracked distance is unavailable. A zero
distance is valid as an interval state but cannot produce a cost-per-kilometre
value. A zero tracked cost over positive tracked distance is a valid zero
cost-per-kilometre value.

## Distance Semantics

DriveCost currently distinguishes:
- ownership start mileage
- tracking start mileage
- current/latest recorded mileage

For user-facing cost calculations, the important quantity is the distance covered during the tracked data interval.

Implementation concepts may remain explicit internally, but normal UI should prefer human language such as:
- "Driven since tracking"
- "Tracked distance"

## Consumption and Charging Efficiency

Fuel consumption is available only from a valid full-to-full fill-up interval.
Every fuel entry has an explicit fill status: `full`, `partial`, or `unknown`.
Existing records without this fact are `unknown`; DriveCost never infers a
status from litres, price, or odometer.

A measured interval starts at a confirmed full fill-up and ends at a later
confirmed full fill-up. Distance is the positive odometer difference. Its fuel
quantity includes every confirmed partial fill and the ending full fill, but
excludes the starting full fill. An unknown, invalid, or regressing record
between boundaries breaks that measurement chain. The latest valid interval is
the current consumption reading; aggregate consumption uses only its compatible
consecutive valid intervals.

Charging efficiency (kWh/100 km) remains unavailable. A charging session
measures energy added, not energy consumed: battery state-of-charge boundaries
are not recorded. DriveCost may show event-level facts such as average charge
size, but must not divide purchased kWh by distance.

## Vehicle Purchase Price

Do not add the full purchase price directly to operating cost or cost/km.

The vehicle remains an asset with residual value.

Purchase price may be stored later as an input for:
- depreciation
- financing
- keep-vs-replace comparisons

## Depreciation

Depreciation is a real ownership cost but requires assumptions or market data.

It should not block the first public version.

When introduced, DriveCost must distinguish:
- observed depreciation when both purchase and sale values are known
- estimated depreciation when market/model assumptions are used

Estimated depreciation must always be labelled as estimated.

## Recurring Expenses

A recurring expense has:
- amount
- cadence
- effective/start date
- optional next due/renewal date
- category

Examples:
- insurance: €480/year
- resident parking: €25/month

The stored payment event and normalized cost model should remain conceptually distinct.

## Projections

A projected value must never be presented as historical fact.

`projected12MonthCost` may later combine:
- normalized recurring costs
- recent average fuel/energy usage
- historical maintenance patterns
- scheduled future maintenance

Every projection should expose provenance sufficient to explain the estimate.

## Calculation Provenance

Every aggregate shown in the dashboard should be traceable to:
- source categories
- source entries
- period
- distance basis if applicable
- normalization or projection method if applicable

The UI does not need to display all provenance by default, but the domain layer must be able to provide it.

## Worked Examples

### Example 1 — one-off repair

User records:
- turbo repair: €900 on 2026-06-10

Result:
- June cash spent includes €900
- 2026 tracked ownership cost includes €900
- it is not spread across future months

### Example 2 — annual insurance

User records:
- insurance payment: €480 on 2026-01-05
- recurrence: yearly

Cash view:
- January cash spent includes €480

Normalized view:
- monthly normalized insurance contribution = €40

Both remain valid views; they answer different questions.

### Example 3 — cost per km

Tracked ownership costs:
- fuel: €500
- maintenance: €200
- insurance allocation: €100

Tracked distance:
- 4,000 km

Tracked cost per km:
- (€500 + €200 + €100) / 4,000
- €0.20/km

If depreciation is not included, the UI must not imply this is the complete economic cost of the vehicle.
