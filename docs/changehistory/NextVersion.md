---
publish: false
---
# NextVersion

## Obtaining element geometry on the frontend

Until now, an element's [GeometryStreamProps]($common) was only available on the backend - [IModelConnection.Elements.getProps]($frontend) always omits the geometry. [IModelConnection.Elements.loadProps]($frontend) has been introduced to provide greater control over which properties are returned. It accepts the Id, federation Guid, or [Code]($common) of the element of interest, and optionally an [ElementLoadOptions]($common) specifying which properties to include or exclude. For example, the following code queries for and iterates over the geometry of a [GeometricElement3d]($backend):

```ts
  function printGeometryStream(elementId: Id64String, iModel: IModelConnection): void {
    const props = await iModel.elements.loadProps(elementId, { wantGeometry: true }) as GeometricElement3dProps;
    assert(undefined !== props, `Element ${elementId} does not exist`);
    const iterator = GeometryStreamIterator.fromGeometricElement3d(props);
    for (const entry of iterator)
      console.log(JSON.stringify(entry));
  }
```

Keep in mind that geometry streams can be extremely large. They may also contain data like [BRepEntity.DataProps]($common) that cannot be interpreted on the frontend; for this reason BRep data is omitted from the geometry stream, unless explicitly requested via [ElementLoadOptions.wantBRepData]($common).

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

### [@bentley/webgl-compatibility](https://www.itwinjs.org/reference/webgl-compatibility/)

* [queryRenderCompatibility]($webgl-compatibility) for querying the client system's compatibility with the iTwin.js rendering system.
* [WebGLRenderCompatibilityInfo]($webgl-compatibility) for summarizing the client system's compatibility.
* [WebGLFeature]($webgl-compatibility) for enumerating the required and optionals features used by the iTwin.js rendering system.
* [WebGLRenderCompatibilityStatus]($webgl-compatibility) for describing a general compatiblity rating of a client system.
* [GraphicsDriverBugs]($webgl-compatibility) for describing any known graphics driver bugs for which iTwin.js will apply workarounds.
* [ContextCreator]($webgl-compatibility) for describing a function that creates and returns a WebGLContext for [queryRenderCompatibility]($webgl-compatibility).

## Breaking API changes

### @bentley/imodeljs-backend package

The arguments for the @beta protected static methods called during modifications have been changed to be more consistent and extensible:

* [Element]($backend) `[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]`
* [Model]($backend) `[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]`
* [ElementAspect]($backend) `[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]`

In addition, new protected static methods were added:

* [Element]($backend) `[onChildInsert, onChildInserted, onChildUpdate, onChildUpdated, onChildDelete, onChildDeleted, onChildAdd, onChildAdded, onChildDrop, onChildDropped]`
* [Model]($backend) `[onInsertElement, onInsertedElement, onUpdateElement, onUpdatedElement, onDeleteElement, onDeletedElement]`

The following method is now `async` to make it easier to integrate with asynchronous status and health reporting services:

* [IModelExportHandler.onProgress]($backend)
