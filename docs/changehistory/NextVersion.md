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

## Presentation

### Associating content items with given input

Sometimes there's a need to associate content items with given input. For example, when requesting child elements' content based on given parent keys, we may want to know which child element content item is related to which
given parent key. That information has been made available through [Item.inputKeys]($presentation-common) attribute. Because getting this information may be somewhat expensive and is needed only occasionally, it's only set
when content is requested with [ContentFlags.IncludeInputKeys]($presentation-common) flag.

## External textures

The external textures feature is now enabled by default.

Previously, by default the images for textured materials would be embedded in the tile contents. This increased the size of the tile, consumed bandwidth, and imposed other penalties. The external textures feature, however, requires only the Id of the texture element to be included in the tile; the image can then be requested separately. Texture images are cached, so the image need only be requested once no matter how many tiles reference it.

Additionally, if a dimension of the external texture exceeds the client's maximum supported texture size, the image will be downsampled to adhere to that limit before being transmitted to the client.

To disable external textures, pass a `TileAdmin` to [IModelApp.startup]($frontend) with the feature disabled as follows:

```ts
  const tileAdminProps: TileAdmin.Props = { enableExternalTextures: false };
  const tileAdmin = TileAdmin.create(tileAdminProps);
  IModelApp.startup({ tileAdmin });
```

Disabling this feature will incur a performance penalty. The option to disable this feature will likely be removed in the future.
### Custom category nesting
A new `requiredSchemas` attribute was added to [Ruleset]($presentation-common), [Rule]($presentation-common) and [SubCondition]($presentation-common) definitions. The attribute allows specifying ECSchema requirements for rules and avoid using them when requirements are not met. See the [schema requirements page](../learning/presentation/SchemaRequirements.md) for more details.
The following APIs have been promoted to `public`. Public APIs are guaranteed to remain stable for the duration of the current major version of a package.
### [@bentley/webgl-compatibility](https://www.itwinjs.org/reference/webgl-compatibility/)
* [ReadonlySortedArray.findEquivalent]($bentleyjs-core) and [ReadonlySortedArray.indexOfEquivalent]($bentleyjs-core) for locating an element based on a custom criterion.

### [@bentley/imodeljs-common](https://www.itwinjs.org/reference/imodeljs-common/)

* [RenderSchedule]($common) for defining scripts to visualize changes in an iModel over time.
* [queryRenderCompatibility]($webgl-compatibility) for querying the client system's compatibility with the iTwin.js rendering system.
* [WebGLRenderCompatibilityInfo]($webgl-compatibility) for summarizing the client system's compatibility.
* [WebGLFeature]($webgl-compatibility) for enumerating the required and optionals features used by the iTwin.js rendering system.

### [@bentley/imodeljs-frontend](https://www.itwinjs.org/reference/imodeljs-frontend/)

* [LookAndMoveTool]($frontend) for using videogame-like mouse and keyboard controls to navigate a 3d view.
* [WebGLRenderCompatibilityStatus]($webgl-compatibility) for describing a general compatiblity rating of a client system.
* [GraphicsDriverBugs]($webgl-compatibility) for describing any known graphics driver bugs for which iTwin.js will apply workarounds.
* [ContextCreator]($webgl-compatibility) for describing a function that creates and returns a WebGLContext for [queryRenderCompatibility]($webgl-compatibility).
* [Viewport.antialiasSamples]($frontend) and [ViewManager.setAntialiasingAllViews]($frontend) for applying [antialiasing](https://en.wikipedia.org/wiki/Multisample_anti-aliasing) to make viewport images appear smoother.
### @bentley/imodeljs-backend package
* [TxnManager]($backend) for managing local changes to a [BriefcaseDb]($backend).
The arguments for the @beta protected static methods called during modifications have been changed to be more consistent and extensible:
* [IModelDb.generateElementGraphics]($backend) for generating [RenderGraphic]($frontend)s from [GeometricElement]($backend)s or arbitrary geometry streams.
* [IModelDb.getGeometryContainment]($backend) for computing the containment of a set of [GeometricElement]($backend)s within a [ClipVector]($geometry-core).
* [Element]($backend) `[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]`
* [Model]($backend) `[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]`
* [ElementAspect]($backend) `[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]`
In addition, new protected static methods were added:
* [Element]($backend) `[onChildInsert, onChildInserted, onChildUpdate, onChildUpdated, onChildDelete, onChildDeleted, onChildAdd, onChildAdded, onChildDrop, onChildDropped]`
