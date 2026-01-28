# Parsing and Formatting

This page explains how developers can use [FormatterSpec]($quantity) and [ParserSpec]($quantity) to format quantity values and parse user input strings. It also covers integration with iTwin tools and components.

## FormatterSpec and ParserSpec

### FormatterSpec

[FormatterSpec]($quantity) is the runtime object used to format numeric quantity values into display strings. It contains:

- The [Format]($quantity) specification defining display rules
- Cached [UnitConversionSpec]($quantity) objects for all display units
- The persistence unit (source unit for the value)

**Creating a FormatterSpec:**

```ts
const formatterSpec = await FormatterSpec.create(
  "myFormat",           // Name for caching (optional)
  format,               // Format object with display rules
  unitsProvider,        // Provider for unit definitions
  persistenceUnit       // Unit the value is stored in
);
```

**Using a FormatterSpec:**

```ts
const magnitude = 1.5;  // Value in persistence unit (e.g., meters)
const formattedString = formatterSpec.applyFormatting(magnitude);
// Result: "4'-11 1/16"" (if format is feet-inches)
```

### ParserSpec

[ParserSpec]($quantity) is the runtime object used to parse formatted strings back into numeric values. It contains:

- The [Format]($quantity) specification for recognizing unit labels
- Cached [UnitConversionSpec]($quantity) objects for all units in the phenomenon
- The persistence unit (target unit for parsed values)

**Creating a ParserSpec:**

```ts
const parserSpec = await ParserSpec.create(
  format,                    // Format with expected unit labels
  unitsProvider,             // Provider for unit definitions and conversions
  persistenceUnit,           // Target unit for parsed value
  alternateLabelsProvider    // Optional: alternate unit labels
);
```

**Using a ParserSpec:**

```ts
const inputString = "4'-11 1/16\"";
const parseResult = parserSpec.parseToQuantityValue(inputString);

if (parseResult.ok) {
  const value = parseResult.value;  // Value in persistence unit (meters)
} else {
  // Handle parsing error
  console.error(parseResult.error);
}
```

## Simple Code Examples

### Numeric Formatting Example

This example uses a simple numeric format with 4 decimal place precision:

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.Numeric]]
```

</details>

### Composite Formatting Example

This example formats a metric value (meters) as feet-inches with fractional precision:

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.Composite]]
```

</details>

## Parser Behavior

The [Parser]($quantity) converts text strings into numeric quantity values by tokenizing the input and matching unit labels to known units. Understanding parser behavior helps you handle edge cases and errors correctly.

### Parsing Process

1. **Tokenization**: The input string is broken down into tokens representing numbers, unit labels, and mathematical operators (if enabled).

2. **Unit Label Matching**: For each unit label token found, the parser attempts to match it against:
   - Units explicitly defined in the format specification
   - Units from the same phenomenon (unit family) provided by the [UnitsProvider]($quantity)
   - Alternate labels defined through the [AlternateUnitLabelsProvider]($quantity)

3. **Error Handling**: The parser's behavior when encountering unrecognized unit labels depends on the format configuration:
   - **Unitless Format** (no units defined in format definition): If a unit label is provided but cannot be matched to any known unit, the parser returns `ParseError.UnitLabelSuppliedButNotMatched`. This prevents silent failures where typos like "12 im" (instead of "12 in") would incorrectly parse as "12 meters" when the persistence unit is meters.
   - **Format with Units** (units explicitly defined): If an unrecognized unit label is provided (e.g., "12 ABCDEF"), the parser falls back to the format's default unit for backward compatibility. For example, with a feet format, "12 ABCDEF" would parse as "12 feet".

4. **Default Unit Behavior**: If no unit label is provided in the input (e.g., just "12"), the parser uses the default unit specified in the format. For unitless formats, if the input contains multiple unit labels, the first successfully matched unit becomes the default for subsequent unitless values in the same expression.

5. **Unit Conversion**: Once units are matched, the parser applies the appropriate unit conversions to produce a value in the persistence unit specified by the `ParserSpec`.

This error handling ensures that parsing errors are caught in unitless format contexts, preventing data corruption from unrecognized or mistyped unit labels, while maintaining backward compatibility for formats with explicitly defined units.

### Example: Parsing Values

<details>
<summary>Basic parsing example</summary>

```ts
[[include:Quantity_Formatting.Simple_Parsing]]
```

</details>

## Mathematical Operations

The quantity formatter supports parsing mathematical operations, allowing users to enter expressions like "5 ft + 12 in - 6 in". The parser evaluates the expression and formats each value according to the specified format.

### Enabling Mathematical Operations

Mathematical operations are disabled by default. To enable them, set the `allowMathematicOperations` property in your format:

<details>
<summary>Enabling mathematical operations</summary>

