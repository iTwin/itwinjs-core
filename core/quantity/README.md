# @itwin/core-quantity

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/core-quantity__ package contains classes for quantity formatting and parsing.

## Documentation

See the [iTwin.js](https://www.itwinjs.org/learning/frontend/quantityformatting/#quantity-package) documentation on quantity formatting for more information.

## How Formatting Works

Client-facing applications generally use the [QuantityFormatter](https://www.itwinjs.org/reference/core-frontend/quantityformatting/quantityformatter/) found in [core-frontend]($frontend). For more specific use cases, the primitive [Parser]($quantity) and [Formatter]($quantity) found in [core-quantity]($quantity) can be used.

### Common Terms

- Unit/[UnitProps]($quantity) - A named unit of measure which can be located by its name or label.
- [UnitsProvider]($quantity) - A class that will also locate the UnitProps for a unit given name or label. This class will also provide a [UnitConversion]($quantity) to convert from one unit to another.
- Unit Family/[Phenomenon]($ecschema-metadata) - The physical quantity that this unit measures (e.g., length, temperature, pressure).  Only units in the same phenomenon can be converted between.
- Persistence Unit - The unit used to store the quantity value in memory or to persist the value in an editable IModel.
- Format/FormatProp - The display format for the quantity value. For example, an angle may be persisted in radians but formatted and shown to user in degrees.
  - CompositeValue - An addition to the format specification that allows the explicit specification of a unit label, it also allows the persisted value to be displayed as up to 4 sub-units. Typical multi-unit composites are used to display `feet'-inches"` and `degree°minutes'seconds"`.
- [FormatterSpec]($quantity) - Holds the format specification as well as the [UnitConversion]($quantity) between the persistence unit and all units defined in the format. This is done to avoid any async calls by the UnitsProvider during the formatting process.
- [ParserSpec]($quantity) - Holds the format specification as well as the [UnitConversion]($quantity) between the persistence unit and all other units in the same phenomenon. This is done to avoid async calls by the UnitsProvider and also done to allow a user to enter `43in` even when in "metric" unit system and have the string properly converted to meters.
// TODO NAM ADD FORMATTER AND PARSER