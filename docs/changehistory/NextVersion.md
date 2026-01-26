---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Display](#display)
    - [BENTLEY_materials_planar_fill](#bentley_materials_planar_fill)

## Display

### BENTLEY_materials_planar_fill

Support has been added for the proposed [BENTLEY_materials_planar_fill](https://github.com/CesiumGS/glTF/pull/90) glTF extension.

This allows iTwin.js to process and apply the above extension when loading glTF files. This means mesh primitives will be able to have planar fill display properties specified and respected in iTwin.js when loaded via glTF. The extension supports controlling whether meshes are filled in wireframe mode, whether they fill with the background color, and whether they render behind other coplanar geometry belonging to the same logical object.

When this extension is present on a material, iTwin.js will apply the appropriate fill flags to control the rendering appearance of the associated mesh geometry.

Here is an example of `wireframeFill` being applied to a test dataset:

![A rendering pointing to three colored quads with varying wireframeFill properties as specified via BENTLEY_materials_planar_fill](./assets/BENTLEY_materials_planar_fill-wireframeFill.jpg)

Here is an example of `backgroundFill` being applied to a test dataset:

![A rendering pointing to one colored quad indicating its backgroundFill property is respected as specified via BENTLEY_materials_planar_fill](./assets/BENTLEY_materials_planar_fill-backgroundFill.jpg)

Here is an example of `behind` being applied to a test dataset:

![A rendering pointing to an overlapping pair of colored coplanar quads indicating the behind property is respected as specified via BENTLEY_materials_planar_fill](./assets/BENTLEY_materials_planar_fill-behind.jpg)
