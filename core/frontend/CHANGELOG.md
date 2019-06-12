# Change Log - @bentley/imodeljs-frontend

This log was last generated on Mon, 03 Jun 2019 18:09:39 GMT and should not be manually modified.

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- RPC system now accepts only basic values (primitives, "interface" objects, and binary).
- Updated release tags. 
- added Viewport.changeViewedModel2d
- Clip shape tool should only set AccuDraw rotation on 1st point.
- #123874 Fix a prompt. #123731 Clip from element change to ignore selection set containing clip transient.
- Combine planar classifier textures to converve texture units
- Removed MaybeRenderApp and WebGLTestContext from tests
- Remove unnecessary comment and initialization checks from tests
- Fix bug sending sync ToolSettings message to UI when tool did not want ToolSettings.
- Support emphasize of isolated elements. Allow default appearance independent of emphasize.
- Dont enforce front/back ratio when displaying map as it does not require z-Buffer.
- Export the classes from WebMercatorTileTree
- Fix contentRange when GLTF contains RTC
- Fix assertion when computing range of instanced meshes.
- Fix loader so that it doesn't attempt to load .css files that don't exist.
- Fix background map tile when child not found.
- Allow ^ to be used to define angle degrees.
- Downgraded certain NotificationManager methods to @beta to question styling support
- Fix erroneous clipping of instanced geometry.
- constructors for BeButtonEvent classes now take props argument
- Remove back face culling option due to lack of performance benefit and other observations
- Increase precision of clipping by transforming clip planes off the GPU.
- Change ModifyElementSource to internal.
- Added onActiveClipChanged event to ViewClipDecorationProvider instead of having to implement ViewClipEventHandler. Support for named clips using SettingsAdmin (needs integration tests).
- Saved clip integration tests. Change view rotate wheel to only zoom about target center when displayed.
- Support multipass rendering for planar classification for computers that down support multi-target framebuffers
- Refactored and simplified implementation of IModelDb.open
- 83505
- Reduce display performance degradation when non-convex clip shapes are applied to a view.
- Added Overflow button support
- PropertyRecord can now optionally have `extendedData` which is a map of `any`
- Add support for synchronous quantity parsing and showing and hiding InputFieldMessages.
- Set max tiles to skip to 1 for reality model tiles. (better user experience)
- Set release tags for TiledGraphicsProvider classes
- Reload tile tree if animation id changes
- Removed use of OidcClientWrapper. 
- Add cSpell comment.
- Rename terrain to backgroundMap.
- Add IModelApp.queryRenderCompatibility() API to allow querying of any rendering limitations of a client system.
- Retire some tile-related feature gates.
- Add ability to save/restore toolsetting properties during a session.
- Change to using the new SharedSettings API.
- Added test for shareClip.
- Add slope biasing to solar shadow mapping.
- Reduce horizon limit so that shadows appear earlier and later.
- Reduced delay between opening a viewport and seeing any graphics.
- Don't await tentative as it can prevent being able to double click to fit.
- Change to the way the background map is specified, to allow overlays.
- Introduced tile format v4.0
- Tool writers only need AccuDrawHintBuilder, AccuDraw should be internal.
- use HTMLElements for tooltips
- Improve touch cursor visibility. Fix tap on canvas decoration when touch cursor is active.
- loader finds and loads css files in production mode.

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Support spatial classification of context reality models.
- API methods for adding and removing context reality models
- Account for view clip in adjustZPlanes. Fit view needs to check clipVolume ViewFlag.
- Increase ambient light to .2
- Adds parameter for api-extractor to validate missing release tags
- Eliminate display performance issue caused by normal matrix computation.
- remove requirement that JavaScript classnames match BIS classnames
- Reduce the number of geocoordination requests produced when loading map tiles.
- Save ClipVector on ViewState instead of always creating new one from json.
- Set initial GL state to match default
- Dispose of planar classifiers.
- Add spatial classifier UX 
- Hide clip decoration during modify. Easier right-click/touch tap support for non-handle pickable decoration.
- Add orientation option button to toolsettings for ClipByPlane/ClipByShape tools.
- ConvexClipPlaneSet modify handles. Make EmphasizeElements internal.
- ClipShape modify handles.
- Fix clip to element tool. wip: Compute clp plane offset in world to support tool settings to enter distance.
- #114939 Fix handle drag test. Support smart lock wth clip shape tool. Offset all clip planes w/shift.
- View clip fixes and start of tools.
- Fit view support for planes clip primitive. View clipping tools.
- Fix tolerance multiplier for reality models
- Cull geometry outside view clipping volume before drawing.
- Fix root tile range on webmercator tile tree for ground bias.
- Added support for disabling certain capabilities for performance testing
- Adding support for readPixels performance testing
- Prevent tooltip from blocking tool event loop.
- add test coverage in frontend
- Debug json clip plane usage.
- ClipVector and ClipUtilities test and enhancements
- Add backface culling feature to improve performance.
- Continue showing old skybox until new is ready
- Add method to return available reality models excluding attached.
- Allow a view to define a set of elements which should never be drawn in that view.
- Allow selected viewport to be changed when filterViewport rejects view.
- Support instanced geometry.
- Support clipping view volume with multiple convex clipPlane sets.
- Fix rare failure to refine tiles displayed in view resulting in missing geometry.
- Fix display of animated edges.
- fixes for release tags
- When loading a perspective view, fix up potentially bad camera settings.
- Reduce mininum front clip (Defect 103868).
- Ensure webgl resources allocated by clip volumes are properly released.
- Fix broken links
- LoggerCategory -> FrontendLoggerCategory
- Fix IModelJsLoader to load imodeljs-markup only when needed
- Export solar calculations for UI
- Fix scenario in which lower-resolution tiles would be inappropriately substituted for tiles of appropriate resolution.
- Fix multipass depth issue
- Fixed visual artifacts when drawing large batches of polylines.
- Handle non-rds tile tree URLS when signed in.
- Fix issue in which tiles of incorrect LOD would be drawn.
- Fix issue with undo/redo view not having render materials
- Fixes to web mercator. 
- Interfaces used by PropertyRecord are set to either beta or alpha as modules that use them to implement UI are not finalized.
- eliminate depedency on JavaScript class names for EnityState subclasses
- Add support for appending GeoJson to existing IModel
- Use default background map type if an invalid type is specified in JSON.
- Ensure queries for large numbers of subcategories are paged appropriately.
- Improve graphics performance in Firefox.
- Only use instancing optimization if the system supports instancing.
- update Sprite after it is loaded
- Introduce LoggerCategory enum to advertise logger categories used by this package.
- Logging fixes. 
- Put sourcemap in npm package.
- documentation cleanup
- add SVG to ImageSourceFormat
- add imodeljs-markup
- added vpDiv between parent and canvas
- Allow a view's extent limits to be overridden.
- #108055 Update measure distance tooltip on click. Improve total distance visibility.
- Add alpha tags to PropertyEditorParams interfaces that are not ready for public use.
- Improved performance of multipass rendering
- #96348 Improve default rotate point for navigation cube
- Fixes to OidcBrowserClient. 
- Optimize frontend renderer's performance by minimizing allocations of float arrays passed to the GPU.
- Add more discrete, efficient Viewport synchronization events.
- Added the ability to override category visibility on a per-model basis.
- Rework projection of planar classifiers
- Refactor classification  rename to SpatialClassification
- Remove "assembly lock" from SelectTool now that SelectionScope has been implemented.
- remove IModelApp subclasses
- Remove IModelConnection.openStandalone and IModelConnection.closeStandalone
- Setup a generic context for tracking client requests, and made various related enhancements to logging, usage tracking and authorization. 
- Allow tile content to be requested without edge data, reducing tile size and download time.
- Support image textures larger than WebGL capabilities by resizing them.
- Update icons-generic-webfont version to latest available.
- Update the ToolSettings properties defined in the Select Tool so two groups of options are presented, one for selection method and one for selection mode.
- Simplify SelectTool SelectionMethod and SelectionMode.
- Remove need to sync SelectionMethod since it is not changed within tool code.
- Add IModelConnection.openSnapshot/closeSnapshot, deprecate IModelConnection.openStandalone/closeStandalone
- Refactor solar shadow settings - make these 3d only.
- Support solar shadow display.
- Make sky sphere / sky gradient use separate rendering primitive from sky cube.
- don't draw Sprite before it is loaded
- Unit tests and fixed ColorEditor alignment
- Fix errors on Linux caused by case-sensitivity and shader optimizations.
- Upgrade TypeDoc dependency to 0.14.2
- Update the primitive types to be within a Primitives namespace.
- allow IModelApp subclass to override applicationId & applicationVersion
- revert static inheritance in IModelApp.ts
- wrap applicationId & applicationVersion in IModelApp
- Changes to build process to put all JavaScript files in version-specific subdirectories to avoid browser caching problems when deploying new versions.
- view undo only saves changes to ViewState, not categories, models, or diplayStyle
- Clip tool changes now that undo/redo does not affect clipping. Right-click menu support for clip handles.
- only save viewing volume for view undo rather than cloning ViewState
- Tools to create and modify view clip.
- VSTS#114189 Reality data shown as Model and picker
- World decorations ignore symbology overrides defined for the view.

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Add ColorEditor to list of available Type Editors including new ColorParams to specify set of colors.
- #73219 FitViewTool enhancement to fit to isolated elements or clip volume.
- Supply additional statistics for monitoring tile requests.
- Resolve transparency rendering error in multi-pass compositor due to way textures are bound.
- Cleaned up documentation related to the display system.
- use bubble-up for keyboard events
- Plugin Enhancements
- Documentation for Skybox
- Added vertex handles for line/arrow markup.

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- add ios oidc client
- geometry-core camel case
- Add Selection Scope toolsettings to SelectTool.
- allow subclasses of Range to use static methods
- Raise events when a Viewport's always- or never-drawn element sets change.
- OIDC changes needed for Angular client
- Changes package.json to include api-extractor and adds api-extractor.json
- #66826 Default SelectTool to select all members of the selected element's assembly.
- Default scope to element.
- Use new buildIModelJsBuild script
- Generalize support for reading tiles to include tiles generated for Bimium.
- AxisAlignedBox and ElementAlignedBox are now typed to Range3d rather than classes
- clone methods are no longer generic
- Optimize renderer to elide debug-only code paths unless explicitly enabled.
- Generalize 3d tile support.   Handle transform on child nodes.
- Avoid using cutting planes while animating if not displayed, completely hidden or completely visible.
- Started work on webworker to decode jpeg files for GLTF
- Defer Draco support until moved to web worker
- Reduce memory consumption when ambient occlusion is disabled.
- Fix incorrect colors for some decoration graphics.
- Remove unneeded typedoc plugin dependency
- Add support for Draco compressed meshes
- Change drag select to exclude non locatable
- noMotion doesn't need to call beginDynamicUpdate
- example code (in comments) for frustum interpolator
- Consistent naming of "get" methods in Growable arrays.
- Add EmphasizeElements to/from wire format methods
- Draw non-emphasized elements in "fade-out", non-locatable mode.
- Move neverDrawn/alwaysDrawn to Viewport they are not part of the persistent ViewState. Change Viewport.addFeatureOverrides to an interface.
- Rework and simplify ecef transform for reality models.
- Correct ID for loading classifier trees.
- Fix clipping volume being inconsistently applied to view.
- Dont make textures transparent unless technique enables it.
- Fix incorrect "fit view" behavior when empty tiles exist.
- Handle relative subpaths in reality model tile trees.  Handle Y for axis/ 
- Fix handling of null animation visibility - should be 100% not 0.
- Added spatial <-> cartographic methods that check/use the geographic coordinate system before using ecef location.
- DefaultViewTouchTool should not call handleEvent until it's installed as the active ViewTool.
- Traverse GLTF node structure rather than meshes so that node transforms are used correctly.
- Ensure viewport updates immediately when background map settings are changed.
- Add a test to determine if GCS is present before using GCS converter.
- Documentation improvements
- Support instanced rendering of .i3dm 3D tiles.
- Preliminary support for drawing instanced geometry.
- Fix branch transform for animation correctly - back out incorrect fix to BranchState.
- Implemented, then commented out, doing jpeg decompression in a web worker
- added markup mode
- events are now on ScreenViewport.parentDiv rather than canvas
- update for geometry GrowableXYArray usage.
- Measure Distance - change selected segment hilite. Measure Location - WIP use ecef transform.
- More ui-framework unit tests
- Make it possible to define editor params for default Type Editors not explicitly specified by name.
- Fixed a bug which caused non-locatable geometry to be rendered when no other symbology was overridden.
- Defer loading of edges until needed
- Omit animation branches that are not visible.
- Improve efficiency and completeness of SubCategory loading for ViewStates.
- Save BUILD_SEMVER to globally accessible map. PluginAdmin and Plugin classes defined. IModelJsLoader improved.
- add optional iModel argument to EntityState.clone 
- added GeometricModelState.queryModelRange
- Added creatorId, new method to list RD per project, identified numerous area for changes WIP
- IModelConnection.close() always disposes the briefcase held at the backend in the case of ReadWrite connections. 
- Implemented spatial criterai when searching through all reality data associated to a project.
- Problem with root document of reality data not in root of blob. Tiles could not be fetched. Root path is added to tiles names.
- Threading issue accessing Reality Data, RealityData class was transformed to be the main data access object instead of the client that was used by most/all reality data causing cache data clash and mix between many reality data.
- Optimze containment test with spheres.
- Move the IModelUnitTestRpcInterface into the testbed and out of the public AP
- Retry tile requests on time-out.
- Remove loadNativeAsset and formatElements RPC calls from the IModelReadRpcInterface
- Removed IModelConnection.connectionId, added IModelApp.sessionId
- make view transition animations smoother
- Optimizations to tile format and schedule animation.
- Tile requests can optionally specify a retryInterval.
-  Cleanup of DefaultToolSetting provider and EnumButtonGroup editor including new EditorParams.
- Move property definitions to imodeljs-frontend so they could be used by tools to define properties for tool settings. Add toolsettings to Select Tool.
- Added a new property to PropertyRecord - links.
- IModelConnection.connectionTimeout is public to allow application customization.
- upgrade to TypeScript 3.2.2

