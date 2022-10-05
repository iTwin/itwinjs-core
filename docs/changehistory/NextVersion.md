---
publish: false
---
# NextVersion

Table of contents:

- [Display system](#display-system)
  - [Reality model display customization](#reality-model-display-customization)
- [Presentation](#presentation)
  - [Controlling in-memory cache sizes](#controlling-in-memory-cache-sizes)

## Display system

### Reality model display customization

You can now customize various aspects of how a reality model is displayed within a [Viewport]($frontend) by applying your own [RealityModelDisplaySettings]($common) to the model. For contextual reality models, use [ContextRealityModel.displaySettings]($common); for persistent reality [Model]($backend)s, use [DisplayStyleSettings.setRealityModelDisplaySettings]($common).

For all types of reality models, you can customize how the model's color is mixed with a color override applied by a [FeatureAppearance]($common) or a [SpatialClassifier]($common). [RealityModelDisplaySettings.overrideColorRatio]($common) defaults to 0.5, mixing the two colors equally, but you can adjust it to any value between 0.0 (use only the model's color) and 1.0 (use only the override color).

Point clouds provide the following additional customizations:
- [PointCloudDisplaySettings.sizeMode]($common) controls how the size of each point in the cloud is computed - either as a specific radius in pixels via [PointCloudDisplaySettings.pixelSize]($common), or based on the [Tile]($frontend)'s voxel size in meters.
- When using voxel size mode, points can be scaled using [PointCloudDisplaySettings.voxelScale]($common) and clamped to a range of pixel sizes using [PointCloudDisplaySettings.minPixelsPerVoxel]($common) and [PointCloudDisplaySettings.maxPixelsPerVoxel]($common).
- [PointCloudDisplaySettings.shape]($common) specifies whether to draw rounded points or square points.

## Presentation

### Controlling in-memory cache sizes

The presentation library uses a number of SQLite connections, each of which have an associated in-memory page cache. Ability to control the size of these caches on the backend has been added to allow consumers fine-tune their configuration based on their memory restrictions and use cases.

The configuration is done when initializing [Presentation]($presentation-backend) or creating a [PresentationManager]($presentation-backend):

```ts
Presentation.initialize({
  caching: {
    // use 8 megabytes page cache for worker connections to iModels
    workerConnectionCacheSize: 8 * 1024 * 1024,
    // use a disk-based hierarchy cache with a 4 megabytes in-memory page cache
    hierarchies: {
      mode: HierarchyCacheMode.Disk,
      memoryCacheSize: 4 * 1024 * 1024,
    },
  },
});
```

See the [Caching documentation page](../presentation/advanced/Caching.md) for more details on various caches used by presentation system.
