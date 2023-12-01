# KindOfQuantity

> Commonly referred to as a `KOQ`.

Describes a strongly typed *kind* for a property. This kind identifies what is being measured and stored in an [ECProperty](./ec-property.md). It is used for grouping like properties, setting units and display formatting, and creating quantity objects.

## Attributes

**typeName** Defines the name of this KindOfQuantity. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.

**description** A user-facing description of the KindOfQuantity. Localized and may be shown in a UI.

**displayLabel** A localized display label that will be used instead of the name in a UI. If not set the Type Name of the KindOfQuantity will be used.

**persistenceUnit** The unit values of this kind will be stored in.

**relativeError** The ratio of the absolute error and the actual value persisted as a fractional value (not a percentage).  For example if a pipes diameter is measured +/- 1 mm at a diameter of 2 meters the relative error would be 1/2000 => 5e-4.

**presentationUnits** A list of [Formats](./ec-format.md) or [format overrides](#format-overrides) that can be used to display the value in the UI.  The first format in the list is used as the default presentation of the value.  e.g. `f:DefaultRealU(4)[u:M];f:DefaultRealU(4)[u:MM]`

The first format in the list is considered the default presentation [format](./ec-format.md) used when displaying this kind of value in the UI.

## Format Overrides

A [format](./ec-format.md) defines the way a value of a property can be displayed in the UI.  Formats support several numerical and unit based styles and sometimes that is desired is to change a single part of an existing format, defined within the same schema or reference schema.  Instead of copying that format to make the small change, KOQ supports overriding specific portions of the format by using [Format Strings](#format-string).

Format overrides are currently supported the following modifications to an existing Format,

- Change the precision of the Format
- Add units to a Format that does not already define any
- Change the label of units that already exist in the format

### Format String

The **Format String** is a short string-based representation of a [Format](./ec-format.md), which allows overriding of certain key properties of a Format.
Its main purpose is to reduce the need for new formats to be created for minor things such as precision and label changes.

The below represents the string literal syntax. All italicized values are to be replaced with appropriate values.

*formatName*`(`*precision*`)` `[`*unitName*`|`*unitLabel*`]` `[`*unitName*`|`*unitLabel*`]` `[`*unitName*`|`*unitLabel*`]` `[`*unitName*`|`*unitLabel*`]`

*formatName*

- Required
- A valid, fully-qualified, ECName referring to a [Format](./ec-format.md)

*precision*

- Optional
- Integer
  - See [Format](./ec-format.md) for valid options
- Overrides the number of decimal digits specified in the Format.

*Unit Override* = `[`*unitName*`|`*unitLabel*`]`

- Optional
- Adds units to a Format that specifies **none** or overrides unit labels in a Format definition that specifies units.
- Position in format string determines which unit it affects in the Format's composite
  - `formatName(precision)[First Unit][Second Unit][Third Unit][Fourth Unit]`
- Overrides may not change units if any are originally defined in the base format, they may only change the display label.
- Up to 4 per format string
- As unit labels are optional, they can be kept unset or they can be set to an empty string.
- When a unit label is not specified in the override, the label will get defaulted to the display label of the unit. The label if it exists in the composite format will be ignored in this case. See example [Null unit label in override](#format-overrides-with-nullempty-unit-labels).
- When a unit label is explicitly set to an empty string, no label will be shown for that unit and the final label will remain an empty string. See example [Empty unit label in override](#format-overrides-with-nullempty-unit-labels).
- Example
  - `[u:KM][u:M|meters][u:CM|][u:MM|millimetre]`

#### Parts of a Unit Override

*unitName*

- Required
- Name of a unit.
  - The name must be a fully qualified ECName.

*unitLabel*

- Optional
- A string that overrides the label of the Unit, in the position specified in this Unit Override
  - For example, the second override listed would affect the label of the second unit
- The character `]` is not allowed, if this character is desired, a new [Format](./ec-format.md) is required.

### Examples

  #### The format string `f:DefaultRealU[u:M][u:CM][u:MM]` will override the first unit to be `u:M`, the second unit to be `u:CM` and the third unit to be `u:MM`

  #### For the format `f:AmerFI` (which has `FT` as a first unit and `IN` as a second unit), valid overrides must specify both units in the correct order:

| Intention             | Invalid way                        | Valid way                        |
|-----------------------|------------------------------------|----------------------------------|
| Override second Label | f:AmerFI[u:IN&#124;inches]         | f:AmerFI[u:FT][u:IN&#124;inches] |
| Override first Label  | f:AmerFI[u:FT&#124;feet]           | f:AmerFI[u:FT&#124;feet][u:IN]   |
| Change units          | f:AmerFI[u:M&#124;m][u:CM&#124;cm] | Never Valid                      |

 #### Format overrides with null/empty unit labels
  - Consider the below units and format:

  ```json
      "TestUnit": { "schemaItemType": "Unit", "label": "TestUnitLabel" },

      "TestFormat": {
        "schemaItemType": "Format",
        "composite": {
          "spacer": "-",
          "units": [{ "name": "TestUnitMajor" }]
        }
      }
  ```
  - If the unit label override is kept unset `TestFormat[TestUnitMajor]`, the final label will default to the unit's display label `TestUnitMajorLabel`.
  - If the unit label override is set to an empty string `TestFormat[TestUnitMajor|]`, the final label will set to an empty string.
  - If the unit label override is set to a valid `TestFormat[TestUnitMajor|centimetre]`, the final label will be the overriden string `centimetre`.