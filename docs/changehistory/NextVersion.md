---
publish: false
---
# NextVersion

## Promoted APIs

The following previously `alpha` or `beta` APIs have been promoted to `public`. Public APIs are guaranteed to remain stable for the duration of the current major version of the package.

### [@bentley/bentleyjs-core](https://www.itwinjs.org/reference/bentleyjs-core/)

* [ReadonlySortedArray.findEquivalent]($bentleyjs-core) and [ReadonlySortedArray.indexOfEquivalent]($bentleyjs-core) for locating an element based on a custom criterion.

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
