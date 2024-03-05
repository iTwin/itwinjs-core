---
publish: false
---
# NextVersion

Table of contents:

- [Display](#display)
  - [Seafloor terrain](#seafloor-terrain)
- [Electron 29 support](#electron-29-support)
- [Editor](#editor)
- [Presentation](#presentation)
  - [Deprecation of async array results in favor of async iterators](#deprecation-of-async-array-results-in-favor-of-async-iterators)

## Display

### Seafloor terrain

The iTwin viewer supports visualizing the Earth's landmasses in 3d using [Cesium World Terrain](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain), providing real-world context for infrastructure built on land. For undersea infrastructure, the context of the seafloor terrain can be just as important. Now, you can make use of [Cesium World Bathymetry](https://cesium.com/platform/cesium-ion/content/cesium-world-bathymetry/) to get a glimpse of the world under the waves.

To enable seafloor terrain, create a [TerrainSettings]($common) specifying [CesiumTerrainAssetId.Bathymetry]($common) as the `dataSource`. For example:

```ts
  function enableBathymetry(viewport: Viewport): void {
    viewport.changeBackgroundMapProps({
      terrainSettings: {
        dataSource: CesiumTerrainAssetId.Bathymetry,
      }
    });
  }
```

You can alternatively specify the Id of any global Cesium ION asset to which you have access. Either way, make sure you add the asset to your ION account first.

The new [TerrainSettings.dataSource]($common) property can be used by custom [TerrainProvider]($frontend)s as well, to select from different sources of terrain supplied by the same provider.

## Electron 29 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 29](https://www.electronjs.org/blog/electron-29-0).

## Editor

Changes to @beta [BasicManipulationCommandIpc]($editor-common) class:

- [BasicManipulationCommandIpc.insertGeometricElement]($editor-common) no longer takes an optional ElementGeometryBuilderParams as this can be specified in [GeometricElementProps]($common).
- [BasicManipulationCommandIpc.insertGeometryPart]($editor-common) no longer takes an optional ElementGeometryBuilderParamsForPart as this can be specified in [GeometryPartProps]($common).

Changes to @beta [CreateElementWithDynamicsTool]($editor-frontend) class:

- [CreateElementWithDynamicsTool.doCreateElement]($editor-frontend) no longer takes an optional [ElementGeometryBuilderParams]($common) as it will be set on the supplied [GeometricElementProps]($common).

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