## 0.188.0
Wed, 16 Jan 2019 16:36:09 GMT

### Updates

- Report unsigned measure distance deltas.
- Add batch id to schedule scripts
- Add batchID to schedule scripts
- Handle wider variety of GLTF bounding boxes etc.

## 0.187.0
Tue, 15 Jan 2019 15:18:59 GMT

*Version update only*

## 0.186.0
Mon, 14 Jan 2019 23:09:10 GMT

### Updates

- Fix visible seams between map tiles.

## 0.185.0
Fri, 11 Jan 2019 18:29:00 GMT

### Updates

- Optimize performance of schedule animation.
- Use QuantityType.Coordinate for measure distance start/end points.
- Add QuantityTypes LatLong and Coordinate.

## 0.184.0
Thu, 10 Jan 2019 22:46:17 GMT

### Updates

- Add support for general 3d tilesets
- Fix drag select decorator when cursor moves out of view. Doc fixes.
- Support region bounding volumes
- Fix IModelJsLoader to ensure react loaded before bwc.
- MeasureLocationTool show lat/long and altitude.
- Make raster text locate behave better.
- Removed default OIDC scopes. All applications must now explicitly pass the required scopes. 
- Can now await result from QuantityFormatter. Report delta relative to ACS when context lock enabled. Cleanup "Measure.Points" plug-in example until real measure tools are available.
- Quantity formatter now allows async method to get FormatterSpec that can be used to format quantities.
- QuantityFormatter.formatQuantity is now the only method to format quantities.
- Rename formatQuantityWithSpec to formatQuantity
- Added ToolAdmin method for undo/undo last data button and call from Ctrl+Z.

