---
publish: false
---
# NextVersion

Table of contents:

- [Display system](#display-system)
  - [Reality model display customization](#reality-model-display-customization)
- [Presentation](#presentation)
  - [Controlling in-memory cache sizes](#controlling-in-memory-cache-sizes)
  - [Changes to infinite hierarchy prevention](#changes-to-infinite-hierarchy-prevention)
- [Element aspect ids](#element-aspect-ids)
- [AppUi](#appui)
- [Geometry](#geometry)
  - [Polyface](#polyface)
- [Deprecations](#deprecations)
  - [@itwin/core-backend](#itwincore-backend)
  - [@itwin/core-transformer](#itwincore-transformer)
- [New packages](#new-packages)
  - [@itwin/map-layers-formats](#map-layers-formats)

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

### Changes to infinite hierarchy prevention

The idea of infinite hierarchy prevention is to stop producing hierarchy when we notice duplicate ancestor nodes. See more details about that in the [Infinite hierarchy prevention page](../presentation/hierarchies/InfiniteHierarchiesPrevention.md).

Previously, when a duplicate node was detected, our approach to handle the situation was to just hide the duplicate node altogether. However, in some situations that turned out to be causing mismatches between what we get through a nodes count request and what we get through a nodes request (e.g. the count request returns `2`, but the nodes request returns only 1 node). There was no way to keep the count request efficient with this approach of handling infinite hierarchies.

The new approach, instead of hiding the duplicate node, shows it, but without any children. This still "breaks" the hierarchy when we want that, but keeps the count and nodes in sync.

#### Example

Say, we have two instances A and B and they point to each other through a relationship:

```
A -> refers to -> B
B -> refers to -> A
```

With presentation rules we can set up a hierarchy where root node is A, its child is B, whose child is again A, and so on.

With previous approach the produced hierarchy "breaks" at the B node and looks like this:

```
+ A
+--+ B
```

With the new approach we "break" at the duplicate A node:

```
+ A
+--+ B
   +--+ A
```

## Element aspect ids

[IModelDb.Elements.insertAspect]($backend) now returns the id of the newly inserted aspect. Aspects exist in a different id space from elements, so
the ids returned are not unique from all element ids and may collide.

## AppUi

### Setting allowed panel zones for widgets

When defining a Widget with AbstractWidgetProperties, you can now specify on which sides of the ContentArea the it can be docked. The optional prop allowedPanelTargets is an array of any of the following: "left", "right", "top", "bottom". By default, all regions are allowed. You must specify at least one allowed target in the array.


## New packages

### @itwin/map-layers-formats

A new `@itwin/map-layers-formats` package has been introduced to provide additional [MapLayerFormat]($frontend)s not delivered as part of `@itwin/core-frontend`. The initial release contains the new `ArgGISFeatre` format which allows **vector data&& published by *ArcGIS Feature services* to be displayed in a [Viewport]($frontend).

To use this package, you must initialize it by calling [MapLayersFormats.initialize]($package-alias???). This should be done only **after** [IModelHost.startup]($frontend) has been called.

## Geometry

### Polyface

The method [Polyface.facetCount]($core-geometry) has been added to this abstract class, with a default implementation that returns undefined. Implementers should override to return the number of facets of the mesh.

## Deprecations

### @itwin/core-backend

The synchronous [IModelDb.Views.getViewStateData]($backend) has been deprecated in favor of [IModelDb.Views.getViewStateProps]($backend), which accepts the same inputs and returns the same output, but performs some potentially-expensive work on a background thread to avoid blocking the JavaScript event loop.

The [IModelCloneContext]($backend) class in `@itwin/core-backend` has been renamed to [IModelElementCloneContext]($backend) to better reflect its inability to clone non-element entities.
 The type `IModelCloneContext` is still exported from the package as an alias for `IModelElementCloneContext`. `@itwin/core-transformer` now provides a specialization of `IModelElementCloneContext` named [IModelCloneContext]($transformer).

### @itwin/core-transformer

[IModelTransformer.initFromExternalSourceAspects]($transformer) is deprecated and in most cases no longer needed, because the transformer now handles referencing properties on out-of-order non-element entities like aspects, models, and relationships. If you are not using a method like `processAll` or `processChanges` to run the transformer, then you do need to replace `initFromExternalSourceAspects` with [IModelTransformer.initialize]($transformer).
