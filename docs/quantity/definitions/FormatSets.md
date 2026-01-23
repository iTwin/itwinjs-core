- [Format Sets](#format-sets)
  - [Overview](#overview)
  - [FormatSet Properties](#formatset-properties)
    - [unitSystem](#unitsystem)
    - [formats](#formats)
  - [FormatSet Examples](#formatset-examples)
    - [Metric FormatSet](#metric-formatset)
    - [Imperial FormatSet](#imperial-formatset)
  - [Using KindOfQuantities with FormatSets](#using-kindofquantities-with-formatsets)
    - [Common KindOfQuantity Mappings](#common-kindofquantity-mappings)
  - [FormatSet Storage and Loading](#formatset-storage-and-loading)
  - [See Also](#see-also)

# Format Sets

A [FormatSet]($ecschema-metadata) provides a mechanism for persisting format definitions at the application level. Unlike [KindOfQuantity](../../bis/ec/kindofquantity.md) which defines formats at the schema level, FormatSets allow applications to override or supplement schema-defined formats based on user preferences or application requirements.

## Overview

A FormatSet is a named collection of format definitions associated with a specific unit system. Each format in the set is mapped to a KindOfQuantity name, allowing the application to override the default presentation formats defined in EC schemas.

> During an application's runtime, the Format associated with a KindOfQuantity within a FormatSet takes precedence and is used over the default presentation formats of that KindOfQuantity.

## FormatSet Properties

### name

The `name` property is a unique identifier for the FormatSet. This value must be unique across all FormatSets in your application.

Common naming strategies include:
- **Descriptive names**: `"metric"`, `"imperial"`, `"usCustomary"`
- **GUIDs**: For applications that need guaranteed uniqueness or manage many user-specific FormatSets, GUIDs can be used (e.g., `"550e8400-e29b-41d4-a716-446655440000"`)

### label

The `label` property is a user-facing display name for the FormatSet. This value is typically shown in UI elements like dropdown menus or settings panels. Unlike `name`, the label does not need to be unique and can be localized for different languages.

Example: A FormatSet with `name: "metric"` might have `label: "Metric"` in English or `label: "Métrique"` in French.

### unitSystem

The `unitSystem` property uses a [UnitSystemKey]($quantity) to specify the unit system for the format set. Supported values:

- `"metric"` - International System of Units
- `"imperial"` - Imperial units (UK system)
- `"usCustomary"` - US Customary units
- `"usSurvey"` - US Survey units (survey feet)

Using explicit unit system keys provides:

- Better type safety
- Less dependency on `activeUnitSystem` in `IModelApp.quantityFormatter`
- Cleaner event handling when a [FormatSetFormatsProvider](../usage/Providers.md#formatsetformatsprovider) is registered. Tools can listen to just `IModelApp.formatsProvider.onFormatsChanged` event instead of `IModelApp.quantityFormatter.onActiveUnitSystemChanged`

### formats

The `formats` property maps KindOfQuantity names to format specifications. It accepts either:

1. **[FormatDefinition]($quantity)** - A complete format specification
2. **String reference** - A reference to another KindOfQuantity's format

String references allow format reuse, reducing duplication when multiple KindOfQuantities should share the same format specification.

Example: `"AecUnits.LENGTH": "CivilUnits.LENGTH"` makes `AecUnits.LENGTH` use the same format as `CivilUnits.LENGTH`.

> The naming convention for a valid format within a FormatSet follows the [EC Full Name](../../bis/ec/ec-name.md#full-name) format: `{schemaName}.{kindOfQuantityName}` (e.g., `DefaultToolsUnits.LENGTH`).

## FormatSet Examples

### Metric FormatSet

<details>
<summary>Example of a metric-based FormatSet as JSON</summary>

```json
{
  "name": "metric",
  "label": "Metric",
  "unitSystem": "metric",
  "formats": {
    "DefaultToolsUnits.LENGTH": {
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
    "DefaultToolsUnits.ANGLE": {
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

### Imperial FormatSet

<details>
<summary>Example of an imperial-based FormatSet as JSON</summary>

```json
{
  "name": "imperial",
  "label": "Imperial",
  "unitSystem": "imperial",
  "formats": {
    "DefaultToolsUnits.LENGTH": {
      "composite": {
        "includeZero": true,
        "spacer": "",
        "units": [
          { "label": "'", "name": "Units.FT" },
          { "label": "\"", "name": "Units.IN" }
        ]
      },
      "formatTraits": ["keepSingleZero", "showUnitLabel"],
      "precision": 4,
      "type": "Decimal"
    },
    "DefaultToolsUnits.ANGLE": {
      "description": "degrees minutes seconds (labeled) 0 decimal places",
      "composite": {
        "includeZero": true,
        "spacer": "",
        "units": [
          { "label": "°", "name": "Units.ARC_DEG" },
          { "label": "'", "name": "Units.ARC_MINUTE" },
          { "label": "\"", "name": "Units.ARC_SECOND" }
        ]
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

## Using KindOfQuantities with FormatSets

Tools and components that format quantities across applications should be linked to a [KindOfQuantity](../../bis/ec/kindofquantity.md) and a persistence unit. See [Domains](../../bis/domains/index.md) for available schemas, including `DefaultToolsUnits`, `CivilUnits`, and `AecUnits`, which define many KindOfQuantity values.

### Common KindOfQuantity Mappings

The table below lists common measurements with their typical KindOfQuantity and persistence unit. This allows tools to request a default KindOfQuantity from [IModelApp.formatsProvider]($core-frontend) and a persistence unit from [IModelApp.quantityFormatter]($core-frontend) to create a [FormatterSpec]($quantity) for quantity formatting.

| Measurement  | Actual KindOfQuantity (EC Full Name) | Persistence Unit |
| ------------- | ------------- | ------------- |
| Length  |  DefaultToolsUnits.LENGTH | Units.M |
| Angle  | DefaultToolsUnits.ANGLE  | Units.RAD |
| Area  |  DefaultToolsUnits.AREA | Units.SQ_M |
| Volume  | DefaultToolsUnits.VOLUME  | Units.CUB_M |
| Latitude/Longitude | DefaultToolsUnits.ANGLE | Units.RAD |
| Coordinate | DefaultToolsUnits.LENGTH_COORDINATE | Units.M |
| Stationing | CivilUnits.STATION | Units.M |
| Length (Survey Feet) | CivilUnits.LENGTH | Units.M |
| Length (Engineering) | AecUnits.LENGTH | Units.M |
| Bearing | CivilUnits.BEARING | Units.RAD |
| Time | DefaultToolsUnits.TIME | Units.S |

## FormatSet Storage and Loading

FormatSets are typically:

1. **Stored** in application settings or user preferences
2. **Loaded** when the application starts or when a user changes unit system preferences
3. **Applied** through a [FormatSetFormatsProvider](../usage/Providers.md#formatsetformatsprovider)

The [FormatSetFormatsProvider]($ecschema-metadata) provides runtime management of FormatSets with automatic update notifications when formats change.

## See Also

- [Formats](./Formats.md) - Understanding format specifications
- [Units](./Units.md) - Unit definitions and persistence units
- [Providers](../usage/Providers.md) - FormatSetFormatsProvider for runtime management