## 0.183.0
Mon, 07 Jan 2019 21:49:21 GMT

### Updates

- Add ambient occlusion to the display frontend system.
- Account for global origin when reporting coordinates.
- Add measure distance tool, will be moved to plug-in later.
- Fixed unnecessary reload during OIDC redirect callback.

## 0.182.0
Mon, 07 Jan 2019 13:31:34 GMT

### Updates

- When the iModel covers a large enough area, get the corners of background map tiles using Geographic reprojection

## 0.181.0
Fri, 04 Jan 2019 13:02:40 GMT

### Updates

- Fix incorrect display of point strings containing duplicate points.
- Optimize performance when reading depth buffer.

## 0.180.0
Wed, 02 Jan 2019 15:18:23 GMT

### Updates

- Allow the maximum number of active tile requests to be modified at run-time.
- Fix excessive memory consumption by polyline graphics.
- merge
- Enable path interpolation
- Enable schedule animation
- if view delta is too large or small, set it to max/min rather than aborting viewing operations.
- Fix transform order when pushing branch.
- Implement quaternion interpolation for Synchro schedule animation
- remove trash files
- Add batch feature overrides to optimize schedule animation.
- Prioritize tile requests based on tile type and depth.
- Improve performance by limiting the number of simultaneously-active tile requests.

