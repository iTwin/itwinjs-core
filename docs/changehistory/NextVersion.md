---
publish: false
---
# NextVersion

## New IModel events

[IModel]($common)s now emit events when their properties change.

* [IModel.onProjectExtentsChanged]($common)
* [IModel.onGlobalOriginChanged]($common)
* [IModel.onEcefLocationChanged]($common)
* [IModel.onGeographicCoordinateSystemChanged]($common)
* [IModel.onRootSubjectChanged]($common)
* [IModel.onNameChanged]($common)

Within [IpcApp]($frontend)-based applications, [BriefcaseConnection]($frontend)s now automatically synchronize their properties in response to such events produced by changes on the backend. For example, if [BriefcaseDb.projectExtents]($backend) is modified, [BriefcaseConnection.projectExtents]($frontend) will be updated to match and both the BriefcaseDb and BriefcaseConnection will emit an `onProjectExtentsChanged` event.

## Reality model APIs

Several APIs relating to reality models have been introduced, in some cases replacing previous `beta` APIs. A reality model can be displayed in a [Viewport]($frontend) in one of two ways:
* Adding to the [ViewState]($frontend)'s [ModelSelector]($backend) the Id of a persistent [SpatialModelState]($frontend) containing a URL pointing to a 3d tileset; or
* Attaching to the [DisplayStyleState]($frontend) a [ContextRealityModel]($common) with a URL pointing to a 3d tileset.

The set of [ContextRealityModels]($common) attached to a display style can be accessed and modified via [DisplayStyleSettings.contextRealityModels]($common).

Spatial classification can be applied to a reality model using [ContextRealityModel.classifiers]($common) or [SpatialModelState.classifiers]($frontend). The [SpatialClassifier]($common) APIs replace the previous `beta` APIs in the `SpatialClassificationProps` namespace.

Portions of a reality model can be masked by other models using [ContextRealityModel.planarClipMaskSettings]($common) or, for persistent models, [DisplayStyleSettings.planarClipMasks]($common).

The color, transparency, locatability, and "emphasized" state of a reality model can be overridden using [ContextRealityModel.appearanceOverrides]($common) or, for persistent models, [DisplayStyleSettings.modelAppearanceOverrides]($common).

A reality model displaying simple building meshes for locations all over the world obtained from [OpenStreetMap Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/) can be enabled via [DisplayStyleState.setOSMBuildingDisplay]($frontend).

## Popout Widgets

IModelApps, that use AppUi version "2", can now specify if a Widget can support being "popped-out" to a child popup window. The child window runs in the same javascript context as the parent application window. See [Child Window Manager]($docs/learning/ui/framework/ChildWindows.md) for more details.
## Promoted APIs


The following previously `alpha` or `beta` APIs have been promoted to `public`. Public APIs are guaranteed to remain stable for the duration of the current major version of the package.

### [@bentley/bentleyjs-core](https://www.itwinjs.org/reference/bentleyjs-core/)

* [ReadonlySortedArray.findEquivalent]($bentleyjs-core) and [ReadonlySortedArray.indexOfEquivalent]($bentleyjs-core) for locating an element based on a custom criterion.
* [CompressedId64Set.sortAndCompress]($bentleyjs-core) for conveniently producing a compact representation of a set of [Id64String]($bentleyjs-core)s.

### [@bentley/imodeljs-common](https://www.itwinjs.org/reference/imodeljs-common/)

* [RenderSchedule]($common) for defining scripts to visualize changes in an iModel over time.
* [DisplayStyleSettings.renderTimeline]($common) for associating a [RenderTimeline]($backend) with a [DisplayStyle]($backend).
* [DisplayStyleSettings.timePoint]($common) for specifying the currently-simulated point along a view's [RenderSchedule.Script]($common).
* [ElementGraphicsRequestProps]($common) for generating [RenderGraphic]($frontend)s from [GeometricElement]($backend)s or arbitrary geometry streams.

### [@bentley/imodeljs-frontend](https://www.itwinjs.org/reference/imodeljs-frontend/)

