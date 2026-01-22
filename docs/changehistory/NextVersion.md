---
publish: false
---

# NextVersion

- [@itwin/presentation-common](#itwinpresentation-common)
  - [Additions](#additions)
  - [Fixes](#fixes)
- [Display](#display)
  - [BENTLEY_materials_planar_fill](#bentley_materials_planar_fill)

## @itwin/presentation-common

### Additions

- Added `parentArrayField` and `parentStructField` attributes to `PropertiesField` class to allow easier navigation to parent fields when traversing content. The new properties, together with `parent` property, are mutually exclusive, i.e., only one of them can be defined at a time (a field can't be a struct member and an array item field at the same time).
- Added `getFieldByName` method to `ArrayPropertiesField` and `StructPropertiesField`.
  - For array field, the method returns items field if its name matches the given name.
  - For struct field, the method returns the member field with the given name, if any.

### Fixes

- Fixed content traverser (result of `createContentTraverser` call) not passing parent struct / array field names as `parentFieldName` to `IContentVisitor` methods.

## Display

### BENTLEY_materials_planar_fill

Support has been added for the proposed [BENTLEY_materials_planar_fill](https://github.com/CesiumGS/glTF/pull/90) glTF extension.

This allows iTwin.js to process and apply the above extension when loading glTF files. This means mesh primitives will be able to have planar fill display properties specified and respected in iTwin.js when loaded via glTF. The extension supports controlling whether meshes are filled in wireframe mode, whether they fill with the background color, and whether they render behind other coplanar geometry belonging to the same logical object.

When this extension is present on a material, iTwin.js will apply the appropriate fill flags to control the rendering appearance of the associated mesh geometry.

Here is an example of `wireframeFill` being applied to a test dataset:

![A rendering pointing to three colored quads with varying wireframeFill properties as specified via BENTLEY_materials_planar_fill](.\assets\BENTLEY_materials_planar_fill-wireframeFill.jpg)

Here is an example of `backgroundFill` being applied to a test dataset:

![A rendering pointing to one colored quad indicating its backgroundFill property is respected as specified via BENTLEY_materials_planar_fill](.\assets\BENTLEY_materials_planar_fill-backgroundFill.jpg)

Here is an example of `behind` behind applied to a test dataset:

![A rendering pointing to an overlapping pair of colored coplanar quads indicating the behind property is respected as specified via BENTLEY_materials_planar_fill](.\assets\BENTLEY_materials_planar_fill-behind.jpg)
