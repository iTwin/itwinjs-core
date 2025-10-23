# Quantity Formatting And Parsing

- [Quantity Formatting And Parsing](#quantity-formatting-and-parsing)
  - [Terms and Concepts](#terms-and-concepts)
    - [Common Terms](#common-terms)
    - [FormatProps](#formatprops)
    - [Station Format Properties](#station-format-properties)
      - [stationOffsetSize](#stationoffsetsize)
      - [stationBaseFactor](#stationbasefactor)
        - [Station Format Examples](#station-format-examples)
    - [Concepts](#concepts)
      - [Formats Provider](#formats-provider)
      - [Units Provider](#units-provider)
      - [Unit Conversion](#unit-conversion)
      - [Parser Behavior](#parser-behavior)
  - [Persistence](#persistence)
    - [FormatSet](#formatset)
  - [Using KindOfQuantities to Retrieve Formats](#using-kindofquantities-to-retrieve-formats)
  - [Examples of Usage](#examples-of-usage)
    - [Numeric Format](#numeric-format)
    - [Composite Format](#composite-format)
    - [Parsing Values](#parsing-values)
    - [Using a FormatsProvider](#using-a-formatsprovider)
    - [Retrieving a FormatProp, and a PersistenceUnit with only a KindOfQuantity Name and through schemas](#retrieving-a-formatprop-and-a-persistenceunit-with-only-a-kindofquantity-name-and-through-schemas)
    - [Using a MutableFormatsProvider](#using-a-mutableformatsprovider)
    - [Using a FormatSetFormatsProvider](#using-a-formatsetformatsprovider)
    - [Registering a SchemaFormatsProvider on IModelConnection open](#registering-a-schemaformatsprovider-on-imodelconnection-open)
    - [Mathematical Operation Parsing](#mathematical-operation-parsing)
      - [Limitations](#limitations)

The __@itwin/core-quantity__ package contains classes for quantity formatting and parsing.
For detailed API documentation, see our [iTwin.js reference documentation](https://www.itwinjs.org/reference/core-quantity/quantity/).

If you're developing a frontend application that takes advantage of the core quantity APIs, also check out the [iTwin.js frontend quantity formatting learning section](../frontend/QuantityFormatting.md).

## Terms and Concepts

### Common Terms

- Unit - A named unit of measure which can be located by its name or label. The definition of any unit is represented through its [UnitProps]($quantity).
- [UnitsProvider]($quantity) - An interface that locates the `UnitProps` for a unit given name or label. This interface also provides methods for [UnitConversion]($quantity) to allow converting from one unit to another.
- Unit Family/[Phenomenon]($ecschema-metadata) - A physical quantity that can be measured (e.g., length, temperature, pressure).  Only units in the same phenomenon can be converted between.
- Persistence Unit - The unit used to store the quantity value in memory or to persist the value in an editable [iModel](../../learning/iModels.md). iModels define the persistence unit through [KindOfQuantity]($docs/bis/ec/kindofquantity/) objects.
- [KindOfQuantity]($docs/bis/ec/kindofquantity/) - An object that defines a persistence unit and presentation formats.
- [Format]($quantity) - The display format for the quantity value. For example, an angle may be persisted in radians but formatted and shown to user in degrees.
- CompositeValue - An addition to the format specification that allows the explicit specification of a unit label, it also allows the persisted value to be displayed as up to 4 sub-units. Typical multi-unit composites are used to display `feet'-inches"` and `degree°minutes'seconds"`.
- [FormatterSpec]($quantity) - Holds the format specification as well as the [UnitConversion]($quantity) between the persistence unit and all units defined in the format. This is done to avoid any async calls by the `UnitsProvider` during the formatting process.
- [ParserSpec]($quantity) - Holds the format specification as well as the [UnitConversion]($quantity) between the persistence unit and all other units in the same `Phenomenon`. This is done to avoid async calls by the `UnitsProvider` and to allow users to input quantities in different unit systems than specified. For instance, if a metric unit system is set, a user could enter `43in` and have the result properly converted to meters.
- [Formatter]($quantity) - A class that holds methods to format a quantity value into a text string. Given a `FormatterSpec` object — which includes one or more unit definitions, each with their own conversion information and a specified `Format` — and a single magnitude number, the `Formatter` can convert this number into a text string, adhering to the properties specified in `formatTraits`.
- [Parser]($quantity) - A class that holds methods to parse a text string into a single number. Given a `ParserSpec` object containing a `Format` `Units` and their unit conversions, as well as an input string, the Parser can either return an object `QuantityParseResult` that contains the magnitude of type `number`, or an object `ParseQuantityError`.

### FormatProps

For a detailed description of all the setting supported by FormatProp see the EC documentation on [Format](../../bis/ec/ec-format.md).

### Station Format Properties

Station formatting in iTwin.js supports properties that control how values are broken down into major and minor station components:

#### stationOffsetSize

The `stationOffsetSize` property specifies the number of decimal places for calculating the station offset magnitude. This must be a positive integer greater than 0. This works with `stationBaseFactor` to determine the effective station offset using the formula: `effective offset = stationBaseFactor * 10^stationOffsetSize`.

#### stationBaseFactor

The `stationBaseFactor` property provides additional flexibility for station formatting by acting as a multiplier for the base offset calculation. This allows for non-standard station intervals that aren't simple powers of 10. The default value is 1.

> __Note__: The `stationBaseFactor` property is currently implemented as an iTwin.js-specific extension and is not supported in the native EC (Entity Context) layer. This feature will eventually be incorporated into the ECFormat specification to provide broader compatibility across the iTwin ecosystem.

##### Station Format Examples

| stationOffsetSize | stationBaseFactor | Value  | Effective Offset | Formatted |
| ----------------- | ----------------- | ------ | ---------------- | --------- |
| 2                 | 1                 | 1055.5 | 100              | 10+55.50  |
| 3                 | 1                 | 1055.5 | 1000             | 1+055.50  |
| 2                 | 5                 | 1055.5 | 500              | 2+55.50   |

In the examples above:

- With `stationOffsetSize=2` and `stationBaseFactor=1`: effective offset = 1 × 10² = 100
- With `stationOffsetSize=3` and `stationBaseFactor=1`: effective offset = 1 × 10³ = 1000
- With `stationOffsetSize=2` and `stationBaseFactor=5`: effective offset = 5 × 10² = 500

### Concepts

#### Formats Provider

The [FormatDefinition]($quantity) interface is an extension of FormatProps to help identify formats.

A [FormatsProvider]($quantity) interface helps provide all the necessary `Formats` for displaying formatted quantity values, while also enabling users to add formats of their own.

A [MutableFormatsProvider]($quantity) interface extends the read-only `FormatsProvider` above by allowing adding or removing `Formats` to the provider.

The [SchemaFormatsProvider]($ecschema-metadata) takes in a [SchemaContext]($ecschema-metadata), to provide `Formats` coming from schemas. The `SchemaFormatsProvider` also requires a [UnitSystemKey]($quantity) passed in to filter the [FormatDefinition]($quantity) returned, according to the current unit system set in the `SchemaFormatsProvider`. When getting a format, the `SchemaFormatsProvider` will throw an error if it receives a non-valid [EC full name](https://www.itwinjs.org/bis/ec/ec-name/#full-name).

The [FormatSetFormatsProvider]($ecschema-metadata) is a mutable format provider that manages format definitions within a [FormatSet](#formatset). This provider automatically updates the underlying format set when formats are added or removed, making it ideal for applications that need to persist format changes. It also supports an optional fallback provider to provide formats not found in the format set.

#### Units Provider

To appropriately parse and output formatted values, a units provider is used to define all available units and provides conversion factors between units. There are several implementations of the [UnitsProvider]($quantity) across iTwin.js:

The [BasicUnitsProvider]($frontend) holds many common units and their conversions between each other.

The [SchemaUnitProvider]($ecschema-metadata) is used to load unit definitions of schemas from an iModel. This holds more extensive units through the Units schema, while also allowing users to define their own units.

The [AlternateUnitLabelsProvider]($quantity) interface allows users to specify a set of alternate labels which may be encountered during parsing of strings. By default only the input unit label and the labels of other units in the same Unit Family/Phenomenon, as well as the label of units in a Composite format are used.

#### Unit Conversion

Unit conversion is performed through a [UnitConversionSpec]($quantity). These objects are generated by a `UnitsProvider`, with the implementation determined by each specific provider. During initialization, a `ParserSpec` or `FormatterSpec` can ask for `UnitConversionSpec` objects provided via the `UnitsProvider`. During parsing and formatting, the specification will retrieve the `UnitConversionSpec` between the source and destination units to apply the unit conversion.

#### Parser Behavior

The [Parser]($quantity) converts text strings into numeric quantity values by tokenizing the input and matching unit labels to known units. The parsing process follows these steps:

1. __Tokenization__: The input string is broken down into tokens representing numbers, unit labels, and mathematical operators (if enabled).

2. __Unit Label Matching__: For each unit label token found, the parser attempts to match it against:
   - Units explicitly defined in the format specification
   - Units from the same phenomenon (unit family) provided by the `UnitsProvider`
   - Alternate labels defined through the `AlternateUnitLabelsProvider`

3. __Error Handling__: The parser's behavior when encountering unrecognized unit labels depends on the format configuration:
   - __Unitless Format__ (no units defined in format): If a unit label is provided but cannot be matched to any known unit, the parser returns `ParseError.UnitLabelSuppliedButNotMatched`. This prevents silent failures where typos like "12 im" (instead of "12 in") would incorrectly parse as "12 meters" when the persistence unit is meters.
   - __Format with Units__ (units explicitly defined): If an unrecognized unit label is provided (e.g., "12 ABCDEF"), the parser falls back to the format's default unit for backward compatibility. For example, with a feet format, "12 ABCDEF" would parse as "12 feet".

4. __Default Unit Behavior__: If no unit label is provided in the input (e.g., just "12"), the parser uses the default unit specified in the format. For unitless formats, if the input contains multiple unit labels, the first successfully matched unit becomes the default for subsequent unitless values in the same expression.

5. __Unit Conversion__: Once units are matched, the parser applies the appropriate unit conversions to produce a value in the persistence unit specified by the `ParserSpec`.

This error handling ensures that parsing errors are caught in unitless format contexts, preventing data corruption from unrecognized or mistyped unit labels, while maintaining backward compatibility for formats with explicitly defined units.

## Persistence

We expose APIs and interfaces to support persistence of formats. Different from [KindOfQuantity](../../bis/ec/kindofquantity.md), which enables persistence of formats at the schema level, this section covers persistence at the application level.

### FormatSet

[FormatSet]($ecschema-metadata) defines properties necessary to support persistence of a set of `Formats`.

> Each `Format` defined in a `FormatSet` need to be mapped to a valid [ECName](../../bis/ec/ec-name.md) for a [KindOfQuantity](../../bis/ec/kindofquantity.md). During an application's runtime, the `Format` associated to a `KindofQuantity` within a `FormatSet` would take precedence and be used over the default presentation formats of that `KindOfQuantity`.

- The `unitSystem` property uses a [UnitSystemKey]($quantity) to specify the unit system for the format set. This provides better type safety and leads to less dependency on `activeUnitSystem` in `IModelApp.quantityFormatter`. Tools using the new formatting API can then listen to only the `onFormatsChanged` event from `IModelApp.formatsProvider` instead of `IModelApp.quantityFormatter.onActiveUnitSystemChanged`.

- The `formats` property accepts either a [FormatDefinition]($quantity) or a string reference to another KindOfQuantity. This allows one format to reference another format's definition, reducing duplication when multiple KindOfQuantities should share the same format specification. For example, `"AecUnits.LENGTH": "RoadRailUnits.LENGTH"` creates an alias where `AecUnits.LENGTH` uses the same format from `RoadRailUnits.LENGTH`.

> The naming convention for a valid format within a FormatSet is <full-schema-name>:<koq-name>
.
<details>
<summary>Example of a metric-based FormatSet as JSON</summary>

```json
{
  "name": "metric",
  "label": "Metric",
  "unitSystem": "metric",
  "formats": {
    "AecUnits.LENGTH": {
      "composite": {
        "includeZero": true,
        "spacer": "",
        "units": [{ "label": "m", "name": "Units.M" }]
      },
      "formatTraits": ["keepSingleZero", "showUnitLabel"],
      "precision": 4,
      "type": "Decimal",
      "decimalSeparator": "."
    },
    "AecUnits.Angle": {
      "description": "degrees (labeled) 2 decimal places",
      "composite": {
        "includeZero": true,
        "spacer": "",
        "units": [{ "label": "°", "name": "Units.ARC_DEG" }]
      },
      "formatTraits": ["keepSingleZero", "showUnitLabel"],
      "precision": 2,
      "type": "Decimal",
      "uomSeparator": ""
    }
  }
}
```

</details>

<details>
<summary>Example of a imperial-based FormatSet as JSON</summary>

```json
{
  "name": "imperial",
  "label": "Imperial",
  "unitSystem": "imperial",
  "formats": {
    "AecUnits.LENGTH": {
      "composite": {
        "includeZero": true,
        "spacer": "",
        "units": [{ "label": "'", "name": "Units.FT" }, { "label": "\"", "name": "Units.IN" }]},
      "formatTraits": ["keepSingleZero", "showUnitLabel"],
      "precision": 4,
      "type": "Decimal",
    },
    "AecUnits.Angle": {
      "description": "degrees minutes seconds (labeled) 0 decimal places",
      "composite": {
        "includeZero": true,
        "spacer": "",
        "units": [{ "label": "°", "name": "Units.ARC_DEG" }, { "label": "'", "name": "Units.ARC_MINUTE" }, { "label": "\"", "name": "Units.ARC_SECOND" }]
      },
      "formatTraits": ["keepSingleZero", "showUnitLabel"],
      "precision": 2,
      "type": "Decimal",
      "uomSeparator": ""
    }
  }
}
```

</details>

## Using KindOfQuantities to Retrieve Formats

Building off of [FormatSet](#formatset), Tools and components that format quantities across applications should be linked to a [KindOfQuantity](../../bis/ec/kindofquantity.md) and a Persistence Unit. See [Domains](../../bis/domains/index.md) for available schemas, including `AecUnits` and `RoadRailUnits`, which define many `KindOfQuantity` values.

The table below lists common measurements with their typical `KindOfQuantity` and Persistence Unit. This allows tools to request a default `KindOfQuantity` from [IModelApp.formatsProvider]($core-frontend) and a Persistence Unit from [IModelApp.quantityFormatter]($core-frontend) to create a `FormatterSpec` for quantity formatting.

| Measurement  | Actual KindOfQuantity (EC Full Name) | Persistence Unit |
| ------------- | ------------- | ------------- |
| Length  |  AecUnits.LENGTH | Units.M |
| Angle  | AecUnits.ANGLE  | Units.RAD |
| Area  |  AecUnits.AREA | Units.SQ_M |
| Volume  | AecUnits.VOLUME  | Units.CUB_M |
| Latitude/Longitude | AecUnits.ANGLE | Units.RAD |
| Coordinate | AecUnits.LENGTH_COORDINATE | Units.M |
| Stationing | RoadRailUnits.STATION | Units.M |
| Length (Survey Feet) | RoadRailUnits.LENGTH | Units.M |
| Bearing | RoadRailUnits.BEARING | Units.RAD |
| Weight | AecUnits.WEIGHT | Units.KG |
| Time | AecUnits.TIME | Units.S |

## Examples of Usage

### Numeric Format

The example below uses a simple numeric format and generates a formatted string with 4 decimal place precision. For numeric formats there is no conversion to other units; the unit passed in is the unit returned with the unit label appended if `showUnitLabel` trait is set.
<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.Numeric]]
```

</details>

### Composite Format

For the composite format below, we provide a unit in meters and produce a formatted string showing feet and inches to a precision of 1/8th inch.

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.Composite]]
```

</details>

### Parsing Values

<details>
  <summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.Simple_Parsing]]
```

</details>

### Using a FormatsProvider

The example below uses the `SchemaFormatsProvider`, an implementation of a `FormatsProvider`, found in `ecschema-metadata` to format values associated with the length of an object.

<details>
  <summary>Example of Formatting</summary>

```ts
[[include:Quantity_Formatting.Schema_Formats_Provider_Simple_Formatting]]
```

</details>

The example below uses the `SchemaFormatsProvider`, an implementation of a `FormatsProvider`, found in `ecschema-metadata` to parse values associated with the length of an object.

<details>
  <summary>Example of Parsing</summary>

```ts
[[include:Quantity_Formatting.Schema_Formats_Provider_Simple_Parsing]]
```

</details>

When retrieving a format from a schema, users might want to ensure the format they get matches the unit system they are currently using. They can either pass in the unit system on initialization, or change them after initialization, like so:

<details>
  <summary>Example of Formatting with Unit System</summary>

```ts
[[include:Quantity_Formatting.Schema_Formats_Provider_Simple_Formatting_With_Unit_System]]
```

</details>

### Retrieving a FormatProp, and a PersistenceUnit with only a KindOfQuantity Name and through schemas

When working with formats, developers often need to retrieve a format and determine the appropriate persistence unit. When you only have a KindOfQuantity name, you can utilize a SchemaContext to find the schema item for that KindOfQuantity and then access its persistence unit:

<details>
  <summary>Using a SchemaContext to get KindOfQuantity and a persistence unit<summary>

```ts
[[include:Quantity_Formatting.KindOfQuantityPersistenceUnitFormatting]]
```

</details>

### Using a MutableFormatsProvider

The example below is of a `MutableFormatsProvider` that lets you add/remove formats during runtime.

<details>
  <summary>Example of a MutableFormatsProvider implementation</summary>

```ts
[[include:Quantity_Formatting.Mutable_Formats_Provider]]
```

```ts
[[include:Quantity_Formatting.Mutable_Formats_Provider_Adding_A_Format]]
```

</details>

### Using a FormatSetFormatsProvider

The [FormatSetFormatsProvider]($ecschema-metadata) provides a convenient way to manage formats within a `FormatSet` while supporting runtime modifications. This provider is particularly useful when you need to persist format changes or override default schema formats.

__Key Features:__

- __String Reference Resolution__: Automatically resolves string references to their target FormatDefinition. When a format references another via string (e.g., `"AecUnits.LENGTH": "RoadRailUnits.LENGTH"`), the provider will resolve and return the actual FormatDefinition.
- __Chain Resolution__: Supports chains of references with circular reference detection (e.g., HEIGHT → DISTANCE → LENGTH).
- __Cascade Notifications__: When a format is added or removed, all formats that reference it are included in the `onFormatsChanged` event, enabling proper cache invalidation.
- __Fallback Provider__: Supports an optional fallback provider for formats not found in the format set.

Here's a working example that demonstrates string reference resolution with formatting:

<details>
  <summary>Example of using FormatSetFormatsProvider</summary>

```ts
[[include:Quantity_Formatting.FormatSet_Formats_Provider_With_String_References]]
```

</details>

### Registering a SchemaFormatsProvider on IModelConnection open

The simplest way to get formats from schemas into an iTwin application is to register a new `SchemaFormatsProvider` through a [IModelConnection.onOpen]($core-frontend) event listener, passing [IModelConnection.schemaContext]($core-frontend) to the provider. The example below illustrates how that can be done.

<details>
  <summary> Example of registering a SchemaFormatsProvider on IModelConnection open

```ts
[[include:Quantity_Formatting.Schema_Fmt_Provider_on_IModelConnection_Open]]
```

</details>

### Mathematical Operation Parsing

The quantity formatter supports parsing mathematical operations. The operation is solved, formatting each value present, according to the specified format. This makes it possible to process several different units at once.

<details>
<summary>Example Code</summary>

```Typescript
[[include:Quantity_Formatting.Basic_Math_Operations_Parsing]]
```

</details>

#### Limitations

Only plus(`+`) and minus(`-`) signs are supported for now.
Other operators will end up returning a parsing error or an invalid input result.
If a Format uses a spacer that conflicts with one of the operators above, additional restrictions will apply:

1. Mathematical operations only apply when the operator is in front of whitespace. So `-2FT 6IN + 6IN` is equal to `-2FT-6IN + 6IN`, and `-2FT-6IN - 6IN` is not equal to `-2FT-6IN- 6IN`.

<details>
<summary>Example</summary>

```Typescript
[[include:Quantity_Formatting.Math_Whitespace_Limitation]]
```

</details>

2. For a value like `2FT 6IN-0.5`, the `-` sign will be treated as a spacer and not subtraction. However, the `0.5` value will use the default unit conversion provided to the parser, because it's not a part of the composite unit when that composite is made up of only 2 units - `FT` and `IN`.

<details>
<summary>Example</summary>

```Typescript
[[include:Quantity_Formatting.Math_Composite_Limitation]]
```

</details>
