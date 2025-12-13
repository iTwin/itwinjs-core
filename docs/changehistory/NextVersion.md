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

### BENTLEY_materials_line_style

Support has been added for the proposed [BENTLEY_materials_line_style](https://github.com/CesiumGS/glTF/pull/89) glTF extension.

When a glTF material references this extension, iTwin.js now reads the specified `width` and `pattern`, maps the pattern into the shared line-style texture (registering new dash sequences as needed), and applies the override to both line primitives and mesh edges. This enables custom dash patterns authored in glTF to render faithfully inside iTwin.js without being limited to the built-in line codes.

The image below shows a triangle with a customized line pattern and width

![A triangle with a customized line pattern and width](.\assets\BENTLEY_materials_line_style.png)
