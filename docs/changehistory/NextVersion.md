---
publish: false
---
# NextVersion

## UI Changes

### New QuantityNumberInput component

Added component [QuantityNumberInput]($ui-components) which accepts input for quantity values. The quantity value is shown as a single numeric value and the quantity "display" unit is shown next to the input control. The "display" unit is determined by the active unit system as defined by the [QuantityFormatter]($frontend). The control also provides buttons to increment and decrement the "displayed" value. The value reported by via the onChange function is in "persistence" units that can be stored in the iModel.