```ts
[[include:Quantity_Formatting.Math_Operations_Enablement]]
```

</details>

### Example: Parsing Mathematical Expressions

<details>
<summary>Parsing mathematical operations</summary>

```ts
[[include:Quantity_Formatting.Basic_Math_Operations_Parsing]]
```

</details>

### Limitations

Only plus (`+`) and minus (`-`) operators are currently supported. Other operators will return a parsing error or invalid input result.

#### Whitespace Handling

If a format uses a spacer that conflicts with the operators above, additional restrictions apply:

1. Mathematical operations only apply when the operator is in front of whitespace. For example:
   - `-2FT 6IN + 6IN` is equal to `-2FT-6IN + 6IN`
   - `-2FT-6IN - 6IN` is NOT equal to `-2FT-6IN- 6IN`

<details>
<summary>Whitespace limitation example</summary>

```ts
[[include:Quantity_Formatting.Math_Whitespace_Limitation]]
```

</details>

#### Composite Unit Handling

1. For a value like `2FT 6IN-0.5`, the `-` sign will be treated as a spacer and not subtraction. However, the `0.5` value will use the default unit conversion provided to the parser, because it's not a part of the composite unit when that composite is made up of only 2 units - `FT` and `IN`.

<details>
<summary>Composite unit limitation example</summary>

```ts
[[include:Quantity_Formatting.Math_Composite_Limitation]]
```

</details>

## Usage in iTwin Tools and Components

This section explains how iTwin tools and components integrate FormatterSpec and ParserSpec for consistent quantity formatting and parsing.

### QuantityFormatter Integration

The [QuantityFormatter]($frontend) class in `@itwin/core-frontend` provides a convenient interface for formatting and parsing quantities. It manages:

- Default formats for each [QuantityType]($frontend), but there's an effort to move away from using `QuantityType`. See [Migrating from QuantityType to KindOfQuantity](#migrating-from-quantitytype-to-kindofquantity)
- Format overrides through [UnitFormattingSettingsProvider]($frontend)
- Unit system management (metric, imperial, usCustomary, usSurvey)
- [UnitsProvider]($quantity) registration

The QuantityFormatter is automatically initialized when [IModelApp]($frontend) starts, creating cached FormatterSpec and ParserSpec objects for each QuantityType.

### Measure Tools Examples

iTwin.js includes several measure tools that use QuantityFormatter to display formatted values and parse user input. Below are two representative examples showing the general pattern.

#### Example 1: MeasureDistanceTool - Formatting

The MeasureDistanceTool formats distance values for display:

<details>
<summary>MeasureDistanceTool formatting example</summary>

```ts
[[include:Quantity_Formatting.MeasureDistanceTool_Formatting]]
```

</details>

**Typical format behavior:**

- **Imperial**: Displays as `X'-X"` with inches to nearest 1/8"

  ```json
  {
    "composite": {
      "units": [{ "label": "'", "name": "Units.FT" }, { "label": "\"", "name": "Units.IN" }]
    },
    "precision": 8,
    "type": "Fractional"
  }
  ```

- **Metric**: Displays as `Xm` with 4 decimal places

  ```json
  {
    "composite": {
      "units": [{ "label": "m", "name": "Units.M" }]
    },
    "precision": 4,
    "type": "Decimal"
  }
  ```

#### Example 2: MeasureLocationTool - Parsing

The MeasureLocationTool parses user-entered angle strings:

<details>
<summary>MeasureLocationTool parsing example</summary>

```ts
[[include:Quantity_Formatting.MeasureLocationTool_Parsing]]
```

</details>

**Typical parsing behavior:**

The parser accepts various angle formats:

- `24^34.5'` - Using alternate label "^" for degrees
- `24°34.5'` - Using standard degree symbol
- `45.5°` - Decimal degrees
- `45°30'15"` - Degrees, minutes, seconds

The ParserSpec for angles includes conversions from all angular units (degrees, minutes, seconds, gradians) to the persistence unit (radians).

### General Pattern for Tools and Components

When developing tools or components that format/parse quantities:

1. **Identify the KindOfQuantity**: Determine which KindOfQuantity your tool should use (e.g., `DefaultToolsUnits.LENGTH`, `CivilUnits.STATION`)

2. **Get FormatProps**: Retrieve the format from the active FormatsProvider. If not found, provide a fallback format definition.

   ```ts
   [[include:Quantity_Formatting.General_Pattern_Get_FormatProps]]
   ```

3. **Convert to Format and Get Persistence Unit**: Create a Format object from FormatProps and retrieve the persistence unit. Access the UnitsProvider from IModelApp.

   ```ts
   [[include:Quantity_Formatting.General_Pattern_Convert_To_Format]]
   ```

