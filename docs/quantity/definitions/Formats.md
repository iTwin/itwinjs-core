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

## Code Examples

### Numeric Format Example

This example uses a simple numeric format with 4 decimal place precision:

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.Numeric]]
```

</details>

### Composite Format Example

This example formats a metric value (meters) as feet-inches with fractional precision:

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_Formatting.Composite]]
```

</details>

## See Also

- [Units](./Units.md) - Understanding unit definitions referenced in formats
- [Format Sets](./FormatSets.md) - Persisting formats at application level
- [Providers](../usage/Providers.md) - Accessing and managing format definitions
- [Parsing and Formatting](../usage/ParsingAndFormatting.md) - Applying formats to quantity values
