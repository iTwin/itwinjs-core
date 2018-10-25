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

**precision** defines the precision to show the formatted value.

The allowable value are dependent on the type:

- If the type is **decimal**, **scientific** or **station**, decimal precision is used to signify the number of decimal places after the decimal separator. The allowed precisions are, `0` - `12`.
- If the type is **fractional**, the denominator of the value can be set to the following, `1|2|4|8|16|32|64|128|256`.

**roundFactor** value is rounded to a multiple of the round factor if it is a nonzero value and the `applyRounding` trait is set.  e.g. if the roundFactor is set to `2`, `42.2` would be rounded to `42` and `43.2` to `44`.

**minWidth** Determines the minimum number of characters included within parsed format. The count includes digits and separator chars (Decimal and Thousand).
Note: The number of chars defined does not override the precision, if the combination of precision and trailZeroes takes precedence over minWidth.
The width of the formatted string is filled, if needed, with the number of "0"'s needed to reach the minWidth.

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

**uomSeparator** the character used to separate the magnitude and the Unit label.

- Example: If the spacer is set to `-`, the Quantity is now displayed as `4-in`. If the spacer is the default, the Quantity is `4 in`.

**scientificType** determines the type of scientific format to use. Only valid when the type is scientific.

Supported scientific type:

- `normalized`
- `zeroNormalized`

**stationOffsetSize** represents the magnitude of the StationOffset.

- Example: StationOffsetSize of 2, in base 10, represents an offset of 100.

**stationSeparator** the character used to separate the

## Sub-Elements

[Composite](#composite) _(0..1)_

### Composite

#### Attributes

**spacer** character used between segments of the composite.

**includeZero** determines whether to keep a segment of the composite even if its magnitude is zero. By default, this is true.

## Sub-Elements

[Unit](./ec-unit.md) _(1..4)_