* [LookAndMoveTool]($frontend) for using videogame-like mouse and keyboard controls to navigate a 3d view.
* [SetupCameraTool]($frontend) for defining the camera for a [SpatialViewState]($frontend).
* [IModelApp.queryRenderCompatibility]($frontend) for determining the set of WebGL features supported by your browser and device.
* [ToolAdmin.exceptionHandler]($frontend) and [ToolAdmin.exceptionOptions]($frontend) for customizing how your app reacts to unhandled exceptions.
* [Viewport.antialiasSamples]($frontend) and [ViewManager.setAntialiasingAllViews]($frontend) for applying [antialiasing](https://en.wikipedia.org/wiki/Multisample_anti-aliasing) to make viewport images appear smoother.

### [@bentley/imodeljs-backend](https://www.itwinjs.org/reference/imodeljs-backend/)

* [TxnManager]($backend) for managing local changes to a [BriefcaseDb]($backend).
* [IModelDb.computeProjectExtents]($backend) for computing default project extents based on the ranges of spatial elements.
* [IModelDb.generateElementGraphics]($backend) for generating [RenderGraphic]($frontend)s from [GeometricElement]($backend)s or arbitrary geometry streams.
* [IModelDb.getGeometryContainment]($backend) for computing the containment of a set of [GeometricElement]($backend)s within a [ClipVector]($geometry-core).
* [IModelDb.getMassProperties]($backend) for computing [GeometricElement]($backend) properties like area and volume.
* [RenderTimeline]($backend) element for persisting a [RenderSchedule.Script]($common).
* [SectionDrawingLocation]($backend) element identifying the location of a [SectionDrawing]($backend) in the context of a [SpatialModel]($backend).

## Breaking API changes

During the course of routine improvement and stabilization of formerly `alpha` and `beta` APIs, some such APIs have changed. No breaking changes have been made to `public` APIs.

### [@bentley/imodeljs-common](https://www.itwinjs.org/reference/imodeljs-common/)

The following APIs have been replaced:

* [DisplayStyleSettings]($common):
  * `getModelPlanarClipMask`, `overrideModelPlanarClipMask`, and `dropModelPlanarClipMaskOverride`: use the `get`, `set`, and `delete` methods, respectively, of [DisplayStyleSettings.planarClipMasks]($common).
  * `onRealityModelPlanarClipMaskChanged`: use [DisplayStyleSettings.onPlanarClipMaskChanged]($common) for changes to [DisplayStyleSettings.planarClipMasks]($common) and [DisplayStyleSettings.contextRealityModels]($common)'s `onPlanarClipMaskChanged` event for [ContextRealityModel]($common)s.
* `SpatialClassificationProps` namespace: use [SpatialClassifier]($common) instead.

### [@bentley/imodeljs-frontend](https://www.itwinjs.org/reference/imodeljs-frontend/)

* Most properties and methods of [ContextRealityModelState]($frontend) have moved to its new base class, [ContextRealityModel]($common).
* The [SpatialClassifiers]($common) class has moved to imodeljs-common.
* `Viewport.setOSMBuildingDisplay` has been replaced by [DisplayStyleState.setOSMBuildingDisplay]($frontend).
* The following [DisplayStyleState]($frontend) APIs have been replaced:
  * Methods identifying [ContextRealityModel]($common)s by array index have been replaced with APIs that take a [ContextRealityModel]($common) object. If your existing code has an array index, you can use it to index into the arrays exposed by [DisplayStyleState.contextRealityModelStates]($frontend) and the `models` property of [DisplayStyleSettings.contextRealityModels]($common).
  * `getModelAppearanceOverride`, `overrideModelAppearance`, `dropModelAppearanceOverride`: use the `get`, `set`, and `delete` methods of [DisplayStyleSettings.modelAppearanceOverrides]($common).
  * `getRealityModelAppearanceOverride`, `overrideRealityModelAppearance`, `dropRealityModelAppearanceOverride`: use [ContextRealityModel.appearanceOverrides]($common).
  * `modelAppearanceOverrides`: use [DisplayStyleSettings.modelAppearanceOverrides]($common).
  * `getRealityModelPlanarClipMask`, `overrideRealityModelPlanarClipMask`, `dropRealityModelPlanarClipMask`: use [ContextRealityModel.planarClipMaskSettings]($common).

