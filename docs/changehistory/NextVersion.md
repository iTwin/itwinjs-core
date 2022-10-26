---
publish: false
---
# NextVersion

Table of contents:

- [Display system](#display-system)
  - [Reality model display customization](#reality-model-display-customization)
  - [View padding](#view-padding)
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

## Display system

### Reality model display customization

You can now customize various aspects of how a reality model is displayed within a [Viewport]($frontend) by applying your own [RealityModelDisplaySettings]($common) to the model. For contextual reality models, use [ContextRealityModel.displaySettings]($common); for persistent reality [Model]($backend)s, use [DisplayStyleSettings.setRealityModelDisplaySettings]($common).

For all types of reality models, you can customize how the model's color is mixed with a color override applied by a [FeatureAppearance]($common) or a [SpatialClassifier]($common). [RealityModelDisplaySettings.overrideColorRatio]($common) defaults to 0.5, mixing the two colors equally, but you can adjust it to any value between 0.0 (use only the model's color) and 1.0 (use only the override color).

Point clouds provide the following additional customizations:

- [PointCloudDisplaySettings.sizeMode]($common) controls how the size of each point in the cloud is computed - either as a specific radius in pixels via [PointCloudDisplaySettings.pixelSize]($common), or based on the [Tile]($frontend)'s voxel size in meters.
- When using voxel size mode, points can be scaled using [PointCloudDisplaySettings.voxelScale]($common) and clamped to a range of pixel sizes using [PointCloudDisplaySettings.minPixelsPerVoxel]($common) and [PointCloudDisplaySettings.maxPixelsPerVoxel]($common).
- [PointCloudDisplaySettings.shape]($common) specifies whether to draw rounded points or square points.

### View padding

Functions like [ViewState.lookAtVolume]($frontend) and [Viewport.zoomToElements]($frontend) fit a view to a specified volume. They accept a [MarginOptions]($frontend) that allows the caller to customize how tightly the view fits to the volume, via [MarginPercent]($frontend). However, the amount by which the volume is enlarged to add extra space can yield surprising results. For example, a [MarginPercent]($frontend) that specifies a margin of 25% on each side - `{left: .25, right: .25, top: .25, bottom: .25}` - actually *doubles* the width and height of the volume, adding 50% of the original volume's size to each side. Moreover, [MarginPercent]($frontend)'s constructor clamps the margin values to a minimum of zero and maximum of 0.25.

Now, [MarginOptions]($frontend) has an alternative way to specify how to adjust the size of the viewed volume, using [MarginOptions.paddingPercent]($frontend). Like [MarginPercent]($frontend), a [PaddingPercent]($frontend) specifies the extra space as a percentage of the original volume's space on each side - though it may also specify a single padding to be applied to all four sides, or omit any side that should have no padding applied. For example,
```
{paddingPercent: {{left: .2, right: .2, top: .2, bottom: .2}}
// is equivalent to
{paddingPercent: .2}
```
and
```
{paddingPercent: {left: 0, top: 0, right: .5, bottom: .5}}
// is equivalent to
{paddingPercent: {right: .5, bottom: .5}
```

Moreover, [PaddingPercent]($frontend) imposes no constraints on the padding values. They can even be negative, which causes the volume to shrink instead of expand by **subtracting** a percentage of the original volume's size from one or more sides.

The padding computations are more straightforward than those used for margins. For example, `{paddingPercent: 0.25}` adds 25% of the original volume's size to each side, whereas the equivalent `marginPercent` adds 50% to each side.

Note that both margins and padding apply only to 2d views, or to 3d views with the camera turned off; and that additional extra space will be allocated on either the top and bottom or left and right to preserve the viewport's aspect ratio.

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
