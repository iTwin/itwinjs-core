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
