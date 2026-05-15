# @itwin/core-quantity

The __@itwin/core-quantity__ package contains classes for quantity formatting and parsing. For detailed API documentation, see our [iTwin.js reference documentation](https://www.itwinjs.org/reference/core-quantity/quantity/).

Also check the [iTwin.js learning documentation](https://www.itwinjs.org/learning/quantity) explaining quantity formatting and its basic concepts.

## Example

```ts
import { getDefaultPersistenceUnit, Phenomena, UnitConversions, Units } from "@itwin/core-quantity";

const persistenceUnit = getDefaultPersistenceUnit(Phenomena.LENGTH);
const feet = UnitConversions.convert(
  persistenceUnit,
  Units.LENGTH.FT,
  1,
);
```

UnitConversions provides synchronous conversion helpers for the built-in canonical unit set generated from `@bentley/units-schema`.
`getDefaultPersistenceUnit(...)` returns the recommended built-in default persistence unit for a supported built-in phenomenon.
`Phenomena.LENGTH_RATIO` is intentionally not supported by that helper yet while the built-in default length-ratio unit remains unsettled.

## Contributing

When adding new APIs or updating documentation for this package, review if [QuantityFormatting.md](https://github.com/iTwin/itwinjs-core/blob/master/docs/learning/frontend/QuantityFormatting.md) or the [core-quantity learning page](https://github.com/iTwin/itwinjs-core/blob/master/docs/learning/quantity/index.md) needs to be updated as well. When adding or editing code examples, it's encouraged to keep the examples consistent between this file and the linked file above.

See the [Contributing.md](https://github.com/iTwin/itwinjs-core/blob/master/CONTRIBUTING.md) for more details.

## Licensing

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.
