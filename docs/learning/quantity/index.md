# Quantity Formatting And Parsing

- [Quantity Formatting And Parsing](#quantity-formatting-and-parsing)
  - [Terms and Concepts](#terms-and-concepts)
    - [Common Terms](#common-terms)
    - [FormatProps](#formatprops)
    - [Concepts](#concepts)
      - [Units Provider](#units-provider)
      - [Unit Conversion](#unit-conversion)
    - [Examples of Usage](#examples-of-usage)
      - [Numeric Format](#numeric-format)
      - [Composite Format](#composite-format)
      - [Parsing Values](#parsing-values)
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

#### Units Provider

To appropriately parse and output formatted values, a units provider is used to define all available units and provides conversion factors between units. There are several implementations of the UnitsProvider across iTwin.js:

The [BasicUnitsProvider]($frontend) holds many common units and their conversions between each other.

The [SchemaUnitProvider]($ecschema-metadata) is used to load unit definitions of schemas from an iModel. This holds more extensive units through the Units schema, while also allowing users to define their own units.

The [AlternateUnitLabelsProvider]($quantity) interface allows users to specify a set of alternate labels which may be encountered during parsing of strings. By default only the input unit label and the labels of other units in the same Unit Family/Phenomenon, as well as the label of units in a Composite format are used.

#### Unit Conversion

Unit conversion is performed through a [UnitConversionSpec]($quantity). These objects are generated by a `UnitsProvider`, with the implementation determined by each specific provider. During initialization, a `ParserSpec` or `FormatterSpec` can ask for `UnitConversionSpec` objects provided via the `UnitsProvider`. During parsing and formatting, the specification will retrieve the `UnitConversionSpec` between the source and destination units to apply the unit conversion.

### Examples of Usage

#### Numeric Format

  The example below uses a simple numeric format and generates a formatted string with 4 decimal place precision. For numeric formats there is no conversion to other units; the unit passed in is the unit returned with the unit label appended if "showUnitLabel" trait is set.
<details>
<summary>Example Code</summary>

```ts
    import { BasicUnitsProvider } from "@itwin/core-frontend";
    import { BasicUnit, Format, FormatterSpec } from "@itwin/core-quantity";

    const unitsProvider = new BasicUnitsProvider();
    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel", "trailZeroes", "use1000Separator"],
      precision: 4,
      type: "Decimal",
      uomSeparator: " ",
      thousandSeparator: ",",
      decimalSeparator: ".",
    };

    // generate a Format from FormatProps to display 4 decimal place value
    const format = new Format("4d");
    // load the format props into the format, since unit provider is used to validate units the call must be asynchronous.
    await format.fromJSON(unitsProvider, formatData);

    // define input/output unit
    const unitName = "Units.FT";
    const unitLabel = "ft";
    const unitFamily = "Units.LENGTH";
    const inUnit = new BasicUnit(unitName, unitLabel, unitFamily);

    const magnitude = -12.5416666666667;

    // create the formatter spec - the name is not used by the formatter it is only
    // provided so user can cache formatter spec and then retrieve spec via its name.
    const spec = await FormatterSpec.create("test", format, unitsProvider, inUnit);

    // apply the formatting held in FormatterSpec
    const formattedValue = spec.applyFormatting(magnitude);

    // result in formattedValue of "-12.5417 ft"
```

</details>

#### Composite Format

For the composite format below, we provide a unit in meters and produce a formatted string showing feet and inches to a precision of 1/8th inch.

<details>
<summary>Example Code</summary>

```ts
    import { BasicUnit, Format, FormatterSpec } from "@itwin/core-quantity";

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };

    // generate a Format from FormatProps to display feet and inches
    const format = new Format("fi8");
    // load the format props into the format, since unit provider is used to validate units the call must be asynchronous.
    await format.fromJSON(unitsProvider, formatData);

    // define input unit
    const unitName = "Units.M";
    const unitLabel = "m";
    const unitFamily = "Units.LENGTH";
    const inUnit = new BasicUnit(unitName, unitLabel, unitFamily);

    const magnitude = 1.0;

    // create the formatter spec - the name is not used by the formatter it is only
    // provided so user can cache formatter spec and then retrieve spec via its name.
    const spec = await FormatterSpec.create("test", format, unitsProvider, inUnit);

    // apply the formatting held in FormatterSpec
    const formattedValue = spec.applyFormatting(magnitude);

    // result in formattedValue of 3'-3 3/8"
```

</details>

#### Parsing Values

<details>
  <summary>Example Code:</summary>

```ts
  import { Format, ParserSpec } from "@itwin/core-quantity";

  // define output unit and also used to determine the unit family used during parsing
  const outUnit = await unitsProvider.findUnitByName("Units.M");

  const formatData = {
    composite: {
      includeZero: true,
      spacer: "-",
      units: [{ label: "'", name: "Units.FT" }, { label: "\"", name: "Units.IN" }],
    },
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 8,
    type: "Fractional",
    uomSeparator: "",
  };

  // generate a Format from FormatProps used to determine possible labels
  const format = new Format("test");
  await format.fromJSON(unitsProvider, formatData);

  const inString = "2FT 6IN";

  // create the parserSpec spec which will hold all unit conversions from possible units to the output unit
  const parserSpec = await ParserSpec.create(format, unitsProvider, outUnit, unitsProvider);
  const parseResult = parserSpec.parseToQuantityValue(inString);
  //  parseResult.value 0.762  (value in meters)
```

</details>

### Mathematical Operation Parsing

The quantity formatter supports parsing mathematical operations. The operation is solved, formatting each value present, according to the specified format. This makes it possible to process several different units at once.

<details>
<summary>Example Code</summary>

```Typescript
  import { BasicUnitsProvider } from "@itwin/core-frontend";
  import { Format, Parser } from "@itwin/core-quantity";

  const unitsProvider = new BasicUnitsProvider(); // If @itwin/core-frontend is available, can use IModelApp.quantityFormatter.unitsProvider
  const formatData = {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 8,
    type: "Fractional",
    uomSeparator: "",
    allowMathematicOperations: true,
  };

  const format = new Format("exampleFormat");
  await format.fromJSON(unitsProvider, formatData);
  // Operation containing many units (feet, inches, yards).
  const mathematicalOperation = "5 ft + 12 in + 1 yd -1 ft 6 in";

  // Asynchronous implementation
  const quantityProps = await Parser.parseIntoQuantity(mathematicalOperation, format, unitsProvider);
  // quantityProps.magnitude 7.5 (value in feet)

  // Synchronous implementation
  const parseResult = Parser.parseToQuantityValue(mathematicalOperation, format, feetConversionSpecs);
  // parseResult.value 7.5 (value in feet)
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
    let formatProps = {
      ...
      composite: {
        includeZero: true,
        spacer: "-", // When omitted, the spacer defaults to " "
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: `"`,
            name: "Units.IN",
          },
        ],
      },
      allowMathematicOperations: true, // We turn on the spacer
    };
    let format = await Format.createFromJSON("mathAllowedFormat", unitsProvider, formatProps);
    const outUnit = await unitsProvider.findUnit("m", "Units.LENGTH");
    const parserSpec = await ParserSpec.create(format, unitsProvider, outUnit);
    // The spacer property from formatProps is ignored, so the two results below are the same.
    let result = parserSpec.parseToQuantityValue("-2FT-6IN + 6IN"); // -0.6096 in meters
    result = parserSpec.parseToQuantityValue("-2FT 6IN + 6IN"); // -0.6096 in meters

```

</details>

2. For a value like `2FT 6IN-0.5`, the `-` sign will be treated as a spacer and not subtraction. However, the `0.5` value will use the default unit conversion provided to the parser, because it's not a part of the composite unit when that composite is made up of only 2 units - `FT` and `IN`.

<details>
<summary>Example:</summary>

```Typescript
    let formatProps = {
      ...
      composite: {
        includeZero: true,
        spacer: "-", // When omitted, the spacer defaults to " "
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: `"`,
            name: "Units.IN",
          },
        ],
      },
      allowMathematicOperations: true, // We turn on the spacer
    };
    let format = await Format.createFromJSON("mathAllowedFormat", unitsProvider, formatProps);
    const outUnit = await unitsProvider.findUnit("m", "Units.LENGTH");
    const parserSpec = await ParserSpec.create(format, unitsProvider, outUnit);
    // The spacer property from formatProps is ignored, so the two results below are the same.
    let result = parserSpec.parseToQuantityValue("-2FT 6IN-0.5"); // -2.5 FT and 0.5 FT -> -0.6096 in meters
    result = parserSpec.parseToQuantityValue("-2FT 6IN + 6IN"); // -0.6096 in meters

```

</details>
