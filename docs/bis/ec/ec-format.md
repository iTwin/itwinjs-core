# Format

## Attributes

**typeName** Defines the name of this Format. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.

**displayLabel** A localized display label that will be used instead of the name in a GUI. If not set, the name is used.

**description** A user-facing description of the Unit System. Localized and may be shown in a UI.

**type** Defines the presentation type of the format. The current supported types are:

- `decimal`
- `fractional`
- `scientific`
- `station`
- `bearing` (only supported in quantity package, not in ec yet)
- `azimuth` (only supported in quantity package, not in ec yet)
- `ratio` (only supported in quantity package, not in ec yet)

**precision** defines the precision to show the formatted value.

The allowable value are dependent on the type:

- If the type is **decimal**, **scientific** or **station**, decimal precision is used to signify the number of decimal places after the decimal separator. The allowed precisions are, `0` - `12`.
- If the type is **fractional**, the denominator of the value can be set to the following, `1|2|4|8|16|32|64|128|256`.

**roundFactor** value is rounded to a multiple of the round factor if it is a nonzero value and the `applyRounding` trait is set.  e.g. if the roundFactor is set to `2`, `42.2` would be rounded to `42` and `43.2` to `44`.

**minWidth** Determines the minimum number of characters included within parsed format. The count includes digits and separator chars (Decimal and Thousand).
Note: The number of chars defined does not override the precision, if the combination of precision and trailZeroes takes precedence over minWidth.
The width of the formatted string is filled, if needed, with the number of "0"'s needed to reach the minWidth.
For composite formats the minWidth applies to each of the components, not to the complete result.

**showSignOption** determines how positive and negative signs are shown in a parsed format.

The supported options are:

- `noSign`
  - Never show a sign even if the value is negative.
- `onlyNegative`
  - Only show a sign when the value is negative.
- `signAlways`
  - Always show a sign whether the value is positive or negative.
- `negativeParentheses`
  - Only show a sign when the value is negative but use parentheses instead of a negative sign
    - For example, -10 is formatted as `(10)`.

**formatTraits** a set of traits that can be used to customize details about the the parsed format.

The supported options are:

- `trailZeroes`
  - Indicates that one or more insignificant zeroes are to be added after the last digit of the fraction.
- `keepSingleZero`
  - Indicates that the fractional part of the number is required when the fraction is zero.
- `zeroEmpty`
  - Indicates that zero value should be presented by an empty string.
- `keepDecimalPoint`
  - Indicates that the decimal point is should be presented when the fraction is zero.
- `applyRounding`
  - Use the rounding factor.
- `fractionDash`
  - Use a dash between integer and fraction instead of a space: 3-1/4 rather than 3 1/4.
- `showUnitLabel`
  - Indicates that the numeric expression should be followed by the unit label.
  - Note: If the label is desired in front of the numeric expression, set the `prependUnitLabel` trait in addition to this trait.
- `prependUnitLabel`
  - Indicates the position of the label shifts from being after the numeric expression to in front of it. The `showUnitLabel` FormatTrait needs to be set in order for the Unit label to be shown, but the location of the label is overridden.
- `use1000Separator`
  - Indicates that thousands in the integer part of the number should be separated by a special char (. or,).
- `exponentOnlyNegative`
  - Indicates that if an exponent value is positive to not include a `+`. By default a sign, `+` or `-`, is always shown.

**decimalSeparator** the character used to separate the integer part from the fractional part when formatted in decimal form. If not defined a localized separator will be used.

**thousandSeparator** the character used to separate the integer part of a value in groups of 3 digits. If not defined a localized separator will be used.

**uomSeparator** the character used to separate the magnitude and the Unit label. For composite formats, this applies to each component.

- Example: If set to `-`, the Quantity is now displayed as `4-in`. Default is a single space character `4 in`.

**scientificType** determines the type of scientific format to use. Only valid when the type is scientific.

Supported scientific type:

- `normalized`
- `zeroNormalized`

**ratioType** determines the type of ratio format to use. Only valid and is required when the type is ratio.

Supported ratio type:

- `oneToN`
  - formats the left side of the ratio to always equal one, adjusting the right side value proportionally.
  - Example: An input of 2 will be formatted to 1:0.5. (assuming presentation unit and persistence unit stays the same)
- `NToOne`
  - formats the right side of the ratio to always equal one, adjusting the left side value proportionally.
  - Example: An input of 2 will be formatted to 2:1. (assuming presentation unit and persistence unit stays the same)
- `valueBased`
  - the lesser value of the two side scales to 1.
  - Example: input 0.5 will be formatted to 1:2, input 2 will be formatted to 2:1 (assuming presentation unit and persistence unit stays the same)
- `useGreatestCommonDivisor`
  - scales the input ratio to its simplest integer form
  - Example: input 0.6 will be formatted to 3:5 (assuming presentation unit and persistence unit stays the same)

**stationOffsetSize** represents the magnitude of the StationOffset.

- Example: StationOffsetSize of 2, in base 10, represents an offset of 100.

**stationSeparator** the character used to separate the station and off set portions of a `station` formatted value.

**azimuthBase** A numeric value indicating the base when type is set to azimuth. If set, the `azimuthBaseUnit` has to also be set to indicate which unit this value is in. Defaults to north. A value provided is interpreted from north clockwise.

**azimuthBaseUnit** Required if `azimuthBase` is set. A unit name which the base value is in. The unit has to match the phenomenon used on the presentation and persistence units.

