---
publish: false
---
# NextVersion

## Display

### BENTLEY_materials_point_style

Support has been added for the proposed [BENTLEY_materials_point_style](https://github.com/CesiumGS/glTF/pull/91) glTF extension.

This allows iTwin.js to process and apply the above extension when loading glTF files. This means point primitives will be able to have a diameter property specified and respected in iTwin.js when loaded via glTF.

The image below demonstrates four points with different diameters and colors being rendered in iTwin.js using this glTF extension.

![A rendering of four points with varying colors and widths as specified via BENTLEY_materials_point_style](.\assets\BENTLEY_materials_point_style.jpg)

## Quantity Formatting

### Ratio Format Enhancements

Ratio formats now support a `ratioUnits` property for scale factor formatting and conversion. This enables proper display of architectural scales (e.g., `1/4"=1'`) and metric scales (e.g., `1:100`) with automatic unit conversion.

Key features include:

- Specify two units with optional custom labels for numerator and denominator
- Automatic scale factor conversion with ratio persistence units
- Support for both decimal and fractional display
- Validation requiring both units to share the same phenomenon (e.g., both LENGTH)
- Ratio formats can now omit `composite` units when `ratioUnits` are specified

For detailed examples and migration guidance, see the [Quantity Formatting documentation](../learning/quantity/index.md).
