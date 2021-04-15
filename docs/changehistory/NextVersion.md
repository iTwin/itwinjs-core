---
publish: false
---
# NextVersion

## Clipping enhancements

The contents of a [ViewState]($frontend) can be clipped by applying a [ClipVector]($geometry-core) to the view via [ViewState.setViewClip]($frontend). Several enhancements have been made to this feature:

### Colorization

[ClipStyle.insideColor]($common) and [ClipStyle.outsideColor]($common) can be used to colorize geometry based on whether it is inside or outside of the clip volume. If the outside color is defined, then that geometry will be drawn in the specified color instead of being clipped. These properties replace the beta [Viewport]($frontend) methods `setInsideColor` and `setOutsideColor` and are saved in the [DisplayStyle]($backend).

### Model clip groups

[ModelClipGroups]($common) can be used to apply additional clip volumes to groups of models. Try it out with an [interactive demo](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=swiping-viewport-sample). Note that [ViewFlags.clipVolume]($common) applies **only** to the view clip - model clips apply regardless of view flags.

### Nested clip volumes

Clip volumes now nest. For example, if you define a view clip, a model clip group, and a schedule script that applies its own clip volume, then geometry will be clipped by the **intersection** of all three clip volumes. Previously, only one clip volume could be active at a time.

## Grid display enhancements

The planar grid that is displayed when [ViewFlags.grid]($common) is now displayed with a shader rather than as explicit geometry.  This improved the overall appearance and efficiency of the grid display and corrects several anomalies when grid display was unstable at the horizon of a perspective view.  The view frustum is now expanded as necessary when grids are displayed to avoid truncating the grid to the displayed geometry.

## Promoted APIs

The following APIs have been promoted to `public`. Public APIs are guaranteed to remain stable for the duration of the current major version of a package.

### @bentley/bentleyjs-core

* [assert]($bentleyjs-core) for asserting logic invariants.
* [ProcessDetector]($bentleyjs-core) for querying the type of executing Javascript process.
* [ObservableSet]($bentleyjs-core) for a [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) that emits events when its contents are modified.
* [ByteStream]($bentleyjs-core) for extracting data from binary streams.
* Types related to collections of [Id64String]($bentleyjs-core)s
  * [OrderedId64Iterable]($bentleyjs-core) and [OrderedId64Array]($bentleyjs-core)
  * [CompressedId64Set]($bentleyjs-core) and [MutableCompressedId64Set]($bentleyjs-core)

## Breaking API changes

### @bentley/imodeljs-backend package

The arguments for the @beta protected static methods called during modifications:

  [Element]($backend) `[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]`
  [Model]($backend) `[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]`
  [ElementAspect]($backend) `[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]`

Have been changed to be more consistent and extensible.

In addition, new protected static methods were added:

  [Element]($backend) `[onChildInsert, onChildInserted, onChildUpdate, onChildUpdated, onChildDelete, onChildDeleted, onChildAdd, onChildAdded, onChildDrop, onChildDropped]`
  [Model]($backend) `[onInsertElement, onInsertedElement, onUpdateElement, onUpdatedElement, onDeleteElement, onDeletedElement]`

The beta class `SettingsProvider` was renamed to `SettingsTabsProvider`.

### @bentley/ui-framework package

The beta class `QuantityFormatSettingsPanel` was renamed to `QuantityFormatSettingsPage`.

### @bentley/imodeljs-quantity package

#### UnitProps property name change

The interface [UnitProps]($quantity) property `unitFamily` has been renamed to `phenomenon` to be consistent with naming in `ecschema-metadata` package.

### @bentley/presentation-components package

Return value of [usePresentationTreeNodeLoader]($presentation-components) hook was changed from

```ts
PagedTreeNodeLoader<IPresentationTreeDataProvider>
```

to

```ts
{
  nodeLoader: PagedTreeNodeLoader<IPresentationTreeDataProvider>;
  onItemsRendered: (items: RenderedItemsRange) => void;
}
```

Callback `onItemsRendered` returned from [usePresentationTreeNodeLoader]($presentation-components) hook should be passed to [ControlledTree]($ui-components) when property `enableHierarchyAutoUpdate` on [PresentationTreeNodeLoaderProps]($presentation-components) is set to true. If hierarchy auto update is not enabled replace:

```ts
const nodeLoader = usePresentationTreeNodeLoader(props);
```

With:

```ts
const { nodeLoader } = usePresentationTreeNodeLoader(props);
```

If hierarchy auto update is enabled replace:

```ts
const nodeLoader = usePresentationTreeNodeLoader(props);
```

### [@bentley/webgl-compatibility](https://www.itwinjs.org/reference/webgl-compatibility/)

* [queryRenderCompatibility]($webgl-compatibility) for querying the client system's compatibility with the iTwin.js rendering system.
* [WebGLRenderCompatibilityInfo]($webgl-compatibility) for summarizing the client system's compatibility.
* [WebGLFeature]($webgl-compatibility) for enumerating the required and optionals features used by the iTwin.js rendering system.
* [WebGLRenderCompatibilityStatus]($webgl-compatibility) for describing a general compatiblity rating of a client system.
* [GraphicsDriverBugs]($webgl-compatibility) for describing any known graphics driver bugs for which iTwin.js will apply workarounds.
* [ContextCreator]($webgl-compatibility) for describing a function that creates and returns a WebGLContext for [queryRenderCompatibility]($webgl-compatibility).
