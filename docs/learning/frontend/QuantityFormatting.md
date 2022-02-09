# Quantity Formatting

There are two ways to format quantity values in an IModelApp. The most primitive way is to use the [Formatter]($quantity) in `core-quantity` package. The second and in some cases the more convenient way is to use the [QuantityFormatter]($frontend) in the `core-frontend` package. The `QuantityFormatter` is limited to formatting and parsing values for a fixed set of quantity types.

## QuantityFormatter

The [QuantityFormatter]($frontend) is a class that formats and parses quantity values. This class is used on the front-end to format quantities for interactive tools, such as the different measure tools. It is also used to parse strings back into quantity values. The Quantity Formatter is not used to format properties stored in the iModel, as that is work is done on the back-end via the Presentation layer. The QuantityFormatter can be set to format values in the same unit system as that being used by the back-end. There are four Unit Systems definitions that is shared between the back-end Presentation Manager and the front-end Quantity Formatter and there are:

- "metric"
- "imperial"
- "usCustomary"
- "usSurvey"

### QuantityType

There are nine built-in quantity types, see [QuantityType]($frontend). The QuantityFormatter defines default formatting specification for each of these types per unit system. Custom quantity types that implement the [CustomQuantityTypeDefinition]($frontend) interface may also be registered with the QuantityFormatter, see method `registerQuantityType`. See example implementation of a custom type [here](https://github.com/iTwin/itwinjs-core/blob/5905cb1a48c4d790b5389d7f0ea141bc3ce95f23/test-apps/ui-test-app/src/frontend/api/BearingQuantityType.ts).

#### Overriding Default Formats

The `QuantityFormat` provides the method `setOverrideFormats` to allow the default format to be overridden. A class that implements the [UnitFormattingSettingsProvider]($frontend) interface can be set with the QuantityFormatter to persist these format overrides. This provider can then monitor the current session to load the overrides when necessary. The class [LocalUnitFormatProvider]($frontend) can be set using the following to register to store settings to local storage and to maintain overrides by iModel.

```ts
    await IModelApp.quantityFormatter.setUnitFormattingSettingsProvider(new LocalUnitFormatProvider(IModelApp.quantityFormatter, true));
```

This allows both the Presentation Unit System and the format overrides, set by the user, to stay in sync as the user opens different iModels.

### AlternateUnitLabelsProvider

The [QuantityFormatter]($frontend) provides a default set of alternate unit labels which are used when parsing strings to quantities. The
interface [AlternateUnitLabelsProvider]($quantity) defines how alternate units are defined. One commonly specified alternate label is "^" used to
specify degrees, which is much easier to type then trying to figure out how to enter a "°",  which is the default label for degree.

To add custom labels use [QuantityFormatter.addAlternateLabels]($frontend) as shown in the examples below.

  ```ts
  IModelApp.quantityFormatter.addAlternateLabels("Units.ARC_DEG", "^");
  IModelApp.quantityFormatter.addAlternateLabels("Units.FT", "feet", "foot");
  ```

### Units Provider

A units provider is used to define all available units and provides conversion factors between different units. The [QuantityFormatter]($frontend) has a default units provider [BasicUnitsProvider]($frontend) that only defines units needed by the set of QuantityTypes the formatter supports. Most IModels contain a `Units` schema. If this is the case, an SchemaUnitsProvider may be defined when an IModel is opened. The parent application must opt-in to using an IModel specific UnitsProvider using the following technique.

```ts
    // Reset QuantityFormatter UnitsProvider with new iModelConnection
    try{
      const schemaLocater = new ECSchemaRpcLocater(iModelConnection);
      const context = new SchemaContext();
      context.addLocater(schemaLocater);
      IModelApp.quantityFormatter.unitsProvider = new SchemaUnitProvider(context);
      await IModelApp.quantityFormatter.onInitialized();
    } catch (_) {
      // in case IModel does not have a Units schema reset to use BasicUnitsProvider
      IModelApp.quantityFormatter.resetToUseInternalUnitsProvider();
      await IModelApp.quantityFormatter.onInitialized();
    }

    // ready to store the IModelConnection in the IModelApps redux store
    UiFramework.setIModelConnection(iModelConnection, true);
```

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

## Quantity Package

The Quantity Package `@itwinjs\core-quantity` defines interfaces and classes used to specify formatting and a provide info to parse strings into quantity values. It should be noted that most of the classes and interfaces used in this package are based on the native C++ code that formats quantities on the back-end. The purpose of this frontend package was to produce the same formatted strings without requiring constant calls to the backend to do the work.

Common Terms:

- Unit/UnitProps - A named unit of measure which can be located by its name or label.
- UnitsProvider - A class that will provide UnitProps given its name or label. It will also provide [UnitConversion]($quantity) to convert from one unit to another.
- Phenomenon - The physical quantity that this unit measures (e.g., length, temperature, pressure).  Only units in the same phenomenon can be converted between.
- Persistence Unit - The unit used to store the quantity value in memory or to persist the value in an editable IModel.
- Format/FormatProp - The display format for the quantity value. For example, an angle may be persisted in radians but formatted and shown to user in degrees.
  - CompositeValue - An addition to the format specification that allows the explicit specification of a unit label, it also allows the persisted value to be displayed as up to 4 sub-units. Typical multi-unit composites are used to display `feet'-inches"` and `degree°minutes'seconds"`.
- FormatterSpec - Holds the format specification as well as the [UnitConversion]($quantity) between the persistence unit and all units defined in the format. This is done to avoid any async calls by the UnitsProvider during the formatting process.
- ParserSpec - Holds the format specification as well as the [UnitConversion]($quantity) between the persistence unit and all other units in the same phenomenon. This is done to avoid async calls by the UnitsProvider and also done to allow a user to enter 43" even when in "metric" unit system and have the string properly converted to meters.


