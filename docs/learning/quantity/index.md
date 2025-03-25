# Quantity Formatting And Parsing

- [Quantity Formatting And Parsing](#quantity-formatting-and-parsing)
  - [Terms and Concepts](#terms-and-concepts)
    - [Common Terms](#common-terms)
    - [FormatProps](#formatprops)
    - [Concepts](#concepts)
      - [Formats Provider](#formats-provider)
      - [Units Provider](#units-provider)
      - [Unit Conversion](#unit-conversion)
  - [Persistence](#persistence)
    - [FormatSet](#formatset)
  - [Examples of Usage](#examples-of-usage)
    - [Numeric Format](#numeric-format)
    - [Composite Format](#composite-format)
    - [Parsing Values](#parsing-values)
    - [Using a FormatsProvider](#using-a-formatsprovider)
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
- Persistence Unit - The unit used to store the quantity value in memory or to persist the value in an editable iModel. iModels define the persistence unit through [KindOfQuantity]($docs/bis/ec/kindofquantity/) objects.
- [KindOfQuantity]($docs/bis/ec/kindofquantity/) - An object that defines a persistence unit and presentation formats.
- [Format]($quantity) - The display format for the quantity value. For example, an angle may be persisted in radians but formatted and shown to user in degrees.
- CompositeValue - An addition to the format specification that allows the explicit specification of a unit label, it also allows the persisted value to be displayed as up to 4 sub-units. Typical multi-unit composites are used to display `feet'-inches"` and `degree°minutes'seconds"`.
- [FormatterSpec]($quantity) - Holds the format specification as well as the [UnitConversion]($quantity) between the persistence unit and all units defined in the format. This is done to avoid any async calls by the `UnitsProvider` during the formatting process.
- [ParserSpec]($quantity) - Holds the format specification as well as the [UnitConversion]($quantity) between the persistence unit and all other units in the same phenomenon. This is done to avoid async calls by the `UnitsProvider` and to allow users to input quantities in different unit systems than specified. For instance, if a metric unit system is set, a user could enter `43in` and have the result properly converted to meters.
- [Formatter]($quantity) - A class that holds methods to format a quantity value into a text string. Given a `FormatterSpec` object — which includes one or more unit definitions, each with their own conversion information and a specified format — and a single magnitude number, the `Formatter` can convert this number into a text string, adhering to the properties specified in the `formatTraits`.
- [Parser]($quantity) - A class that holds methods to parse a text string into a single number. Given a `ParserSpec` object containing a Format's Units and their Unit Conversions, as well as an input string, the Parser can either return an object `QuantityParseResult` that contains the magnitude of type `number`, or an object `ParseQuantityError`.

### FormatProps

For a detailed description of all the setting supported by FormatProp see the EC documentation on [Format](../../bis/ec/ec-format.md).

### Concepts

#### Formats Provider

A [FormatsProvider]($ecschema-metadata) interface helps provide all the necessary formats for displaying formatted quantity values, while also enabling users to add formats of their own.

The [SchemaFormatsProvider]($ecschema-metadata) takes in a [SchemaContext]($ecschema-metadata), to provide default Formats coming from schemas.

> Adding a format to a SchemaFormatsProvider will not modify the schema, it will only populate the format cache of the provider.

#### Units Provider

To appropriately parse and output formatted values, a units provider is used to define all available units and provides conversion factors between units. There are several implementations of the UnitsProvider across iTwin.js:

The [BasicUnitsProvider]($quantity) holds many common units and their conversions between each other.

The [SchemaUnitProvider]($ecschema-metadata) is used to load unit definitions of schemas from an iModel. This holds more extensive units through the Units schema, while also allowing users to define their own units.

The [AlternateUnitLabelsProvider]($quantity) interface allows users to specify a set of alternate labels which may be encountered during parsing of strings. By default only the input unit label and the labels of other units in the same Unit Family/Phenomenon, as well as the label of units in a Composite format are used.

#### Unit Conversion

Unit conversion is performed through a [UnitConversionSpec]($quantity). These objects are generated by a `UnitsProvider`, with the implementation determined by each specific provider. During initialization, a `ParserSpec` or `FormatterSpec` can ask for `UnitConversionSpec` objects provided via the `UnitsProvider`. During parsing and formatting, the specification will retrieve the `UnitConversionSpec` between the source and destination units to apply the unit conversion.

## Persistence

We expose APIs and interfaces to support persistence of formats. Different from [KindOfQuantity](../../bis/ec/kindofquantity.md), which enables persistence of formats at the schema level, this section covers persistence at the application level.

### FormatSet

[FormatSet]($ecschema-metadata) defines properties necessary to support persistence of a set of formats.

Each Format defined in a FormatSet need to be mapped to a valid [ECName](../../bis/ec/ec-name.md) for a [KindOfQuantity](../../bis/ec/kindofquantity.md). During an application's runtime, the format associated to a KindofQuantity within a FormatSet would take precedence and be used over the default presentation formats of that KindOfQuantity.

> The naming convention for a valid format within a FormatSet is <full-schema-name>:<koq-name>
.
<details>
<summary>Example of a metric-based FormatSet as JSON:</summary>

```json
{
  "name": "metric",
  "label": "Metric",
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
<summary>Example of a imperial-based FormatSet as JSON:</summary>

```json
{
  "name": "imperial",
  "label": "Imperial",
  "formats": {
    "AecUnits.LENGTH": {
      "composite": {
        "includeZero": true,
        "spacer": "",
        "units": [{ "label": "'", "name": "Units.FT" }, { "label": "\"", "name": "Units.IN" }],},
      "formatTraits": ["keepSingleZero", "showUnitLabel"],
      "precision": 4,
      "type": "Decimal",
    },
    "AecUnits.Angle": {
      "description": "degrees minutes seconds (labeled) 0 decimal places",
      "composite": {
        "includeZero": true,
        "spacer": "",
        "units": [{ "label": "°", "name": "Units.ARC_DEG" }, { "label": "'", "name": "Units.ARC_MINUTE" }, { "label": "\"", "name": "Units.ARC_SECOND" }],
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

## Examples of Usage

### Numeric Format

  The example below uses a simple numeric format and generates a formatted string with 4 decimal place precision. For numeric formats there is no conversion to other units; the unit passed in is the unit returned with the unit label appended if "showUnitLabel" trait is set.
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
  <summary>Example Code:</summary>

```ts
[[include:Quantity_Formatting.Simple_Parsing]]
```

</details>

### Using a FormatsProvider

The example below uses the SchemaFormatsProvider, an implementation of a FormatsProvider, found in `ecschema-metadata` to parse and format values associated with the length of an object.

<details>
  <summary>Example of Formatting</summary>

```ts
[[include:Quantity_Formatting.Schema_Formats_Provider_Simple_Formatting]]
```

</details>

<details>
  <summary>Example of Parsing</summary>

```ts
[[include:Quantity_Formatting.Schema_Formats_Provider_Simple_Parsing]]
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
<summary>Example:</summary>

```Typescript
[[include:Quantity_Formatting.Math_Whitespace_Limitation]]
```

</details>

2. For a value like `2FT 6IN-0.5`, the `-` sign will be treated as a spacer and not subtraction. However, the `0.5` value will use the default unit conversion provided to the parser, because it's not a part of the composite unit when that composite is made up of only 2 units - `FT` and `IN`.

<details>
<summary>Example:</summary>

```Typescript
[[include:Quantity_Formatting.Math_Composite_Limitation]]
```

</details>