**azimuthCounterClockwise** Only applies when the type is set to azimuth. Indicates whether the value should be formatted counter-clockwise from the base. Defaults to false.

**revolutionUnit** Required if `type` is set to either bearing or azimuth. The name of a unit which represents a full revolution in the phenomenon used by the presentation and persistence units. This means a value of "1" in that unit represents a full revolution (like 360 represents a full revolution in degrees).

## Sub-Elements

[Composite](#composite) _(0..1)_

### Composite

#### Attributes

**spacer** character used between segments of the composite. Defaults to a single space character if unset.

**includeZero** determines whether to keep a segment of the composite even if its magnitude is zero. By default, this is true.

**units (1..4)** an optional array of unit + label override objects.

- A single units entry formats a value like `42.42 ft`.
- If multiple units are specified they should be in decreasing magnitude and value split among the units like `42 ft 5.02 in`.
- Unit labels are optional. If not specified, the label will be set as the unit's display label.
- If a unit label is explicitly set to an empty string, no label will be shown for that unit and the label will remain an empty string.
- Unit labels specified in the composite format definition can be overriden as part of the format override in a KindOfQuantity. See [format override](./kindofquantity.md/#format-overrides).

## Examples

This format will result in values split between feet and inches with a precision of 1/8th of an inch.  e.g. a value of 12.54166 feet would be formatted as `12'-6 1/2"`, a value of 1 meter would be formatted as `3'-3 3/8"`.

```json
    "AmerFI": {
      "schemaItemType": "Format",
      "label": "FeetInches",
      "type": "Fractional",
      "precision": 8,
      "formatTraits": [
        "KeepSingleZero",
        "KeepDecimalPoint",
        "ShowUnitLabel"
      ],
      "uomSeparator": "",
      "composite": {
        "spacer": "-",
        "units": [
          {
            "name": "Units.FT",
            "label": "'"
          },
          {
            "name": "Units.IN",
            "label": "\""
          }
        ]
      }
    }
```

This format specifies only one unit, decimal formatting and not label override.  So 12.5466 feet would be formatted as `3.8227 m` and a value of 1 meter would be formatted as `1.0 m`

```json
    "MyMetersFormat": {
      "schemaItemType": "Format",
      "label": "real",
      "type": "Decimal",
      "precision": 4,
      "formatTraits": [
        "KeepSingleZero",
        "KeepDecimalPoint",
        "ShowUnitLabel"
      ]
    },
      "composite": {
        "units": [
          {
            "name": "Units.M"
          }
        ]
      }
```

This format does not specify any units so it may only be used in a [format override](./kindofquantity.md/#format-overrides).  Unitless formats and format overrides allow one base format to be used for any unit, see the [format override](./kindofquantity.md/#format-overrides) section for more details and examples.

```json
    "DefaultRealU": {
      "schemaItemType": "Format",
      "label": "realu",
      "type": "Decimal",
      "precision": 6,
      "formatTraits": [
        "KeepSingleZero",
        "KeepDecimalPoint",
        "ShowUnitLabel"
      ]
    }
```

This format specifies units which have labels that are intentionally missing or set to an empty string.

```json
    "MyMetersFormat": {
      "schemaItemType": "Format",
      "label": "real",
      "type": "Decimal",
      "precision": 4,
      "formatTraits": [
        "KeepSingleZero",
        "KeepDecimalPoint",
        "ShowUnitLabel"
      ],
      "composite": {
        "units": [{ "name": "Units.KM" }, { "name": "Units.M", "label": "" }, { "name": "Units.CM", "label": "centimeter" }, { "name": "Units.MM", "label": "millimeter" }]
      }
    }
```

This is an example of ratio format. The ratioType is specified to OneToN and the presentation unit is set to horizontal_per_vertical
For this format, an input value of `3.0` would be formatted into `1:0.333`

```json
  "MyRatioFormat": {
    "type": "Ratio",
    "ratioType": "OneToN",  // Formats the ratio in "1:N" form
    "precision": 3, // decimal digits if needed
    "composite": {
        "includeZero": true,
        "units": [
            { "name": "Units.HORIZONTAL_PER_VERTICAL" },
        ],
    },
};
```

This is an example of bearing format. It defines a Bearing type for angles, breaking them into degrees, minutes, and seconds, separated by colons (:)
Formatted bearing values look like `N45°00'00"E`

```json
  "MyBearingFormat": {
      "minWidth": 2,
      "precision": 0,
      "type": "Bearing",
      "revolutionUnit": "Units.REVOLUTION",
      "formatTraits": ["showUnitLabel"],
      "uomSeparator": "",
      "composite": {
        "includeZero": true,
        "spacer": "",
        "units": [
          { "name": "Units.ARC_DEG", "label": "°" },
          { "name": "Units.ARC_MINUTE", "label": "'" },
          { "name": "Units.ARC_SECOND", "label": "\"" },
        ],
      },
};
```

This is an example of an Azimuth format in decimal notation. It formats angles in degrees with 3 decimal places, includes trailing zeroes, and appends a degree symbol (°) without additional spacing. An input value of 600 degrees would be formatted as `240.000°`

```json
    "MyAzimuthDecimalFormat": {
      "formatTraits": ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      "minWidth": 6,
      "precision": 3,
      "type": "Azimuth",
      "uomSeparator": "",
      "revolutionUnit": "Units.REVOLUTION",
      "composite": {
        "includeZero": true,
        "spacer": "",
        "units": [
          { "name": "Units.ARC_DEG", "label": "°" }
        ],
      },
  }
```
