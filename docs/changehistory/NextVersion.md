---
publish: false
---

# NextVersion

Table of contents:

- [NextVersion](#nextversion)
  - [Text APIs](#text-apis)
  - [Display](#display)
    - [Compressed 3D assets](#compressed-3d-assets)
  - [Electron 30 support](#electron-30-support)
  - [API deprecations](#api-deprecations)
    - [@itwin/ecschema-metadata](#itwinecschema-metadata)
  - [Editor](#editor)
  - [Lock Control](#lock-control)
  - [Presentation](#presentation)
    - [Deprecation of async array results in favor of async iterators](#deprecation-of-async-array-results-in-favor-of-async-iterators)

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

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 29](https://www.electronjs.org/blog/electron-29-0).

## Editor

Changes to @beta [BasicManipulationCommandIpc]($editor-common) class:

- [BasicManipulationCommandIpc.insertGeometricElement]($editor-common) no longer takes an optional ElementGeometryBuilderParams as this can be specified in [GeometricElementProps]($common).
- [BasicManipulationCommandIpc.insertGeometryPart]($editor-common) no longer takes an optional ElementGeometryBuilderParamsForPart as this can be specified in [GeometryPartProps]($common).

Changes to @beta [CreateElementWithDynamicsTool]($editor-frontend) class:

- [CreateElementWithDynamicsTool.doCreateElement]($editor-frontend) no longer takes an optional [ElementGeometryBuilderParams]($common) as it will be set on the supplied [GeometricElementProps]($common).

## Lock Control

Changes to @beta [LockControl]($backend) class to make releaseAllLocks @internal. Should only be called internally after pushing or abandoning all changes.

## Presentation

### Deprecation of async array results in favor of async iterators

`PresentationManager` contains a number of methods to retrieve sets of results like nodes, content, etc. All of these methods have been deprecated in favor of new ones that return an async iterator instead of an array:

- Use `getContentIterator` instead of `getContent` and `getContentAndSize`.
- Use `getDisplayLabelDefinitionsIterator` instead of `getDisplayLabelDefinitions`.
- Use `getDistinctValuesIterator` instead of `getPagedDistinctValues`.
- Use `getNodesIterator` instead of `getNodes` and `getNodesAndCount`.

All of the above methods, including the deprecated ones, received ability to load large sets of results concurrently. Previously, when requesting a large set (page size > 1000), the result was created by sending a number of requests sequentially by requesting the first page, then the second, and so on, until the whole requested set was retrieved. Now, we send a request for the first page to determine total number of items and backend's page size limit, together with the first page of results, and then other requests are made all at once. At attribute `maxParallelRequests` was added to these methods to control how many parallel requests should be sent at a time.

While performance-wise deprecated methods should be in line with the newly added async iterator ones, the latter have two advantages:

1. Caller can start iterating over results as soon as we receive the first page, instead of having to wait for the whole set.
2. The iterator version stops sending requests as soon as the caller stops iterating over the async iterator.

> Example: Showing display labels for a large set of elements in a React component.
>
> The deprecated approach would be to use `PresentationManager.getDisplayLabelDefinitions` to retrieve labels of all elements. Because the API has to load all the data before returning it to the widget, user has to wait a long time to start seeing the results. Moreover, if he decides to close the widget (the component is unmounted), the `getDisplayLabelDefinitions` keeps building the array by sending requests to the backend - there's no way to cancel that.
>
> The new approach is to use `PresentationManager.getDisplayLabelDefinitionsIterator` to get the labels. The labels get streamed to the called as soon as the first results' page is retrieved, so user gets to see initial results quickly, while additional pages keep loading in the background. In addition, if the component is unmounted, iteration can be stopped, thus cancelling all further requests to the backend:
>
> ```ts
> const { items } = await manager.getDisplayLabelDefinitionsIterator(requestProps);
> for await (const label of items) {
>  if (isComponentUnmounted) {
>    break;
>  }
>  // update component's model to render the loaded label
> }
> ```