## 0.179.0
Wed, 19 Dec 2018 18:26:14 GMT

### Updates

- Added showDialogInitially support to ActivityMessageDetails
- View tools enhancement to use background map plane for depth point when geometry isn't identified.
- Fix regression in the display of reality models induced by switch to OIDC for access token.
- Support Pre animation tiles
- Add support for Syncro schedules (transform disabled)

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

### Updates

- Fix view becoming black in some circumstnces when locate cursor exits viewport.
- Only make createGraphicBuilder available to DecorationContext. DynamicsContext/SceneContext require a scene graphic.
- Added StringGetter support to ItemDefBase, ItemProps & ToolButton. Added IModelApp.i18n checks to Tool for unit tests.
- Fix failure to locate elements if their transparency is overridden.
- Added tool prompts. Fix dynamics changing locate circle. Hide touch cursor on mouse motion.

## 0.177.0
Wed, 12 Dec 2018 17:21:31 GMT

### Updates

- Added TwoWayViewportSync class to connect two Viewports so that changes to one are reflected in the other.
- Renamed ViewStateData to ViewStateProps and ViewState.createFromStateData to ViewState.createFromProps.
- turn off locate circle when mouse leaves a view

## 0.176.0
Mon, 10 Dec 2018 21:19:45 GMT

