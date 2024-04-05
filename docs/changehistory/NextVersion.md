---
publish: false
---

# NextVersion

Table of contents:

- [Display](#display)
  - [Compressed 3D assets](#compressed-3d-assets)
- [API deprecations](#api-deprecations)

## Display

### Compressed 3D assets

The data within [glTF](https://en.wikipedia.org/wiki/GlTF) assets - including those delivered by [3D tilesets](https://github.com/CesiumGS/3d-tiles) - can optionally be compressed using two different methods: [draco compression](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_draco_mesh_compression/README.md) and [meshopt compression](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression). Both methods can significantly reduce the file size (and therefore download time) of an asset. iTwin.js already supports Draco compression, but that method only applies to triangle meshes. Meshopt compression works for many other kinds of data, including point clouds.

Now, meshopt compression is supported. You can use a library like [meshoptimizer](https://github.com/zeux/meshoptimizer) to compress 3D assets using this technique.

## API deprecations

### @itwin/ecschema-metadata

Since the enumeration `SchemaItemType` changed it's underlaying type from int to string, the method `schemaItemToString` is now deprecated as the enum value can be used directly in the code
to get the schema items type name.