4. **Create Specs**: Create FormatterSpec and ParserSpec as needed

   ```ts
   [[include:Quantity_Formatting.General_Pattern_Create_Specs]]
   ```

5. **Format/Parse**: Use the specs throughout your tool's lifecycle

   ```ts
   [[include:Quantity_Formatting.General_Pattern_Format_Parse]]
   ```

### Migrating from QuantityType to KindOfQuantity

Starting in iTwin.js 5.0, we encourage developers to move away from using `QuantityType` and instead use `KindOfQuantity` [EC full names](https://www.itwinjs.org/bis/ec/ec-name/#full-name).

#### Why Migrate?

- **Broader range of formatting capabilities**: Not limited to nine built-in types
- **Dynamic format definition**: Work with formats defined in custom schemas
- **Scalability**: Use MutableFormatsProvider to add or override formats
- **Schema integration**: Better alignment with BIS schemas and domain models

#### QuantityType Replacement Table

| QuantityType  | Actual KindOfQuantity (EC Full Name) |
| ------------- | ------------- |
| Length  |  DefaultToolsUnits.LENGTH |
| Angle  | DefaultToolsUnits.ANGLE  |
| Area  |  DefaultToolsUnits.AREA |
| Volume  | DefaultToolsUnits.VOLUME  |
| LatLong | DefaultToolsUnits.ANGLE |
| Coordinate | DefaultToolsUnits.LENGTH_COORDINATE |
| Stationing | CivilUnits.STATION |
| LengthSurvey | CivilUnits.LENGTH |
| LengthEngineering | AecUnits.LENGTH |

**Schema Layers:**

- [DefaultToolsUnits](../../bis/domains/DefaultToolsUnits.ecschema.md) - Common layer schema present in many iModels
- [CivilUnits](../../bis/domains/CivilUnits.ecschema.md) - Discipline-Physical layer for civil infrastructure
- [AecUnits](../../bis/domains/AecUnits.ecschema.md) - Common layer for AEC applications

More information on schemas and their different layers can be found in [BIS Organization](../../bis/guide/intro/bis-organization.md).

#### Handling Missing Schemas

iModels might not include CivilUnits, DefaultToolsUnits, or AecUnits schemas. In such cases:

1. Integrate your tools/components to use a `FormatsProvider`
2. Add the missing KindOfQuantity and associated [FormatProps]($quantity) through that FormatsProvider
3. This works independently from schemas in iModels

#### Default Support

To support migration, `IModelApp` uses an internal [QuantityTypeFormatsProvider]($frontend) by default, which provides formatProps for each KindOfQuantity in the table above. We still strongly encourage developers to either implement their own `FormatsProvider` or use [SchemaFormatsProvider]($ecschema-metadata) if possible.

> **Note**: We plan to deprecate `QuantityType` during the iTwin.js 5.x lifecycle.

## Ratio Formatting and Parsing

Ratio formats enable the display of proportional relationships between quantities, commonly used for scale factors, slopes, and architectural drawings. For detailed information about ratio format properties and configuration, see [Ratio Format Properties](../definitions/Formats.md#ratio-format-properties).

### Metric Scale Ratio Formatting

The example below demonstrates formatting metric scale ratios commonly used in architectural and engineering drawings. The format uses `OneToN` ratio type to display scales like "1:100" or "1:50".

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.Metric_Scale]]
```

</details>

### Imperial Scale Ratio Formatting

The example below demonstrates formatting imperial architectural scales with fractional notation. The format uses `NToOne` ratio type with fractional formatting to display scales like "1/4"=1'" (quarter-inch scale) or "3/4"=1'" (three-quarter-inch scale).

<details>
<summary>Example Code</summary>

```ts

[[include:Quantity_Formatting.Imperial_Scale_FormatProps]]

[[include:Quantity_Formatting.Imperial_Scale]]
```

</details>

### Metric Scale Ratio Parsing

The example below demonstrates parsing metric scale ratios. The parser can handle standard ratio notation like "1:100" or "1:50" and convert them to decimal length ratio values.

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.Metric_Scale_Parsing]]
```

</details>

### Imperial Scale Ratio Parsing

The example below demonstrates parsing imperial architectural scales with fractional notation. The parser can handle fractional values like "1/4"=1'", mixed fractions like "1 1/2"=1'", and decimal values, converting them to decimal length ratio values.

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.Imperial_Scale_Parsing]]
```

</details>

## See Also

- [Formats](../definitions/Formats.md) - Format specification reference
- [Ratio Format Properties](../definitions/Formats.md#ratio-format-properties) - Detailed ratio format configuration
- [Providers](./Providers.md) - Setting up UnitsProvider and FormatsProvider
- [Unit Conversion](./UnitConversion.md) - How unit conversions work
