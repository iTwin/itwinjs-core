# Quantity Formatting

The iTwin.js offers two ways to format quantity values. The more primitive interface is found in the [Formatter]($quantity) in `core-quantity` package.

A more convenient interface to format and parse values is the [QuantityFormatter]($frontend) in the `core-frontend` package.  It is limited to formatting and parsing values for a fixed set of quantity types.

More detailed explanation can be found at [Quantity Formatting and Parsing](../quantity/index.md).

## QuantityFormatter

The [QuantityFormatter]($frontend) class formats quantities for interactive tools, such as the different measure tools, and is used to parse strings back into quantity values. The QuantityFormatter is not used to format properties stored in the iModel, as that is work is done on the back-end via the Presentation layer, but the QuantityFormatter can be set to format values in the same unit system as that used by the back-end. There are four Unit Systems definitions that is shared between the back-end Presentation Manager and the front-end QuantityFormatter:

- "metric"
- "imperial"
- "usCustomary"
- "usSurvey"

### QuantityType

There are nine built-in quantity types (see [QuantityType]($frontend)). The QuantityFormatter defines default a formatting specification for each of these types per unit system. IModelApp initialization calls the QuantityFormatter initialization, during which [FormatterSpec]($quantity) and [ParserSpec]($quantity) for each quantity type are generated asynchronously. This allows caller to get these objects via synchronous calls. Any time the unit system is set, a format is overridden, or a units provider is assigned the cached specs are updated.

 Custom quantity types that implement the [CustomQuantityTypeDefinition]($frontend) interface may also be registered with the QuantityFormatter, see method `registerQuantityType`. See example implementation of a custom type [here](https://github.com/iTwin/itwinjs-core/blob/5905cb1a48c4d790b5389d7f0ea141bc3ce95f23/test-apps/ui-test-app/src/frontend/api/BearingQuantityType.ts).

#### Migrating from QuantityType to KindOfQuantity

Starting in iTwin.js 5.0, we encourage developers to move away from using `QuantityType`, and to instead use `KindOfQuantity` [EC full names](https://www.itwinjs.org/bis/ec/ec-name/#full-name).

We encourage users to move away from `QuantityType` in favor of `KindOfQuantity` and by extension the [FormatsProvider]($quantity) to retrieve formats, as it enables users to access a broader range of formatting capabilities. While `QuantityType` was limited to a predefined set of nine built-in quantity types (e.g., Length, Angle, Area), the new `FormatsProvider` approach allows users to define and retrieve formats dynamically, without being constrained to a fixed list. A `FormatsProvider` is scalable, letting users work with formats defined in custom schemas, while a [MutableFormatsProvider]($quantity) lets users add or override formats to fit specific project needs. More information on `FormatsProvider` can be found in this learnings [section](../quantity/index.md/#formats-provider).

Here is a table of replacements for each `QuantityType`:

| QuantityType  | Actual KindOfQuantity (EC Full Name) |
| ------------- | ------------- |
| Length  |  AecUnits.LENGTH |
| Angle  | AecUnits.ANGLE  |
| Area  |  AecUnits.AREA |
| Volume  | AecUnits.VOLUME  |
| LatLong | AecUnits.ANGLE |
| Coordinate | AecUnits.LENGTH |
| Stationing | RoadRailUnits.STATION |
| LengthSurvey | RoadRailUnits.LENGTH |
| LengthEngineering | AecUnits.LENGTH |

[AecUnits](../../bis/domains/AecUnits.ecschema.md) is a Common layer schema that will be present in many iModels. [RoadRailUnits](../../bis/domains/RoadRailUnits.ecschema.md), a Discipline-Physical layer schema, contains Kind of Quantities used by Road & Rail schemas. More information on schemas and their different layers can be found in [Bis Organization](../../bis/guide/intro/bis-organization.md).

iModels might not have AecUnits or RoadRailUnits schemas included, in such cases developers can address this through integrating their tools/components to use a `FormatsProvider`, and add the missing KindOfQuantity (and associated [FormatProps]($quantity)) through that FormatsProvider, independent from schemas coming from iModels.

To support users with the migration, `IModelApp` by default uses an internal [QuantityTypeFormatsProvider]($frontend) that provides default `formatProps` associated to each KindOfQuantity in the table above, ensuring formatProps will always be available for those Kind Of Quantities out of the box. We still strongly encourage developers to either implement their own `FormatsProvider` or set a new [SchemaFormatsProvider]($ecschema-metadata) if possible and the application uses iModels.

We plan to deprecate `QuantityType` during the iTwin.js 5.x lifecycle.

### Overriding Default Formats

The `QuantityFormatter` provides the method `setOverrideFormats` which allows the default format to be overridden.  These overrides may be persisted by implementing the [UnitFormattingSettingsProvider]($frontend) interface in the QuantityFormatter. This provider can then monitor the current session to load the overrides when necessary. The class [LocalUnitFormatProvider]($frontend) can be used to store settings in local storage and to maintain overrides by iModel as shown below:

```ts
    await IModelApp.quantityFormatter.setUnitFormattingSettingsProvider(new LocalUnitFormatProvider(IModelApp.quantityFormatter, true));
```

This allows both the Presentation Unit System and the format overrides, set by the user, to stay in sync as the user opens different iModels.

### AlternateUnitLabelsProvider

The [QuantityFormatter]($frontend) provides a default set of alternate unit labels which are used when parsing strings to quantities. The interface [AlternateUnitLabelsProvider]($quantity) defines how alternate units are defined. One commonly specified alternate label is "^" to specify degrees, much easier to type than trying to figure out how to enter the default label for degree, "°".

To add custom labels use [QuantityFormatter.addAlternateLabels]($frontend) as shown in the examples below:

  ```ts
  IModelApp.quantityFormatter.addAlternateLabels("Units.ARC_DEG", "^");
  IModelApp.quantityFormatter.addAlternateLabels("Units.FT", "feet", "foot");
  ```

### Units Provider

A units provider is used to define all available units and provides conversion factors between units. The [QuantityFormatter]($frontend) has a default units provider [BasicUnitsProvider]($frontend) that only defines units needed by the set of QuantityTypes the formatter supports. Most iModels contain a `Units` schema. If this is the case, a SchemaUnitProvider may be defined when an IModel is opened. The parent application must opt-in to using an iModel specific UnitsProvider using the following technique:

```ts
    const schemaLocater = new ECSchemaRpcLocater(iModelConnection);
    await IModelApp.quantityFormatter.setUnitsProvider(new SchemaUnitProvider(schemaLocater));
```

If errors occur while configuring the units provider, they are caught within the [QuantityFormatter.setUnitsProvider]($frontend) method, and the code reverts back to the [BasicUnitsProvider] described above.

### Measure Tools

Below are a list of a few of the delivered Measure Tools and the QuantityTypes they use.

#### MeasureDistanceTool

- Length - QuantityType.Length
- Coordinates - QuantityType.Coordinate

#### MeasureLocationTool

- Coordinates - QuantityType.Coordinate
- Spatial Coordinates - QuantityType.LatLong
- Height - QuantityType.Coordinate

#### MeasureAreaByPointsTool

- Perimeter - QuantityType.Length
- Coordinates - QuantityType.Coordinate
- Area - QuantityType.Area

#### MeasureElementTool

- Accumulated Length - QuantityType.Length
- Accumulated Area - QuantityType.Area
- Volume - QuantityType.Volume
- Centroid - QuantityType.Coordinate

#### Formatting Example

Below is example converting totalDistance, in persistence units of meters, to the format specified for `QuantityType.Length` in the current unit system. The
formatterSpec contains all the unit conversions necessary to convert the persistence unit to the units specified in the FormatProps.

```ts
    const formatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
    if (undefined === formatterSpec)
      return;
    const formattedTotalDistance = IModelApp.quantityFormatter.formatQuantity(totalDistance, formatterSpec);
```

If the unit system is `"imperial"` then the following format (FormatProps) would typically be applied. This format specifies to create a string in the format of `X'-X"`, where inches would be shown to the nearest 1/8 inch.

```json
    format: {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [{ label: "'", name: "Units.FT" }, { label: "\"", name: "Units.IN" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    },
```

If the unit system is `"metric"` then the following format (FormatProps) would typically be applied. This format specifies to create a string in the format of `Xm`, where meters would be shown to nearest .0001 precision.

```json
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "m", name: "Units.M" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },

```

#### Parsing Example

Below is an example of parsing the string `24^34.5'` into an angle in the persistence unit of radian. The parserSpec that is generated
contains all the unit conversions necessary to convert from any angular unit to radians.

```ts
    inString = `24^34.5'`;
    const parserSpec = IModelApp.quantityFormatter.findParserSpecByQuantityType(QuantityType.Angle);
    if (parserSpec)
      return parserSpec.parseToQuantityValue(inString);
```

The persistence unit is predefined by the QuantityType definition in the QuantityFormatter. For `QuantityType.Angle` the following is used.

```ts
    // QuantityType.Angle
    const radUnit = await this.findUnitByName("Units.RAD");
    const angleDefinition = new StandardQuantityTypeDefinition(QuantityType.Angle, radUnit,
      "iModelJs:QuantityType.Angle.label", "iModelJs:QuantityType.Angle.description");
    this._quantityTypeRegistry.set(angleDefinition.key, angleDefinition);
```

The default angle format (FormatProps) is used during parsing to supply the default set of labels to look for in the string. Any alternate unit labels, as provided by [AlternateUnitLabelsProvider]($quantity), will also be checked during the parsing operation. The alternate unit label of "^" is commonly set up for QuantityType.Angle making it easier to build the angle string with standard keyboard keys. The default format for QuantityType.Angle when the unit system is set to "imperial" is shown below.

```json
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "°", name: "Units.ARC_DEG" }, { label: "'", name: "Units.ARC_MINUTE" }, { label: "\"", name: "Units.ARC_SECOND" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      uomSeparator: "",
    },

```

## SchemaUnitProvider

It is possible to retrieve `Units` from schemas stored in IModels. The new [SchemaUnitProvider]($ecschema-metadata) can now be created and used by the [QuantityFormatter]($core-frontend) or any method in the `core-quantity` package that requires a [UnitsProvider]($quantity). Below is an example, extracted from `ui-test-app`, that demonstrates how to register the IModel-specific `UnitsProvider` as the IModelConnection is created. This new provider will provide access to a wide variety of Units that were not available in the standalone `BasicUnitsProvider`.

```ts
    // Provide the QuantityFormatter with the iModelConnection so it can find the unit definitions defined in the iModel
    const schemaLocater = new ECSchemaRpcLocater(iModelConnection);
    await IModelApp.quantityFormatter.setUnitsProvider (new SchemaUnitProvider(schemaLocater));
```

>IMPORTANT: the `core-quantity` package is not a peer dependency of the `ecschema-metadata` package

## Quantity Package

The Quantity Package `@itwinjs\core-quantity` defines interfaces and classes used to specify formatting and provide information needed to parse strings into quantity values. It should be noted that most of the classes and interfaces used in this package are based on the native C++ code that formats quantities on the back-end. The purpose of this frontend package was to produce the same formatted strings without requiring constant calls to the backend to do the work.

Common terms used across this page are explained at [Quantity Formatting and Parsing](../quantity/index.md).

### Formatting Examples

Below are a couple examples of formatting values using methods directly from the @itwinjs/core-quantity package. The UnitsProvider used in the examples below can be seen in [TestHelper](https://github.com/iTwin/itwinjs-core/blob/master/core/quantity/src/test/TestUtils/TestHelper.ts). As discussed above, there are UnitProviders that can read units defined in the active iModel, and there is a basic provider that can be used when no iModel is open.

#### Numeric Format

  The example below uses a simple numeric format and generates a formatted string with 4 decimal place precision. For numeric formats there is no conversion to other units; the unit passed in is the unit returned with the unit label appended if "showUnitLabel" trait is set.

```ts
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

#### Composite Format

For the composite format below, we provide a unit in meters and produce a formatted string showing feet and inches to a precision of 1/8th inch.

```ts
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

### Parsing Values

```ts
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

#### AlternateUnitLabelsProvider

The [AlternateUnitLabelsProvider]($quantity) interface allows users to specify a set of alternate labels which may be encountered during parsing of strings. By default only the input unit label and the labels of other units in the same Unit Family/Phenomenon, as well as the label of units in a Composite format are used.

### Mathematical Operation Parsing

The quantity formatter supports parsing mathematical operations. The operation is solved, formatting every values present, according to the specified format. This makes it possible to process several different units at once.
```Typescript
const unitsProvider = new BasicUnitsProvider(); // If @itwin/core-frontend is available, can use IModelApp.quantityFormatter.unitsProvider
const outUnit = await unitsProvider.findUnitByName("Units.FT");

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
  allowMathematicOperations: true,
};

const format = new Format("compositeFeetInches");
await format.fromJSON(unitsProvider, formatData);

// Operation containing many units (feet, inches, yards).
const inString = "5 ft + 12 in + 1 yd -1 ft 6 in + 1'6\""; // 1'6" translates to a value of 1.5 ft

const parserSpec = await ParserSpec.create(format, unitsProvider, outUnit);
const parseResult = parserSpec.parseToQuantityValue(inString);
// parseResult.value returns 9.0 (value in feet)
```

#### Limitations

There are corner cases and rules we've established surrounding use of math operations, explained further in [Limitations](../quantity/index.md#limitations).

#### Usage

The parsing of mathematical operations is disabled by default.
To enable it, you can override the default QuantityFormatter. Ex :

```Typescript
  // App specific
  const quantityType = QuantityType.LengthEngineering;

  // Default props for the desired quantityType
  const props = IModelApp.quantityFormatter.getFormatPropsByQuantityType(quantityType);

  // Override the formatter and enable mathematical operations.
  await IModelApp.quantityFormatter.setOverrideFormat(quantityType, { ...props, allowMathematicOperations: true });
```
