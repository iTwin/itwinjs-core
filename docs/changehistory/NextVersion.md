---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-quantity](#itwincore-quantity)
    - [Changes](#changes)

## @itwin/core-quantity

### Changes

- **Breaking Change**: Enhanced [Parser]($quantity) error handling to properly propagate [`ParseError.UnitLabelSuppliedButNotMatched`]($quantity) when unit labels are provided but cannot be matched to known units. **This change may cause parsing operations that previously succeeded with invalid unit labels to now return error results instead**, providing more accurate feedback and preventing silent failures when parsing quantities with unrecognized unit labels.
