# Formats

A [Format]($quantity) defines how a quantity value is displayed to users. Formats control precision, unit labels, composite units (like feet-inches), and various display traits. Understanding format specifications is essential for creating consistent and user-friendly quantity displays.

## FormatProps

[FormatProps]($quantity) is the core interface that defines all format properties. Each property is documented with its constraints and valid values in the API reference. For additional context on format specifications, see the EC documentation on [Format](../../bis/ec/ec-format.md).

## Format Types

### Decimal Format

Displays values with a fixed number of decimal places.

```json
{
  "type": "Decimal",
  "precision": 4,
  "formatTraits": ["keepSingleZero", "showUnitLabel"],
  "decimalSeparator": "."
}
```

### Fractional Format

Displays values as fractions with specified denominator.

```json
{
  "type": "Fractional",
  "precision": 8,
  "formatTraits": ["keepSingleZero", "showUnitLabel"],
  "uomSeparator": ""
}
```

### Scientific Format

Displays values in scientific notation (e.g., 1.23E+04).

```json
{
  "type": "Scientific",
  "precision": 2,
  "scientificType": "Normalized"
}
```

### Station Format

Specialized format for civil engineering station values. See [Station Format Properties](#station-format-properties) below.

```json
{
  "type": "Station",
  "stationOffsetSize": 2,
  "stationBaseFactor": 1,
  "precision": 2,
  "formatTraits": ["trailZeroes", "keepDecimalPoint"]
}
```

This format divides values into stations using offset 100 (1 × 10²), displaying 2 decimal places (e.g., `1055.5` → `10+55.50`).

### Ratio Format

Displays values as ratios (e.g., 1:100, 12"=1'). See [Ratio Format Properties](#ratio-format-properties) below.

```json
{
  "type": "Ratio",
  "ratioType": "OneToN",
  "precision": 1,
  "formatTraits": ["trailZeroes"],
  "composite": {
    "units": [
      { "name": "Units.M" },
      { "name": "Units.M" }
    ]
  }
}
```

This format displays metric scale ratios with 1 decimal place (e.g., `0.01` → `1:100.0`).

## Composite Formats

Format definitions that utilize composite units allow quantity values to be displayed across multiple units. Typical examples:

- **Imperial length**: `5'-3 1/2"` (feet and inches)
- **Angles**: `45°30'15"` (degrees, minutes, seconds)
- **Surveying**: `1+055.50` (stations)

Composite format properties:

- **includeZero** - Whether to show zero values for sub-units
- **spacer** - String separator between sub-unit values
- **units** - Array of unit definitions with labels

### Example: Feet-Inches Format

```json
{
  "composite": {
    "includeZero": true,
    "spacer": "-",
    "units": [
      { "label": "'", "name": "Units.FT" },
      { "label": "\"", "name": "Units.IN" }
    ]
  },
  "formatTraits": ["keepSingleZero", "showUnitLabel"],
  "precision": 8,
  "type": "Fractional",
  "uomSeparator": ""
}
```

This format displays values as feet and inches with fractional inch precision:

- The `composite` section defines two units: feet (labeled with `'`) and inches (labeled with `"`)
- The `-` spacer appears between feet and inches
- `precision: 8` means fractional denominator of 8 (e.g., 1/8, 1/4, 3/8)
- Example: `5.5` feet displays as `5'-6"`

## Station Format Properties

Station formatting in iTwin.js supports properties that control how values are broken down into major and minor station components:



### stationOffsetSize

The `stationOffsetSize` property specifies the number of decimal places for calculating the station offset magnitude. This must be a positive integer greater than 0. This works with `stationBaseFactor` to determine the effective station offset using the formula: `effective offset = stationBaseFactor * 10^stationOffsetSize`.

### stationBaseFactor

The `stationBaseFactor` property provides additional flexibility for station formatting by acting as a multiplier for the base offset calculation. This allows for non-standard station intervals that aren't simple powers of 10. The default value is 1.

> **Note**: The `stationBaseFactor` property is currently implemented as an iTwin.js-specific extension and is not supported in the native EC (Entity Context) layer. This feature will eventually be incorporated into the ECFormat specification to provide broader compatibility across the iTwin ecosystem.

### Station Format Examples

| stationOffsetSize | stationBaseFactor | Value  | Effective Offset | Formatted |
| ----------------- | ----------------- | ------ | ---------------- | --------- |
| 2                 | 1                 | 1055.5 | 100              | 10+55.50  |
| 3                 | 1                 | 1055.5 | 1000             | 1+055.50  |
| 2                 | 5                 | 1055.5 | 500              | 2+55.50   |

In the examples above:

- With `stationOffsetSize=2` and `stationBaseFactor=1`: effective offset = 1 × 10² = 100
- With `stationOffsetSize=3` and `stationBaseFactor=1`: effective offset = 1 × 10³ = 1000
- With `stationOffsetSize=2` and `stationBaseFactor=5`: effective offset = 5 × 10² = 500

## Format Traits

Format traits are flags that control various display behaviors:

- **keepSingleZero** - Always show at least one trailing zero
- **showUnitLabel** - Display the unit label after the value
- **trailZeroes** - Show trailing zeros up to specified precision
- **use1000Separator** - Insert thousand separators (e.g., commas)
- **applyRounding** - Apply rounding rules to precision
- **fractionDash** - Use dash in fractions (e.g., 3-1/2 instead of 3 1/2)
- **keepDecimalPoint** - Always show decimal point even for whole numbers
- **zeroEmpty** - Display zero values as empty string

## Ratio Format Properties

Ratio formatting in iTwin.js enables the display of proportional relationships between quantities, commonly used for scale factors, slopes, and architectural drawings. A ratio format expresses values as relationships like "1:2", "12\"=1'", or "1:100". For usage examples demonstrating ratio formatting and parsing, see [Ratio Format Examples](../usage/ParsingAndFormatting.md#ratio-format-examples).

### ratioType

The `ratioType` property determines how the ratio is formatted. This is a required property for formats with `type: "Ratio"`. The available ratio types are:

- **OneToN** - Formats as `1:N` where N is calculated as the reciprocal of the magnitude. Best for representing scales where one unit maps to multiple units (e.g., `1:100` for a 1:100 scale drawing).

- **NToOne** - Formats as `N:1` where N is the magnitude value. Commonly used for architectural scales and when expressing the left side as a variable (e.g., `12":1'` meaning 12 inches on paper equals 1 foot in reality).

- **ValueBased** - Automatically chooses between OneToN and NToOne based on the magnitude. If magnitude > 1, uses NToOne format; otherwise uses OneToN format. This provides the most intuitive representation for different value ranges.

- **UseGreatestCommonDivisor** - Reduces both the numerator and denominator by their greatest common divisor to create simplified ratios (e.g., `2:4` becomes `1:2`). The precision setting determines the scale factor used before reduction.

### ratioSeparator

The `ratioSeparator` property specifies the character used to separate the numerator and denominator in the formatted ratio. This is an optional property that defaults to `":"` if not specified. Common separator values include:

- `":"` - Standard ratio notation (e.g., `1:2`, `1:100`)
- `"="` - Equation-style notation, common in architectural scales (e.g., `12"=1'`, `1"=20'`)
- `"/"` - Fraction-style notation (e.g., `1/2`, `3/4`)

The separator must be a single character string.

### ratioFormatType

The `ratioFormatType` property controls how the numeric values within the ratio are formatted. This optional property defaults to `"Decimal"` if not specified:

- **"Decimal"** - Formats ratio components as decimal numbers with the specified precision (e.g., `0.5:1`, `1:2.5`)
- **"Fractional"** - Formats ratio components as fractions when appropriate (e.g., `1/2:1`, `3/4:1`). The precision property determines the fractional denominator (e.g., precision of 16 means denominators up to 1/16).

When using "Fractional" ratio format type, leading zeros are automatically suppressed for purely fractional values (e.g., `3/4` instead of `0 3/4`).

### Two-Unit Composite Ratio Formats

When a ratio format includes exactly **two units** in its `composite.units` array, the system  will calculate the scale factor between the two units. This pattern is commonly used for architectural and engineering scales where the numerator and denominator represent different units (e.g., inches per foot in imperial scales).

**How it works:**

1. **Detection**: The system detects that `composite.units` contains exactly 2 units in a format with `type: "Ratio"`
2. **Validation**: Both units must have the **same phenomenon** (unit family). For example, both must be length units. The system will throw a `QuantityError` if you attempt to mix different phenomena (e.g., LENGTH and TIME units)
3. **Automatic conversion**: The system automatically computes the scale factor conversion from the denominator unit (second unit) to the numerator unit (first unit)
4. **Display**: When the `showUnitLabel` format trait is set, unit labels for both the numerator and denominator are displayed in the formatted output

**When to use this pattern:**

- **Imperial architectural scales** where you need different units for numerator and denominator (e.g., `12"=1'` meaning 12 inches on paper equals 1 foot in reality)
- **Scale factor display** where the persistence unit is a ratio (e.g., `IN_PER_FT_LENGTH_RATIO`) but you want explicit unit labels in the output
- **Metric scales with unit labels** (e.g., `1m:100m`) though typically metric scales omit labels and show as `1:100`

**Example format definition:**

```ts
[[include:Quantity_Formatting.Imperial_Scale_FormatProps]]
```

With a persistence unit of `IN_PER_FT_LENGTH_RATIO` and magnitude `1.0`, this would format as `1"=1'` (1 inch equals 1 foot, representing a 1:12 scale).

For the same format with persistence unit `M_PER_M_LENGTH_RATIO` (dimensionless meter per meter ratio) and magnitude `0.0208` (or `1/48`), this would also format as `1/4"=1'` (quarter inch equals 1 foot, representing a 1:48 scale).

**Scale factor conversion details:**

The system automatically handles the conversion between the denominator and numerator units:

- For imperial scales (e.g., `IN` to `FT`): The conversion factor of 12 (inches per foot) is automatically applied
- For metric scales (e.g., `M` to `M`): The conversion factor is 1 (same unit)
- The magnitude from the persistence unit is divided by this conversion factor to produce the displayed ratio

**Difference from single-unit composite formats:**

Ratio formats can also use a single unit in the `composite.units` array (particularly for metric scales). When only one unit is specified, no special scale factor conversion is applied—the ratio is formatted directly from the magnitude value. This is typically used when the persistence unit matches the display unit (e.g., `M_PER_M_LENGTH_RATIO` formatted as `1:100`).

### Ratio Formats with Composite Units

For simpler ratio formats (particularly metric scales), you can use a single unit in the `composite` property. This approach is typically used when the persistence unit matches the display unit (e.g., `M_PER_M_LENGTH_RATIO` formatted as `1:100`). The ratio formatting logic will automatically handle the conversion without requiring explicit `ratioUnits`.

When using composite units for ratio formats, unit labels are displayed when the `showUnitLabel` format trait is set.

### Ratio Format Examples

| ratioType | ratioFormatType | precision | magnitude | separator | composite.units | Formatted Result |
| --------- | --------------- | --------- | --------- | --------- | --------------- | ---------------- |
| NToOne | Decimal | 2 | 1.0 | ":" | - | 1:1 |
| NToOne | Decimal | 2 | 0.5 | ":" | - | 0.5:1 |
| OneToN | Decimal | 0 | 0.01 | ":" | - | 1:100 |
| ValueBased | Decimal | 3 | 2.0 | ":" | - | 2:1 |
| ValueBased | Decimal | 3 | 0.5 | ":" | - | 1:2 |
| UseGreatestCommonDivisor | Decimal | 3 | 0.5 | ":" | - | 1:2 |
| NToOne | Decimal | 2 | 12.0 | "=" | [IN, FT] * | 12"=1' |
| NToOne | Decimal | 2 | 1.0 | "=" | [IN, FT] * | 1"=1' |
| NToOne | Fractional | 16 | 1.5 | "=" | [IN, FT] * | 1 1/2"=1' |
| NToOne | Fractional | 16 | 0.75 | "=" | [IN, FT] * | 3/4"=1' |

\* *Assumes `composite: { units: [IN(label="\""), FT(label="'")] }`, persistence unit `IN_PER_FT_LENGTH_RATIO`, and `showUnitLabel` trait is set*

### Parsing Ratio Strings

The parser supports parsing ratio strings with various formats and handles several special cases:

**Supported Input Formats:**

- **Standard ratios**: `"1:100"`, `"12"=1'"`, `"2/3"` (using the configured separator)
- **Fractional numerators**: `"3/4"=1'"`, `"1 1/2:1"` (fractions are automatically parsed)
- **Mixed fractions**: `"1 1/2"=1'"` (whole number with fraction)
- **Negative values**: `"-1:2"`, `"-0.5:1"` (negative sign at the start)
- **Unit labels in input**: `"12\"=1'"`, `"1m:100m"` (unit labels are extracted but not used for conversion)

**Special Cases and Error Handling:**

1. **Missing separator** - If the input string doesn't contain the expected ratio separator (e.g., `:`, `=`, or `/`), the parser treats it as a single numerator value with an implied denominator of 1:
   - Input: `"100"` with separator `":"` → Parsed as `100:1`

2. **Wrong separator** - If the input contains a different ratio separator than expected, the parser returns an error:
   - Input: `"12:1"` when format expects `"="` → Returns `ParseError.UnableToConvertParseTokensToQuantity`
   - This prevents ambiguity when `/` is used as both a fraction indicator and a ratio separator

3. **Unit labels** - Unit labels in the input string are extracted but ignored during conversion. The parser uses the format's defined unit for conversion:
   - Input: `"12in=1ft"` with format unit `IN_PER_FT_LENGTH_RATIO` → The `"in"` and `"ft"` labels are discarded; conversion uses the format's unit definition

4. **Division by zero** - When the denominator is 0, the parser handles it based on the unit conversion type:
   - With inverted unit and numerator of 1: Returns value of `0.0`
   - Otherwise: Returns `ParseError.MathematicOperationFoundButIsNotAllowed`

5. **Fractional parsing** - Fractions in the numerator or denominator are automatically handled by the tokenizer:
   - Input: `"3/4"=1'` → Numerator parsed as `0.75`
   - Input: `"1 1/2"=1'` → Numerator parsed as `1.5` (mixed fraction)

**Parsing Process:**

1. Split input string by the ratio separator
2. Parse each part (numerator and denominator) to extract numeric values
3. Handle fractions using the built-in fraction parsing logic
4. Extract unit labels if present (but don't apply conversions based on them)
5. Calculate ratio: `numerator / denominator`
6. Apply unit conversion using the format's defined ratio unit
7. Return the final value in the persistence unit


## Code Examples

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

## See Also

- [Units](./Units.md) - Understanding unit definitions referenced in formats
- [Format Sets](./FormatSets.md) - Persisting formats at application level
- [Providers](../usage/Providers.md) - Accessing and managing format definitions
- [Parsing and Formatting](../usage/ParsingAndFormatting.md) - Applying formats to quantity values
