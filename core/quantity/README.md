# @itwin/core-quantity

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/core-quantity__ package contains classes for quantity formatting and parsing.

## Documentation

### Common Terms

- Unit/[UnitProps]($quantity) - A named unit of measure which can be located by its name or label.
- [UnitsProvider]($quantity) - A class that will also locate the UnitProps for a unit given name or label. This class will also provide a [UnitConversion]($quantity) to convert from one unit to another.
- Unit Family/[Phenomenon]($ecschema-metadata) - The physical quantity that this unit measures (e.g., length, temperature, pressure).  Only units in the same phenomenon can be converted between.
- Persistence Unit - The unit used to store the quantity value in memory or to persist the value in an editable IModel. While there is **NO** explicit flag or property to denote a persistence unit, those units are typically a part of the `Units.SI` [UnitSystem]($ecschema-metadata). The unit conversion of any persistence unit should both have its numerator and denominator set to 1.
- Format/FormatProp - The display format for the quantity value. For example, an angle may be persisted in radians but formatted and shown to user in degrees.
  - CompositeValue - An addition to the format specification that allows the explicit specification of a unit label, it also allows the persisted value to be displayed as up to 4 sub-units. Typical multi-unit composites are used to display `feet'-inches"` and `degree°minutes'seconds"`.
- [FormatterSpec]($quantity) - Holds the format specification as well as the [UnitConversion]($quantity) between the persistence unit and all units defined in the format. This is done to avoid any async calls by the UnitsProvider during the formatting process.
- [ParserSpec]($quantity) - Holds the format specification as well as the [UnitConversion]($quantity) between the persistence unit and all other units in the same phenomenon. This is done to avoid async calls by the UnitsProvider and also done to allow a user to enter `43in` even when in "metric" unit system and have the string properly converted to meters.
- [Formatter]($quantity) - A class that holds methods to format a quantity value into a text string. Given a FormatterSpec object - containing one or many Unit definitions each with their own Unit Conversion info and a Format passed in - and a single `magnitude` number, the Formatter can convert that number into a text string, adhering to the properties passed to the formatTraits of a Format.
- [Parser]($quantity) - A class that holds methods to parse a text string into a single number. Given a ParserSpec object containing a Format's Units and their Unit Conversions, as well as an input string, the Parser can either return an object `QuantityParseResult` that contains the magnitude of type `number`, or an object `ParseQuantityError`.

See the [iTwin.js](https://www.itwinjs.org/learning/frontend/quantityformatting/#quantity-package) documentation on quantity formatting for more information.

## How Formatting Works

Client-facing applications typically use the [QuantityFormatter](https://www.itwinjs.org/reference/core-frontend/quantityformatting/quantityformatter/) found in [core-frontend]($frontend) as the entry point to formatting and parsing. For more specific use cases, the primitive [Parser]($quantity) and [Formatter]($quantity) found in [core-quantity]($quantity) can be used.

TODO: Keep spelunking the workflow, document on when UnitsProvider comes into the start of the workflow

### What holds and/or creates Unit Conversions
When FormatterSpec and ParserSpec are initialized, they ask for the unit conversions of each unit passed into the single created `Format` object. These unit conversions typically come from an implemented `UnitsProvider`.

### Examples of Usage

#### Formatting Examples
