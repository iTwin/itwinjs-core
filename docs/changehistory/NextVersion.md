---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-quantity](#itwincore-quantity)
    - [Changes](#changes)

## @itwin/core-quantity

### Changes

- Fixed a bug in [Parser]($quantity) where invalid unit labels were silently ignored during parsing when no format units were specified, leading to incorrect results. Previously, when using a unitless format with input like "12 im" (a typo "in" for inches), the parser would successfully parse it as "12 meters" when the persistence unit was set to meters. The parser now correctly returns `ParseError.UnitLabelSuppliedButNotMatched` when a unitless format is used and a unit label is provided but cannot be matched to any known unit. This fix ensures parsing errors are noticed and properly handled by the caller, preventing silent failures and ensuring data integrity.