### Updates

- Move cursors and sprites to separate directories
- Fix bug in which the frustum of a spatial view was always expanded to include the ground plane even if the ground plane was not displayed.
- Ignore 2d models in model selectors.
- Add tracking of active + pending tile requests.

## 0.175.0
Mon, 10 Dec 2018 17:08:55 GMT

### Updates

- route map tiles over https

## 0.174.0
Mon, 10 Dec 2018 13:24:09 GMT

### Updates

- Touch tap with AccuSnap enabled now brings up a decoration planchette to help choose the snap point.

## 0.173.0
Thu, 06 Dec 2018 22:03:29 GMT

### Updates

- map api cors fix
- Fix failure to display Bing maps logo.
- Fix "maximum window" error when viewing large drawings.
- enable tslint rules for asyncs
- T
- Custom imodelJs noDirectImport lint rule implemented, noDuplicateImport lint rule turned on.

## 0.172.0
Tue, 04 Dec 2018 17:24:39 GMT

### Updates

- Changed index file name to match package name. Change imports to use other packages' index file.

## 0.171.0
Mon, 03 Dec 2018 18:52:58 GMT

### Updates

- WIP: add support for schedule animation (symbology).
- geometry coverage
- geometry coverage
- Fix incorrect length used to create Uint32Array from Uint8Array.
- Fix incorrect display of raster text.
- Fix bug in which the frustum of a spatial view was always expanded to include the ground plane even if the ground plane was not displayed.
- Fix exception when attempting to create a SubCategoryAppearance from an empty string.
- Locate circle should be initialized to off.
- Enable locate and hilite for point clouds.
- Rename SimpleViewTest to display-test-app
- SnapStatus and LocateFailure cleanup
- Front end "read pixels" can now provide subCategoryId and GeometryClass to backend.
- Check SubCategoryAppearance dontLocate and dontSnap now that HitDetail has subCategoryId.

