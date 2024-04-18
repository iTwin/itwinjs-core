---
publish: false
---

# NextVersion

Table of contents:

- [Text APIs](#text-apis)
- [Display](#display)
  - [Compressed 3D assets](#compressed-3d-assets)
- [Electron 30 support](#electron-30-support)
- [API deprecations](#api-deprecations)

## Text APIs

iTwin.js now provides APIs for creating and manipulating blocks of formatted text. A [TextBlock]($common) defines [Run]($common)s of text grouped into paragraphs. Each run can be formatted differently, based on its [TextStyle]($common). A text block can be associated with 2d or 3d model as a [TextAnnotation]($common). Annotations can be persisted as [TextAnnotation2d]($backend) and [TextAnnotation3d]($backend) elements, causing the text block to be displayed when viewing the model. Updating the annotation stored on the element via [TextAnnotation2d.setAnnotation]($backend) or [TextAnnotation3d.setAnnotation]($backend) will also update the geometric representation of the element. You can also produce a geometric representation of an annotation via [produceTextAnnotationGeometry]($backend), which can then be added to a geometry stream using [GeometryStreamBuilder.appendTextBlock]($common).

## Display

### Compressed 3D assets

The data within [glTF](https://en.wikipedia.org/wiki/GlTF) assets - including those delivered by [3D tilesets](https://github.com/CesiumGS/3d-tiles) - can optionally be compressed using two different methods: [draco compression](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_draco_mesh_compression/README.md) and [meshopt compression](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression). Both methods can significantly reduce the file size (and therefore download time) of an asset. iTwin.js already supports Draco compression, but that method only applies to triangle meshes. Meshopt compression works for many other kinds of data, including point clouds.

Now, meshopt compression is supported. You can use a library like [meshoptimizer](https://github.com/zeux/meshoptimizer) to compress 3D assets using this technique.

## Electron 30 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 30](https://www.electronjs.org/blog/electron-30-0).

## API deprecations

### @itwin/ecschema-metadata

The enumeration `SchemaItemType` has changed it's underlying type from numbers to strings which match the names of the schema item classes.
The method `schemaItemToString` has been marked deprecated as a translation between the enumeration value and the type names isn't longer necessary.
