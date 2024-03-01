---
publish: false
---
# NextVersion

Table of contents:

- [Display](#display)
  - [Seafloor terrain](#seafloor-terrain)
- [Electron 29 support](#electron-29-support)
- [Editor](#editor)

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