## 0.170.0
Mon, 26 Nov 2018 19:38:42 GMT

### Updates

- Fix missing uniform error in Edge browser.
- Optimize 'pick buffer' portion of renderer.

## 0.169.0
Tue, 20 Nov 2018 16:17:15 GMT

*Version update only*

## 0.168.0
Sat, 17 Nov 2018 14:20:11 GMT

*Version update only*

## 0.167.0
Fri, 16 Nov 2018 21:45:44 GMT

### Updates

- Add support for finding reality models that overlap project extent.
- Refactor ContextRealityModelState
- Numerous shader program optimizations.

## 0.166.0
Mon, 12 Nov 2018 16:42:10 GMT

### Updates

- Hydrated briefcases for ReadOnly cases from the latest checkpoint, rather than the seed files. This significantly improves performance of IModelDb/IModelConnection.open() for typical cases. 

## 0.165.0
Mon, 12 Nov 2018 15:47:00 GMT

### Updates

- Fix SelectionSet broadcasting excessive selection change events
- Add support for Context Reality Models

## 0.164.0
Thu, 08 Nov 2018 17:59:20 GMT

### Updates

- AccuDraw/AccuSnap markdown/examples
- Fix edge animation of PolyfaceAuxData
- Updated frontend performance testing
- Change filterHit on InteractiveTool to async to support backend queries
- Fix JSON representation of DisplayStyleState.
- Fix links in tool docs
- Added an option to Viewport.readImage() to flip the resultant image vertically.
- PrimitiveTool isValidLocation shouldn't require write, want check for measure tools too
- Add Comments
- Updated to TypeScript 3.1

## 0.163.0
Wed, 31 Oct 2018 20:55:37 GMT

### Updates

- Get snap sprites and view cursors from a url
- Move filterHit from PrimitveTool to InteractiveTool. PrimitiveTool docs.
- Support conversion of ImageBuffer to PNG.
- PrimitiveTool cursor fixes and wip markdown
- Hide WIP ChangeCache methods on IModelConnection

## 0.162.0
Wed, 24 Oct 2018 19:20:06 GMT

### Updates

- Added view decoration examples to docs.
- Make ToolAdmin.defaultTool. public. Allow getToolTip to return HTMLElement | string.
- Fix clipping planes with large floating point values for iOS.
- Breaking changes to optimize usage of 64-bit IDs.
- Avoid small allocations within render loop.
- Added NotificationManager.isToolTipSupported so that we can avoid asking for tooltip message when _showToolTip isn't implemented by application.

## 0.161.0
Fri, 19 Oct 2018 13:04:14 GMT

*Version update only*

## 0.160.0
Wed, 17 Oct 2018 18:18:38 GMT

*Version update only*

## 0.159.0
Tue, 16 Oct 2018 14:09:09 GMT

*Version update only*

## 0.158.0
Mon, 15 Oct 2018 19:36:09 GMT

*Version update only*

## 0.157.0
Sun, 14 Oct 2018 17:20:06 GMT

### Updates

- Fixing scripts for linux

## 0.156.0
Fri, 12 Oct 2018 23:00:10 GMT

### Updates

- Initial release

