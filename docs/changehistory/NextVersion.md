---
publish: false
---
# NextVersion

## Quantity formatting

### Bearing and Azimuth formatting now respects the persistence unit's phenomenon

Previously, [Bearing and Azimuth format types]($docs/quantity-formatting/definitions/Formats.md#bearing-and-azimuth-format) assumed the persisted magnitude was always a true azimuth (measured clockwise from north), regardless of the quantity's `persistenceUnit`. This was incorrect for properties whose `persistenceUnit.phenomenon` is `Units.ANGLE` (a raw mathematical angle, measured counter-clockwise from east) - see [#9465](https://github.com/iTwin/itwinjs-core/issues/9465).

[Formatter.formatQuantity]($quantity) and [Parser.parseQuantityString]($quantity) now branch on `persistenceUnit.phenomenon`:

- `Units.HORIZONTAL_DIRECTION` (e.g. `Units.HORIZONTAL_DIR_RAD`): unchanged - a `HORIZONTAL_DIRECTION` value is already a true azimuth, so it's formatted/parsed as-is.
- `Units.ANGLE` (e.g. `Units.RAD`): the `90° − θ` conversion is now applied automatically before formatting an `ANGLE` value, and inverse-applied after parsing one.

For code that persists Bearing/Azimuth values as `ANGLE`-phenomenon units and previously worked around the bug by manually applying its own `90° − θ` correction: **that manual correction must now be removed**, or values will be double-converted. For example, `AccuDraw`'s manual correction for its `QuantityType.Angle` bearing display (persisted as `Units.RAD`) has been removed as part of this change.

If your KindOfQuantity persists true azimuth values directly, switch its persistence unit to a `Units.HORIZONTAL_DIRECTION` unit (e.g. `Units.HORIZONTAL_DIR_RAD`) to opt out of the conversion entirely.
