# Change Log - @itwin/core-frontend

This log was last generated on Wed, 06 Nov 2024 19:24:30 GMT and should not be manually modified.

## 4.9.7
Wed, 06 Nov 2024 19:23:04 GMT

_Version update only_

## 4.9.6
Tue, 05 Nov 2024 15:22:45 GMT

_Version update only_

## 4.9.5
Tue, 22 Oct 2024 20:01:40 GMT

_Version update only_

## 4.9.4
Wed, 09 Oct 2024 20:22:04 GMT

### Updates

- Fix WorkerReturnType for async implementations.

## 4.9.3
Thu, 03 Oct 2024 19:15:45 GMT

_Version update only_

## 4.9.2
Wed, 02 Oct 2024 15:14:43 GMT

_Version update only_

## 4.9.1
Wed, 25 Sep 2024 20:10:58 GMT

_Version update only_

## 4.9.0
Mon, 23 Sep 2024 13:44:01 GMT

### Updates

- Fix range problem for elements during edit which sometimes made the dissappear.
- Permit TiledGraphicsProviders to contribute to planar clip masks.
- Fix incorrect bounding box for RenderGraphic created from GraphicDescription.
- Change MapLayerImageryProvider.supportsMapFeatureInfo from alpha to public

## 4.8.7
Fri, 13 Sep 2024 15:11:17 GMT

_Version update only_

## 4.8.6
Fri, 06 Sep 2024 05:06:49 GMT

_Version update only_

## 4.8.5
Wed, 28 Aug 2024 17:27:23 GMT

_Version update only_

## 4.8.4
Thu, 22 Aug 2024 17:37:06 GMT

_Version update only_

## 4.8.3
Fri, 16 Aug 2024 18:18:14 GMT

_Version update only_

## 4.8.2
Thu, 15 Aug 2024 15:33:49 GMT

_Version update only_

## 4.8.1
Mon, 12 Aug 2024 14:05:54 GMT

_Version update only_

## 4.8.0
Thu, 08 Aug 2024 16:15:37 GMT

### Updates

- Fixed planar masks when using new tiles
- Improve resolution of planar clip masks
- Fixed new tiles not updating planar clip mask immediately.
- Fixed performance problem for planar clip masks
- Fix missing login dialog for some ArcGIS services
- Fix error reading ArcGIS Map service capabilities when Kerberos authentication is used
- fixed material issues with frontend schedule scripts
- Check validity of OCP CRS before using it.
- Trigger additional `onMouseMotion` call for tools to react to the last AccuSnap.
- Allow elements in edit scope to be updated by schedule scripts.
- Add support for gLTF extention EXT_mesh_gpu_instancing, that allows assigning unique identifiers to individual instances of a mesh, which can be used to look up per-instance data in the structural metadata table. This version also contains a fix to support absolute tile URLs in 3D tiles tileset.json
- Load up front all subcategories of used spatial categories and 3D elements when creating a default view.
- Update ThirdPartyNotices.md
- Provide WorkerProxy to simplify use of Worker scripts, and enable creation of graphics on Workers using GraphicDescriptionBuilder.
- Fix Viewport's never-drawn elements overriding the display style's excluded elements.
- Promote ScreenViewport and OffScreenViewport constructors.
- Include the extents of all TiledGraphicsProviders when computing ViewingSpace extents.
- Add support for creating textures and materials in a Worker.

## 4.7.8
Wed, 31 Jul 2024 13:38:04 GMT

_Version update only_

## 4.7.7
Fri, 19 Jul 2024 14:52:42 GMT

### Updates

- Fix Viewport's never-drawn elements overriding the display style's excluded elements.

## 4.7.6
Fri, 12 Jul 2024 14:42:55 GMT

### Updates

- Fix missing login dialog for some ArcGIS services

## 4.7.5
Thu, 11 Jul 2024 15:24:55 GMT

### Updates

- Improve resolution of planar clip masks

## 4.7.4
Mon, 01 Jul 2024 14:06:23 GMT

_Version update only_

## 4.7.3
Thu, 27 Jun 2024 21:09:02 GMT

### Updates

- Fixed new tiles not updating planar clip mask immediately.

## 4.7.2
Sat, 22 Jun 2024 01:09:54 GMT

### Updates

- Fixed planar masks when using new tiles
- Include the extents of all TiledGraphicsProviders when computing ViewingSpace extents.

## 4.7.1
Thu, 13 Jun 2024 22:47:31 GMT

_Version update only_

## 4.7.0
Wed, 12 Jun 2024 18:02:16 GMT

### Updates

- Fixed various issues related to terrain tile collecting.
- Fix failed HTTP RPC request not being rejected if `X-Protocol-Version` is not available.
- Increase maximum number of categories passed into querySubCategories
- Reduce coupling between project extents and tile cache, so that cached tiles can remain valid after adjusting the project extents by less than an order of magnitude.

## 4.6.2
Sat, 08 Jun 2024 00:50:25 GMT

_Version update only_

## 4.6.1
Wed, 29 May 2024 14:35:17 GMT

_Version update only_

## 4.6.0
Mon, 13 May 2024 20:32:51 GMT

### Updates

- Increase default extent limits for drawing views and fix incorrect clipping of section drawing attachments.
- Fixed problem cases freeing tile memory under memory pressure
- Fix map layer WMTS validation process to correctly return authentication error
- Fixed various issues related to terrain tile collecting.
- Fix an issue preventing model map layer from being hidden
- Added support for OGC Features map layers.
- Include BIS class metadata with transaction events.
- Fix dynamic element graphics being clipped to the project extents in 2d models.
- Add support for EXT_meshopt_compression glTF extension.

## 4.5.2
Tue, 16 Apr 2024 14:46:22 GMT

### Updates

- Fix an issue preventing model map layer from being hidden

## 4.5.1
Wed, 03 Apr 2024 18:26:58 GMT

### Updates

- Fix map layer WMTS validation process to correctly return authentication error

## 4.5.0
Tue, 02 Apr 2024 19:06:00 GMT

### Updates

- Change gpuMemoryLimit setting used when undefined
- Disable tile preloading when under memory pressure
- Add textures to reality mesh stats
- Fix an issue where the background map would become blank after adding a new map-layer
- added ability of batched tiles to generate cut plane graphics
- Fix regression in GPU timings due a  change in chromium's behavior.
- Dispose of all viewports when IModelApp.shutdown() is called to clear up WebGL resources, and avoid memory leak
- make CheckpointConnection.openRemote work for IPC
- Add TileTreeReference.createFromRenderGraphic. Permit TiledGraphicsProvider to supply a tooltip.
- Added an iterator over the entries in a BatchTableProperties.
- Add support for custom data sources in TerrainSettings, including Cesium ION assets.
- Add support for dynamic spatial classifiers.
- Fix incorrect transforms computed for instanced glTF meshes.

## 4.4.9
Mon, 15 Apr 2024 20:29:22 GMT

_Version update only_

## 4.4.8
Mon, 25 Mar 2024 22:22:26 GMT

_Version update only_

## 4.4.7
Fri, 15 Mar 2024 19:15:14 GMT

### Updates

- Disable tile preloading when under memory pressure

## 4.4.6
Fri, 08 Mar 2024 15:57:11 GMT

_Version update only_

## 4.4.5
Tue, 05 Mar 2024 20:37:18 GMT

### Updates

- Added an iterator over the entries in a BatchTableProperties.

## 4.4.4
Fri, 01 Mar 2024 18:21:01 GMT

### Updates

- Change gpuMemoryLimit setting used when undefined
- Dispose of all viewports when IModelApp.shutdown() is called to clear up WebGL resources, and avoid memory leak

## 4.4.3
Fri, 23 Feb 2024 21:26:07 GMT

_Version update only_

## 4.4.2
Fri, 16 Feb 2024 14:22:01 GMT

_Version update only_

## 4.4.1
Fri, 16 Feb 2024 14:17:48 GMT

_Version update only_

## 4.4.0
Mon, 12 Feb 2024 18:15:58 GMT

### Updates

- Add SQ_KM to UNIT_DATA
- Add support to create an EcefLocation class directly from a transformation matrix
- Added support for recoloring geometry intersecting a clip volume
- Bump @itwin/object-storage-core
- Add textures to reality mesh stats
- Promote APIs required to implement a MapLayerFormat to beta
- Fix status code when invalid credentials are provided for an ArcGIS service.
- Fixed an issue preventing tiles published by some specific ArcGIS MapServer to be correctly displayed in the view.
- Fix Map Feature Info for ArcGIS map services when reprojection is needed.
- Enable Kerberos authentication for map-layers
- Custom query parameters can now be configured on map layers objects.
- Expose `ParticleCollectionBuilder` for extensions
- Improved ArcGIS feature info coordinates reprojection outside project extent.
- Improved content type detection for 3D Tiles tilesets.
- Updated realitydata url to new reality-management API url. Added tests for new url.
- Add support for glTF 2.0 EXT_mesh_gpu_instancing and fix incorrectly computed glTF bounding boxes.
- Add support for transparent gradients in thematic display and analysis styles.
- Added Viewport.onSceneInvalidated event raised when Viewport.invalidateScene is called.
- Fix SpatialModelState.isRealityModel returning false for reality models that don't store a tileset URL.
- When assigning to SpatialViewState.modelSelector, notify tile tree references of the change.
- Enable display of all subcategories for non-scene decorations.
- Add RealityTileTree.batchTableProperties for accessing per-feature properties from 3D Tiles 1.0 tilesets.
- Add DisplayStyleState iterator over context reality models.
- Fix incorrect transparency for text rendered as raster glyphs.
- Remove maximum depth constraint for reality tile trees.
- Clone view attachments when cloning a sheet or drawing view.

## 4.3.5
Mon, 25 Mar 2024 16:54:36 GMT

_Version update only_

## 4.3.4
Fri, 22 Mar 2024 13:30:31 GMT

### Updates

- Bump @itwin/object-storage-core

## 4.3.3
Wed, 03 Jan 2024 19:28:38 GMT

### Updates

- Fixed an issue preventing tiles published by some specific ArcGIS MapServer to be correctly displayed in the view.

## 4.3.2
Thu, 14 Dec 2023 20:23:02 GMT

_Version update only_

## 4.3.1
Wed, 13 Dec 2023 17:25:55 GMT

_Version update only_

## 4.3.0
Thu, 07 Dec 2023 17:43:09 GMT

### Updates

- Added support for recoloring geometry intersecting a clip volume
- Add SQ_KM to UNIT_DATA
- Promote APIs required to implement a MapLayerFormat to beta
- Fix status code when invalid credentials are provided for an ArcGIS service.
- Fix Map Feature Info for ArcGIS map services when reprojection is needed.
- Custom query parameters can now be configured on map layers objects.
- Improved ArcGIS feature info coordinates reprojection outside project extent.
- Improved content type detection for 3D Tiles tilesets.
- Updated realitydata url to new reality-management API url. Added tests for new url.
- Add support for transparent gradients in thematic display and analysis styles.
- Fix SpatialModelState.isRealityModel returning false for reality models that don't store a tileset URL.
- When assigning to SpatialViewState.modelSelector, notify tile tree references of the change.
- Enable display of all subcategories for non-scene decorations.
- Fix incorrect transparency for text rendered as raster glyphs.
- Remove maximum depth constraint for reality tile trees.
- Clone view attachments when cloning a sheet or drawing view.

## 4.2.4
Mon, 20 Nov 2023 16:14:45 GMT

### Updates

- Add SQ_KM to UNIT_DATA
- Fix Map Feature Info for ArcGIS map services when reprojection is needed.

## 4.2.3
Mon, 06 Nov 2023 14:01:52 GMT

### Updates

- When assigning to SpatialViewState.modelSelector, notify tile tree references of the change.

## 4.2.2
Thu, 02 Nov 2023 15:36:20 GMT

### Updates

- Fix status code when invalid credentials are provided for an ArcGIS service.
- Remove maximum depth constraint for reality tile trees.
- Clone view attachments when cloning a sheet or drawing view.

## 4.2.1
Tue, 24 Oct 2023 15:09:13 GMT

_Version update only_

## 4.2.0
Tue, 17 Oct 2023 15:14:32 GMT

### Updates

- Add ECSqlExpr api
- Fix failure to preserve name when creating a BlankConnection.
- remove `require` call preventing pure ESM usage
- Added parameter to specify pixel tolerance of Viewport.getMapFeatureInfo
- Fix schedule script symbology issue
- Fixed ignore material not using default material params
- IModelConnection.createQueryReader is now public
- Improved content type detection for 3D Tiles tilesets.
- Add BriefcaseTxns events raised when applying external txns.
- Add an option to premultiply a model display transform
- Allow creation of cross-origin web workers

## 4.1.9
Tue, 10 Oct 2023 18:48:12 GMT

_Version update only_

## 4.1.8
Fri, 06 Oct 2023 04:00:18 GMT

_Version update only_

## 4.1.7
Thu, 28 Sep 2023 21:41:33 GMT

_Version update only_

## 4.1.6
Tue, 12 Sep 2023 15:38:52 GMT

### Updates

- Allow creation of cross-origin web workers

## 4.1.5
Fri, 08 Sep 2023 13:37:23 GMT

_Version update only_

## 4.1.4
Thu, 07 Sep 2023 18:26:02 GMT

_Version update only_

## 4.1.3
Wed, 30 Aug 2023 15:35:27 GMT

_Version update only_

## 4.1.2
Wed, 23 Aug 2023 15:25:29 GMT

_Version update only_

## 4.1.1
Fri, 18 Aug 2023 13:02:53 GMT

_Version update only_

## 4.1.0
Mon, 14 Aug 2023 14:36:34 GMT

### Updates

- Fix decoding of draco-compressed texture coordinates in glTF.
- Take into account the aspectRatioSkew of the view inside the window area tool.
- Fixed world decorations disappearing and asserts
- Fixed black view caused by certain cases of going back down to one viewport.
- Fix background map layers failing to blend with an opaque solid base layer.
- avoid unnecessary preflight requests when loading tiles from cloud cache
- Fix Viewport.isPixelSelectable following signature change of Viewport.mapLayerFromIds
- Added support for UniqueValue renderer in ArcGIS feature format
- Two map-layers instances having different formatId or subLayers set should not share the same tile tree.
- Improved ArcGIS map-layers validation.
- Revisited Viewport.getMapFeatureInfo, it now return graphics along with records.
- Added logging to 'MapLayerImageryProvider.createTileTree' and added missing export in MapLayerSources.
- Upgrade sinon to 15.0.4
- Fix gaps in certain reprojected tiles.
- Promoted TentativeOrAccuSnap to public
- Ensure element Ids are loaded for RenderTimeline element when schedule scripts are applied on the frontend.
- Promote many rendering-related APIs.
- Introduce compact encoding scheme for edges in iMdl tiles.
- Fix assertion when reading glTF containing a normal map.
- Add more efficient methods for converting multiple points to and from an iModel's spatial coordinate system.
- Support decoding point clouds from glTF.
- Split iMdl tile decoding into two phases: parsing and graphics creation.
- Decode iMdl tile content in a web worker.
- Treat non-standard mimeType "image/jpg" as "image/jpeg".
- Support snapping to elements inside of orthogonal view attachments.
- ViewCreator3d fits to the extents of the viewed models. SpatialViewState.computeFitRange accepts an optional minimal fit range.
- add ViewStore apis
- Switch to ESLint new flat config system

## 4.0.7
Thu, 10 Aug 2023 13:19:24 GMT

_Version update only_

## 4.0.6
Mon, 24 Jul 2023 05:07:33 GMT

_Version update only_

## 4.0.5
Tue, 18 Jul 2023 12:21:56 GMT

_Version update only_

## 4.0.4
Wed, 12 Jul 2023 15:50:01 GMT

_Version update only_

## 4.0.3
Mon, 03 Jul 2023 15:28:41 GMT

_Version update only_

## 4.0.2
Wed, 21 Jun 2023 22:04:43 GMT

_Version update only_

## 4.0.1
Wed, 21 Jun 2023 20:29:13 GMT

### Updates

- Two map-layers instances having different formatId or subLayers set should not share the same tile tree.
- Fix gaps in certain reprojected tiles.
- Ensure element Ids are loaded for RenderTimeline element when schedule scripts are applied on the frontend.

## 4.0.0
Mon, 22 May 2023 15:34:14 GMT

### Updates

- implemented constant lod texture mapping for tiles
- Deprecate IModelConnection's query, queryRowCount, and restartQuery methods.
- Deprecated IModelAppOptions.rpcInterfaces in favor of using platform-specific RPC manager.
- Fixed inconsistent point sizes for additive point cloud tiles.
- added return of rtcCenter to readPointCloudTileContent
- Promote and document some map layers functions.
- Update to eslint@8
- Patch how dynamic import for packages are resolved in Vite based apps so tiles render"
- Remove dependency on `lodash`
- Map-layers should not be displayed past maximum LOD limit advertised by service metadata
- Improved tiling tests
- Move webgl-compatibility package out of peer to direct deps in core-frontend
- Refactoring of internal request api, removed 'superagent', 'deep-assign' and 'qs' dependencies.
- add IModelApp.hubAccess to public api
- ViewState3d.lookAt with ortho paramters should not use camera focusDist
- Implemented constant lod texture mapping mode.
- Fixed clipping problem with decorators.
- Drop support for WebGL 1.
- Promote terrain-related APIs to public.
- Add readGltf which returns bounding boxes along with the graphic.
- When reading glTF, use a default material if none is specified, per the glTF spec.
- Promote APIs for converting between geographic and iModel coordinates.
- Promote HiliteSet constructor and NoRenderApp to public.
- Record statistics about tile content decoding times to TileRequestChannelStatistics.
- Add an option for ViewCreator3d to make all subcategories visible.
- add physics-based Atmospheric scattering shader
- Localize tooltips for view clip decorations.

## 3.8.0
Fri, 08 Dec 2023 15:23:59 GMT

_Version update only_

## 3.7.17
Mon, 20 Nov 2023 18:24:23 GMT

_Version update only_

## 3.7.16
Mon, 16 Oct 2023 12:49:07 GMT

_Version update only_

## 3.7.15
Tue, 10 Oct 2023 19:58:35 GMT

_Version update only_

## 3.7.14
Fri, 29 Sep 2023 16:57:16 GMT

_Version update only_

## 3.7.13
Tue, 08 Aug 2023 19:49:18 GMT

_Version update only_

## 3.7.12
Thu, 27 Jul 2023 21:50:57 GMT

### Updates

- Fix decoding of draco-compressed texture coordinates in glTF.
- Fix a failure to read some glTF data with extra padding bytes.

## 3.7.11
Tue, 11 Jul 2023 17:17:21 GMT

### Updates

- Fix gaps in certain reprojected tiles.

## 3.7.10
Wed, 05 Jul 2023 13:41:21 GMT

_Version update only_

## 3.7.9
Tue, 20 Jun 2023 12:51:02 GMT

_Version update only_

## 3.7.8
Thu, 01 Jun 2023 17:00:39 GMT

_Version update only_

## 3.7.7
Wed, 24 May 2023 17:27:09 GMT

_Version update only_

## 3.7.6
Mon, 15 May 2023 18:23:40 GMT

_Version update only_

## 3.7.5
Thu, 04 May 2023 19:43:18 GMT

_Version update only_

## 3.7.4
Tue, 25 Apr 2023 17:50:35 GMT

_Version update only_

## 3.7.3
Thu, 20 Apr 2023 13:19:29 GMT

### Updates

- Fixed inconsistent point sizes for additive point cloud tiles.
- added return of rtcCenter to readPointCloudTileContent

## 3.7.2
Wed, 12 Apr 2023 13:12:42 GMT

_Version update only_

## 3.7.1
Mon, 03 Apr 2023 15:15:37 GMT

### Updates

- Add an option for ViewCreator3d to make all subcategories visible.

## 3.7.0
Wed, 29 Mar 2023 15:02:27 GMT

### Updates

- Deprecate IModelConnection's query, queryRowCount, and restartQuery methods.
- Deprecated IModelAppOptions.rpcInterfaces in favor of using platform-specific RPC manager.
- Fixed clipping problem with decorators.
- Localize tooltips for view clip decorations.

## 3.6.3
Mon, 27 Mar 2023 16:26:47 GMT

_Version update only_

## 3.6.2
Fri, 17 Mar 2023 17:52:32 GMT

_Version update only_

## 3.6.1
Fri, 24 Feb 2023 22:00:48 GMT

_Version update only_

## 3.6.0
Wed, 08 Feb 2023 14:58:40 GMT

### Updates

- Allow map-layer requiring authentication to be correctly initialized after a saved view restore.
- Map-layers oauth2 requests optimization and improvements
- Added new viewport event (onMapLayerScaleRangeVisibilityChanged); this event is fired, whenever the visibility of a tile tree changes based on the current viewport state.
- Remove dependency on xml-js library in core-frontend.
- Improved map-layer coordinate systems validation and error reporting.
- Send single change event for deletion of selected/hilited elements.
- Use new 'ProgressFunction' instead of 'ProgressCallback' when downloading briefcase or changes.
- Use EmptyLocalization for localization in tests to increase test performance
- Save the tool settings property before reinitialize the tool when a property change in the tool settings of the MeasureAreaByPointsTool
- Fix greenUp flag for GLTF normal maps (set to true).
- Promote ViewState3d.lookAt and Viewport.queryVisibleFeatures to public.
- Deprecate IModelConnection.displayedExtents.
- Prevent flickering skybox in synchronized viewports.
- Add support for normal maps in iModel tiles.
- Avoid creating unnecessary copies of tile trees for context reality models.
- Make the contents of a Viewport react more smoothly when the containing div is resized."
- React to RPC deprecations.

## 3.5.6
Fri, 24 Feb 2023 16:02:47 GMT

### Updates

- Batch coordinate reprojection requests to prevent frequent small requests.

## 3.5.5
Thu, 26 Jan 2023 22:53:27 GMT

### Updates

- Fix map-layers WMS request failure on some servers requiring 'Transparent' parameter value to bo upper-case (as specified in the WMS specification)

## 3.5.4
Wed, 18 Jan 2023 15:27:15 GMT

_Version update only_

## 3.5.3
Fri, 13 Jan 2023 17:23:07 GMT

### Updates

- Remove dependency on xml-js library in core-frontend.

## 3.5.2
Wed, 11 Jan 2023 16:46:30 GMT

### Updates

- Add support for pickable view overlay decorations.

## 3.5.1
Thu, 15 Dec 2022 16:38:28 GMT

### Updates

- realityModelRange
- Support reality meshes with 8- or 32-bit indices.

## 3.5.0
Wed, 07 Dec 2022 19:12:37 GMT

### Updates

- Added a tolerance parameter to ArcgisUtilities.getZoomLevelsScales
- Added support for ImageryTileTree with an incomplete tile tree definition (minLOD)
- Support for reporting progress and cancelling 'BriefcaseConnection.pullChanges'.
- Added ability to display normal maps
- Fix for tools that supply hints to override the default AccuDraw origin.
- Add preliminary alpha support for custom reality data providers.
- Add IModelConnection.generateElementMeshes.
- Fix an exception when adding an invalid map layer to a viewport.
- Fix emphasis and hilite effects applied to point clouds.
- Add support for customized reality model display.
- Promote ViewPose-related APIs to public.
- requestElementGraphics uses relative positions by default to address precision issues with coordinates far from the origin.
- Add MarginOptions.paddingPercent for a more straightforward way to pad out a viewed volume.
- Replace inline type definitions in CreateRenderMaterialArgs with named and documented interfaces.

## 3.4.7
Wed, 30 Nov 2022 14:28:19 GMT

_Version update only_

## 3.4.6
Tue, 22 Nov 2022 14:24:19 GMT

_Version update only_

## 3.4.5
Thu, 17 Nov 2022 21:32:50 GMT

_Version update only_

## 3.4.4
Thu, 10 Nov 2022 19:32:17 GMT

_Version update only_

## 3.4.3
Fri, 28 Oct 2022 13:34:58 GMT

### Updates

- ArcGIS tilemap requests were missing oauth2 token if available.
- Reproject reality tiles to the surface of the Earth.

## 3.4.2
Mon, 24 Oct 2022 13:23:45 GMT

### Updates

- Add functions to obtain the extents of geometric models asynchronously on the backend.
- Fall back to requesting a tile from the backend when a request to cloud storage throws a 404 error.

## 3.4.1
Mon, 17 Oct 2022 20:06:51 GMT

_Version update only_

## 3.4.0
Thu, 13 Oct 2022 20:24:47 GMT

### Updates

- Improve ambient occlusion effect by decreasing the size of shadows for more distant geometry, increasing the default maximum distance of the effect to 10,000 meters, and fading the effect as it approaches maximum distance.
- Deprecated CloudStorage in favor of TileStorage + iTwin/object-storage
- Fix display issue with ArcGIS server of 'Geologic Map of North America'
- Use createImageBitmap when creating textures for reality models (currently enabled for Chromium only)
- Add waitForSceneCompletion API to Viewport.
- lock down @types/semver to 7.3.10
- add querySubCategories to imodelconnection
- Updated Node types declaration to support latest v16
- Improve support for display transforms in AccuSnap and ViewClipByElementTool.
- Fix pan tool failing to work when zoomed out with planar globe mode.
- Limit the shadow-casting range for tile trees that span the entire globe, like the OpenStreetMap buildings.
- Add support for custom terrain providers.

## 3.3.5
Tue, 27 Sep 2022 11:50:59 GMT

_Version update only_

## 3.3.4
Thu, 08 Sep 2022 19:00:04 GMT

_Version update only_

## 3.3.3
Tue, 06 Sep 2022 20:54:19 GMT

_Version update only_

## 3.3.2
Thu, 01 Sep 2022 14:37:22 GMT

_Version update only_

## 3.3.1
Fri, 26 Aug 2022 15:40:02 GMT

_Version update only_

## 3.3.0
Thu, 18 Aug 2022 19:08:02 GMT

### Updates

- Support non-modifiable preview of a ClipVector that isn't a single ClipShape/ConvexClipPlaneSet.
- upgrade mocha to version 10.0.0
- Update links to BIS documentation.
- Clear drag state when button let up outside view. Don't send tools drag events if they didn't get button down event.
- Transport RPC requests over IPC when available.
- Move ServiceExtensionProvider to the @itwin/extension-client package
- Restore the possibility to attach any cesium asset using getCesiumAssetUrl
- Prevent duplicate logo cards from displaying when clicking the iTwin.js logo in a viewport.
- Add option to quantize positions in TileAdmin.requestElementGraphics.
- Fix reality models failing to cast shadows.
- Convert negative ViewRect coordinates to zero.
- EmphasizeElements ignores script overrides for de-emphasized elements if other elements are being emphasized.
- Promote Tool Settings APIs to public.
- Add support for applying schedule scripts without requiring the script to be hosted by a persistent element.
- Fixes for updateDynamics to supply ajusted point.

## 3.2.9
Fri, 26 Aug 2022 14:21:40 GMT

_Version update only_

## 3.2.8
Tue, 09 Aug 2022 15:52:41 GMT

### Updates

- Add IModelConnection.categories for querying category information. Add support for hiliting the intersection of a set of models and a set of subcategories.

## 3.2.7
Mon, 01 Aug 2022 13:36:56 GMT

_Version update only_

## 3.2.6
Fri, 15 Jul 2022 19:04:43 GMT

_Version update only_

## 3.2.5
Wed, 13 Jul 2022 15:45:52 GMT

### Updates

- Avoid attempting to load ViewState data from the backend for a BlankConnection.

## 3.2.4
Tue, 21 Jun 2022 18:06:33 GMT

_Version update only_

## 3.2.3
Fri, 17 Jun 2022 15:18:39 GMT

### Updates

- Fix tile display issues for layer tiles not covering the entire tile tree and TileMap service is not available.  Derive minimum LOD from the minimum scale.  Use 'fullExtent' metadata to get cartoRange of layer when getFootPrints request doesnt include data extent.
- Made several map-layers functions public

## 3.2.2
Fri, 10 Jun 2022 16:11:36 GMT

### Updates

- added errorOnMissingUniform render option
- Omit authorization in RPC communication between mobile frontend and backend.

## 3.2.1
Tue, 07 Jun 2022 15:02:56 GMT

### Updates

- Add option to quantize positions in TileAdmin.requestElementGraphics.
- Prevent an assertion when creating a pickable graphic with an empty FeatureTable.

## 3.2.0
Fri, 20 May 2022 13:10:54 GMT

### Updates

- Dispose reality mesh textures when disposing the tiles are dispose
- Use a function constructor to avoid webpack warnings when dynamically importing extension files.
- Fixed visibility of edges when using Ambient Occlusion
- Added documentation for MapLayerKey.
- MapLayerFormatRegistry allows MapLayerAccessClient objects to be provided for each format, enabling extended support of various authentication methods.
- Improve RealityTile loading priority calculation
- Prevent 0-dimension assignment in CanvasState.updateDimensions. This resolved a blank rendering issue when dropping and re-adding a viewport with the same size.
- ViewState3d.lookAtGlobalLocation should account for orthographic view points.
- Mark animateFrustumChange public.
- Added public method IModelConnection.getMassPropertiesPerCandidate.
- bugfix for viewstate2d's hydrateViewState
- Add preload, postload functions to ViewStates. Use hydrateViewState in load function
- Fix bug in which DisplayStyleState.changeBackgroundMapProvider failed to preserve previous values as advertised.
- Prevent calls to readPixels from being enqueued when mousing over canvas decorations.
- Fix scaled monochrome mode not applying to instanced geometry.
- Add GraphicBuilder.activatePickableId to enable batching of multiple pickable objects into a single graphic.
- Added connectViewports and related functions to enable synchronizing the states of any number of viewports.
- Do not produce mip-maps for reality tile textures.
- Make Viewport.readPixels return undefined if the viewport has been disposed.
- Ensure the render loop is processed immediately after the selection set changes.
- Reduce number of OnMotionSnap call
- Use zoom target on reality tile priority calculation
- Add support for remote extensions
- Catch snap abandoned exception.
- Add extension API generation
- Fix view zoom jumps on touch devices

## 3.1.3
Fri, 15 Apr 2022 13:49:25 GMT

_Version update only_

## 3.1.2
Wed, 06 Apr 2022 22:27:56 GMT

### Updates

- Fix OOM stemming from JS trying to parse a very large object. Prefer use of `JSON.parse()` for very large objects."

## 3.1.1
Thu, 31 Mar 2022 15:55:48 GMT

### Updates

- Improved support for WMS 1.1.1 servers.

## 3.1.0
Tue, 29 Mar 2022 20:53:47 GMT

### Updates

- Non-pickable decorations used to fail to render if Ambient Occlusion was enabled.
- Add support for map layers using model geometry.
- Fix overlay map layers that were displayed at the wrong elevation
- Deprecate IModelReadRpcInterface.getViewThumbnail
- Add support for decoding draco-compressed point clouds and glTF meshes.
- Add support for obtaining polyfaces from tile geometry using TileGeometryCollector and GeometryTileTreeReference.
- Fix openImageDataUrlInNewWindow displaying an empty window in Electron.
- Dynamically import approximate terrain heights instead of fetching as JSON.
- Expose iTwin.js Core Version for extensions
- Fixed interaction between linear elements and planar elements when antialiasing is turned on.
- Supplied missing 'iModelJs' namespace in some calls to getLocalizedString.
- Added new getMapFeatureInfo API to Viewport.
- Simplify RenderMaterial creation by deprecating RenderSystem.createMaterial in favor of RenderSystem.createRenderMaterial.
- Change the type of ToolAdmin.idleTool from IdleTool to InteractiveTool
- Add RealityDataError in  RealityDataSource API
- Fully implement the point cloud 3d tile specification.
- Promote QuantityFormatter from beta to public.
- Now initializing Unit alternate display labels from UNIT_EXTRA_DATA. Minimal changes to support Units schema retrieval from backend iModels.
- Functions that fit a view to a volume accept an optional MarginOptions specifying how tightly to fit.
- Defaulting to the internal BasicUnitsProvider if QuantityFormatter units provider initialization fails. 
- Ensure view attachments referencing section drawings transform the spatial view's clip into sheet coordinates.
- Switched to more flexible extension api
- Generalize the concept of a TileUser to include types other than Viewports.
- Web IPC fix (when reloading frontend).

## 3.0.3
Fri, 25 Mar 2022 15:10:02 GMT

_Version update only_

## 3.0.2
Thu, 10 Mar 2022 21:18:13 GMT

_Version update only_

## 3.0.1
Thu, 24 Feb 2022 15:26:55 GMT

### Updates

- Fixed MapBox imagery failing to display.

## 3.0.0
Mon, 24 Jan 2022 14:00:52 GMT

### Updates

- Remove alternateLabels from UnitProps and require them to be provided via AlternateUnitLabelsProvider.
- Improve performance of schedule scripts containing large numbers of transform nodes.
- Fix striping artifact produced by ambient occlusion in views with very large frustums.
- Render 2d map when terrain data is not available.
- Make onRestartTool explicitly async
- Add support for producing larger tiles.
- The Cartographic creation API now takes an interface as an argument with named properties. This will avoid callers mixing up the order of longitude, latitude, and height.
- remove unused ClientRequestContext.useContextForRpc
- improve concurrent query changes
- SolidFill mode chooses an edge color to contrast with the element color and the background color.
- Remove usage-logging-client
- Upgrade target to ES2019 and deliver both a CommonJs and ESModule version of package
- Add support for indexed edges in tile graphics to reduce memory footprint and number of draw calls.
- Allow the same tile to be drawn repeatedly and efficiently in same Viewport with different symbology overrides.
- Ensure edges are always requested if TileAdmin.alwaysRequestEdges is true.
- Fix flickering with TwoWayViewportSync when one of the viewport's frustum is animated.
- Fix WebGL view not updating when dropping second viewport.
- Ensure DisplayStyleState.scheduleScript is synchronized with changes to DisplayStyleSettings.renderTimeline and DisplayStyleSettings.scheduleScriptProps.
- convertTouchMoveStartToButtonDownAndMotion stopped working with change to not await snap.
- 'onPostInstall' doing the animation logic on ViewGlobeLocationTool was redundant when done in addition to ViewGlobeLocationTool.parseAndRun. We got away with it before the Tool parseAndRun async change by the convenient luck of the flow of the non-async code. This removes '_doLocationView' from ViewGlobeLocationTool.parseAndRun.
- Improve conformance with the glTF 2.0 spec.
- Fix caching of gradient textures.
- Removed ViewState.isCameraEnabled.
- large textures
- Correct loop for collating imagery tiles to map mesh primitives
- Omit terrain skirts if the background map has a transparent clip mask applied.
- Fix viewport using terrain settings from previous display style when display style is reassigned.
- Fix iOS15 overlay draws.
- Deprecated Viewport.readImage in favor of Viewport.readImageBuffer.
- Sky cube primitive buffers must be bound when attempting to draw a sky cube.
- Clean up SkyBox and GroundPlane APIs.
- Tweak terrain skirt height calculation to match previous
- Correct calculation for up vector when looking at globe location
- Fix ViewCreator3d spatial criterion to account for NULL.
- fix ecsql row format
- Fix Open Street Map Building display
- Added support for Fresnel effect.
- Update FrontendHubAccess api to use ChangesetIndexAndId
- Fix issue that would prevent higher resolutions tiles to be fetch from ArcGIS server.
- Improved map layers validation when authentication is required.
- Added support for EPSG:4326 in WMS imagery provider.
- getAccessToken always returns a token
- Add readGltfGraphics for producing graphics from a glTF asset.
- Support smooth transition to globally centered views
- Fix some oversights in implementation of glTF.
- Added support for view-independent decoration graphics.
- Support creating a GraphicBuilder without a Viewport.
- Implemented a different clustering algorithm in MarkerSet.
- Add IModelApp.publicPath for users to override where core public assets are fetched from
- Supports instanced rendering of area pattern symbols.
- LocalhostIpcHost, display-test-app support for R/W web (via orchestrator)
- Added ability to convert iModel coordinates to or from any Geographic CRS
- rename contextId -> iTwinId
- Fix erroneous AccuDraw activation.
- make ViewState3d.lookAt take named arguments
- Added lookAtPerspectiveOrOrtho to ViewState3d
- Dropped DisplayStyleState.changeBaseMapProps. Added new DisplayStyleState.backgroundMapBase setter.
- Fix problem with RealityDataSourceKey string convertion
- Promote RealityDataSource and RealityDataSourceKey API to beta and update documentation
- Remove optimization that keep RealityDataSource from key in a list.
- Add Support for APIM RDS url to create RealityDataSourceKey from tilesetUrl
- ViewCreator3d no longer throws if no 3d models are found; instead it uses the project extents as the view extents.
- moved RealityDataAccessProps from core-frontend to core-common
- Impose default minimum spatial tolerance of 1mm.
- Support color mixing when overriding point cloud color
- rename to @itwin/core-frontend
- Support reading non-binary glTF assets.
- Fix non-locatable override for point clouds
- separate OnViewExtentsError from ViewChangeOptions 
- Support to open OPC file from any server
- Enhancements and improvements to particle systems.
- Removed WebAppViewer
- remove ClientRequestContext and its subclasses
- Removed config.app usage
- Add support for inverting planar clip mask (inside vs outside)
- Remove deprecated APIs for 3.0.
- Support transparency overrides for point clouds
- Moved `UnitSystemKey` to `@itwin/core-quantity`.
- Simplify RealitydataAccessProps interface and usage in iModel.js
- Generalize the way to attach a reality data by adding a RealityDataSourceKey to ContextRealityModelProps
- Enhance RealityDataSource class
- Reduce ellipsoid occlusion tolerance to avoid misdisplayed tiles over horizon with depth off.
- Replace usage of I18N with generic Localization interface.
- Replace hard-coded Cesium ION key with TileAdminProps.cesiumIonKey to be supplied at IModelApp.startup.
- remove previously deprecated apis
- Remove the default Bing Maps and MapBox Imagery keys from source. There are no longer any default keys available for use and apps will need to provide the keys necessary.
- Mvoe map imagery provider from BackgroundMapSettings to MapImagerySettings.backgroundBase.
- remove IModelWriteRpcInterface
- Remove deprecate QuantityFormatter methods
- fix usage or lack thereof of tile/internal barrel module
- rename contexId to iTwinId
- Removed NativeAppAuthorization
- Improve display of textured meshes when the texture image contains a mix of transparent and opaque pixels.
- rename IModelReadRpcInterface.openForRead to getConnectionProps
- Simplify RenderTexture creation APIs.
- Avoid skipping tool dynamics frame when new graphic is still pending.
-  Renamed an iModel's parent container to iTwin
- Altered to use abstract Reality Data interface
- Rework and correct child availability of tiled imagery formats.  Added EPSG:4326 support for WMTS.
- Support Open City Planner (OCP) that stores orbit point clouds (OPC) in their own azure environment.
- Add TwoWayViewportFrustumSync to synchronize only the frusta of two viewports.
- tool.run and tool.parseAndRun are now async methods
- Added tool setting helper methods.
- Ensure memory consumed by instanced geometry is accurately reported.
- Add support for blending transparent viewport background with HTML elements beneath the viewport.
- Support for TypeDoc v0.22.7. Fix various broken docs links.
- Protect logoCard styling from app's CSS and make sure the logoCard opens in the correct window for pop-out viewports.
- Refactored part of AccuDraw UI & Providing AccuDraw UI documentation
- Fix bug that sets the icon on MessageBox.NoSymbol the Success icon.
- Created imodel-components folder & package and moved color, lineweight, navigationaids, quantity, timeline & viewport. Deprecated MessageSeverity in ui-core & added it ui-abstract. Added MessagePresenter interface to ui-abstract.
- Update LatLong display precision to 4 decimal points.
- Default cameraOn in 3d ViewCreator
- FeatureAppearance transparency by default ignores render mode and transparency view flag.
- Adding WebEditServer (test scenarios only for now).
- Add support for wiremesh display of design models and reality models.

## 2.19.28
Wed, 12 Jan 2022 14:52:38 GMT

_Version update only_

## 2.19.27
Wed, 05 Jan 2022 20:07:20 GMT

_Version update only_

## 2.19.26
Wed, 08 Dec 2021 20:54:52 GMT

_Version update only_

## 2.19.25
Fri, 03 Dec 2021 20:05:49 GMT

_Version update only_

## 2.19.24
Mon, 29 Nov 2021 18:44:31 GMT

_Version update only_

## 2.19.23
Mon, 22 Nov 2021 20:41:40 GMT

_Version update only_

## 2.19.22
Wed, 17 Nov 2021 01:23:26 GMT

_Version update only_

## 2.19.21
Wed, 10 Nov 2021 10:58:24 GMT

_Version update only_

## 2.19.20
Fri, 29 Oct 2021 16:14:22 GMT

### Updates

- Viewport.pickDepthPoint and Viewport.pickNearestVisibleGeometry preserve model display transforms.

## 2.19.19
Mon, 25 Oct 2021 16:16:25 GMT

### Updates

- Fix display issues with transparency, shadows, hilite, and overlay decorations on iOS 15.

## 2.19.18
Thu, 21 Oct 2021 20:59:44 GMT

### Updates

- Fix failure to find any 3d models in ViewCreator3d.
- Backport from PR#2451 enable reprojection and merge
- Fix iOS>=15 missing hilite outlines by ensuring we do not write depth for hilite shaders.

## 2.19.17
Thu, 14 Oct 2021 21:19:43 GMT

### Updates

- Support Open City Planner (OCP) that stores orbit point clouds (OPC) in their  own azure environment.

## 2.19.16
Mon, 11 Oct 2021 17:37:46 GMT

_Version update only_

## 2.19.15
Fri, 08 Oct 2021 16:44:23 GMT

### Updates

- Allow the same tile to be drawn repeatedly and efficiently in same Viewport with different symbology overrides
- Add a new property to ContextRealityModelState named rdSourecKey that provide a new way of attaching Reality Data that will resolve tilesetUrl at runtime.

## 2.19.14
Fri, 01 Oct 2021 13:07:03 GMT

_Version update only_

## 2.19.13
Tue, 21 Sep 2021 21:06:40 GMT

### Updates

- added callback after animating frustum change
- Fix OIDC access token that didn't get renew in code that get Reality Data tiles
- Remove hardcoded contextId (aka iTwinId) used for testing

## 2.19.12
Wed, 15 Sep 2021 18:06:46 GMT

_Version update only_

## 2.19.11
Thu, 09 Sep 2021 21:04:58 GMT

### Updates

- Allow white-on-white reversal to be applied regardless of background color.

## 2.19.10
Wed, 08 Sep 2021 14:36:01 GMT

### Updates

- Geometry created by a GraphicBuilder needs to have its specified placement transform applied properly.
- The previous fix to the graphicbuilder transform problem actually resulted in some graphicbuilder primitives being transformed twice because they already had the transform applied to them. This fixes that issue by moving the transformation only to primitives that were missing it. This also adds code to ensure that GeometryAccumulator does not mutate the graphicbuilder's transform in-place.

## 2.19.9
Wed, 25 Aug 2021 15:36:01 GMT

### Updates

- Correct OpenStreetMap display with reprojection, clipping or geoid offset

## 2.19.8
Mon, 23 Aug 2021 13:23:13 GMT

_Version update only_

## 2.19.7
Fri, 20 Aug 2021 17:47:22 GMT

_Version update only_

## 2.19.6
Tue, 17 Aug 2021 20:34:29 GMT

_Version update only_

## 2.19.5
Fri, 13 Aug 2021 21:48:08 GMT

### Updates

- Orbit OPC OrbitGtBlobProps initialization and SAS token update.

## 2.19.4
Thu, 12 Aug 2021 13:09:26 GMT

_Version update only_

## 2.19.3
Wed, 04 Aug 2021 20:29:34 GMT

### Updates

- ViewCreator3d fix - modelExtents now computed from all model ranges

## 2.19.2
Tue, 03 Aug 2021 18:26:23 GMT

_Version update only_

## 2.19.1
Thu, 29 Jul 2021 20:01:11 GMT

### Updates

- Viewport.zoomToElements includes only 2d or 3d elements based on view type.

## 2.19.0
Mon, 26 Jul 2021 12:21:25 GMT

### Updates

- BriefcaseConnection.PullAndMergeChanges now returns both changesetId and changesetIndex
- Adjust the range of a RenderGraphic based on displacement applied by the viewport's AnalysisStyle, if any, so that displaced portions of the mesh can be located by tools.
- Added support for PointCloudModel attachments in OPC format with RDS URL resolving to OrbitGtBlobProps.
- Handle failures in models query when isNotSpatiallyLocated property does not exist in the schema
- GraphicBuilder now generates normals for polyfaces if requested.
- remove internal barrel-import usage
- Stop delivering pseudo-localized strings
- Fix multi-model animation issue.
- Handle degenerate frustum in BackgroundMapGeometry.getFrustumIntersectionDepthRange.
- Add support to GraphicBuilder for solid primitives and visible edges.
- move check for redirect callback handling in WebViewerApp to before IModelApp.startup call
- Support reprojection of Cesium OSM tiles
- internal async order change

## 2.18.4
Tue, 10 Aug 2021 19:35:13 GMT

_Version update only_

## 2.18.3
Wed, 28 Jul 2021 17:16:30 GMT

_Version update only_

## 2.18.2
Mon, 26 Jul 2021 16:18:31 GMT

_Version update only_

## 2.18.1
Fri, 16 Jul 2021 17:45:09 GMT

### Updates

- Add IModelConnection.Elements.getPlacements and update Viewport and ViewClipByElementTool to use it.

## 2.18.0
Fri, 09 Jul 2021 18:11:24 GMT

### Updates

- add GraphicBuilder.addCurvePrimitive.
- Add Tiles.updateForScheduleScript to refresh tiles after modifying schedule script."
- Update Toolsettings set-up in SetCameraTool to fix enable/disable setting of input field.
- Add Viewport.flashedId property and corresponding onFlashedIdChanged event.
- Added support for ESRI MapServer exposing a minimum LOD.
- Fix the Nadir color for 2 colors skybox in the context of background map.
- Add ability to clone Format and to add property setters. This allows a user to synchronously tweak a format in the frontend.
- Fix issue with TouchCursor unexpectedly disappearing when disabling snap/locate.
- pickable decoration enhancement
- Update tile trees when project extents change.
- Remove BackgroundMapLocation use EcefLocation directly.
- Clean up and promote AnalysisStyle APIs.
- TileAdmin.requestElementGraphics can now produce section-cut graphics.
- Update tooltips of RealityData with its type
- Add API to wait until all pending external textures have finished loading.

## 2.17.3
Mon, 26 Jul 2021 16:08:36 GMT

_Version update only_

## 2.17.2
Thu, 08 Jul 2021 15:23:00 GMT

_Version update only_

## 2.17.1
Fri, 02 Jul 2021 15:38:31 GMT

_Version update only_

## 2.17.0
Mon, 28 Jun 2021 16:20:11 GMT

### Updates

- Promote APIs to public.
- DR request for doClipPlaneOrientView to choose "better" view x direction.
- Added arc by 3 points tool. Ensure tools always get motion event before decorate or onDynamicFrame.
- Clean up and promote DisplayStyleState APIs for context reality models.
- Add TiledGraphicsProvider.isLoadingComplete.
- Make EditManipulator public
- Export EmphasizeElementProps from common, deprecate from frontend.
- External textures enabled by default for TileAdmin. External textures will downsample to maxTextureSize of client.
- Make flash settings customizable for a viewport.
- Allow saved map-layer definition to be edited.
- Removed unused 'maxZoom' property on MapLayerProps.  Added MapLayerSourceProps interface.
- Made MaplayerSource independent from MapLayerProps.
- Add GraphicBuilder.addPrimitive accepting any type of primitive.
- Synchronize IModelConnection properties in response to Ipc notifications.
- added IModelApp.hubAccess and deprecated IModelApp.iModelClient
- Promote various APIs to public. Add GraphicBuilder.addPrimitive accepting any type of primitive.
- set authorizationClient to undefined in IModelApp.shutdown
- Don't allow undo of changes to project extents or geolocation.
- make IpcApp and NativeApp @public
- Prevent preflight for ContextShare tile request
- Erase touch cursor when it is drawn in a different view.

## 2.16.10
Thu, 22 Jul 2021 20:23:45 GMT

_Version update only_

## 2.16.9
Tue, 06 Jul 2021 22:08:34 GMT

_Version update only_

## 2.16.8
Fri, 02 Jul 2021 17:40:46 GMT

_Version update only_

## 2.16.7
Mon, 28 Jun 2021 18:13:04 GMT

_Version update only_

## 2.16.6
Mon, 28 Jun 2021 13:12:55 GMT

_Version update only_

## 2.16.5
Fri, 25 Jun 2021 16:03:01 GMT

### Updates

- Synch map settings provider when base layer provider changes.

## 2.16.4
Wed, 23 Jun 2021 17:09:07 GMT

_Version update only_

## 2.16.3
Wed, 16 Jun 2021 20:29:32 GMT

_Version update only_

## 2.16.2
Thu, 03 Jun 2021 18:08:11 GMT

_Version update only_

## 2.16.1
Thu, 27 May 2021 20:04:22 GMT

### Updates

- add method to return ecef transform for tile tree

## 2.16.0
Mon, 24 May 2021 15:58:39 GMT

### Updates

- Make AccuDrawHintBuilder public and include everything needed by an InteractiveTool.
- Fix acs rotation and remove unneeded clones.
- (geomlibs) fix swap logic in Matrix3d.inverse alias case
- motion event changes.
- Add BatchOptions to customize how features can be resymbolized.
- Synchronize viewports when changes are made to geometry outside of a graphical editing scope.
- wip: CreateElementTool. Fix not being able to pick decorations after changing files.
- BatchOptions can specify that the contents of the batch should only be drawn for readPixels.
- Simplify GraphicBuilder creation using GraphicBuilderOptions.
- IModelConnection.View.load throws if the input is not a valid Id.
- Fix ViewState.hasSameCoordinates returning true if a 2d model was mistakenly included in a spatial view's model selector.
- Produce rounded joints when tesselating polylines.
- Return empty symbology overrides for maps to avoid inheriting from view
- Add hiliter for reality meshes
- Fix hiliting of reality meshes.
- Fix shader header typo
- Ensure materials are ignored unless smooth render mode is enabled.
- Add FrameStats API.
- In FrameStats, break down scene time.
- Enable querying geometry and other properties via IModelConnection.Elements.loadProps.
- The idleTool can now be set.
- improved silhouettes for non-perspective views
- Mobile fixes
- Fixes to desktop/mobile authorization
- set authorizationClient to undefined in IModelApp.shutdown
- Fix errors when masking background map with a plan projection model.
- Support planar masks for OrbitGT, fix infinite recursion collecting classifiers graphics.
- Add shader based grid display.
- set changesetId on BriefcaseConnection in pullAndMergeChanges
- Add Viewport.queryVisibleFeatures to determine the set of features currently visible in a viewport.
- Display styles support schedule scripts hosted by RenderTimeline elements.
- Move map tile trees to Viewport to handle synching correctly
- Only draw the TouchCursor in the viewport that initiated the touch.
- Add iterator to ViewManager and deprecate forEachViewport.
- Transform tool dynamics.
- add placement to GeomtricElementProps
- Revert to using older GPU timer extension in webgl2 if the newer extension isn't supported
- ViewCreator APIs tagged as public
- View Creator API - comments updated.

## 2.15.6
Wed, 26 May 2021 15:55:19 GMT

_Version update only_

## 2.15.5
Thu, 20 May 2021 15:06:26 GMT

_Version update only_

## 2.15.4
Tue, 18 May 2021 21:59:07 GMT

_Version update only_

## 2.15.3
Mon, 17 May 2021 13:31:38 GMT

_Version update only_

## 2.15.2
Wed, 12 May 2021 18:08:13 GMT

### Updates

- Fix animations from schedule script being erroneously applied to tile graphics.
- Return empty symbology overrides for maps to avoid inheriting from view

## 2.15.1
Wed, 05 May 2021 13:18:31 GMT

### Updates

- EmphasizeElements can override the appearance of unanimated schedule script nodes.
- Fix iOS shader bugs

## 2.15.0
Fri, 30 Apr 2021 12:36:58 GMT

### Updates

- Promote display-related APIs.
- Do not drape background map on reality if not geolocated
- Revert the change which defaulted shader precompiling on. It resulted in noticeable UI sluggishness before any viewports were added, while shaders precompiled.
- TileAdmin.requestElementGraphics can obtain graphics for a non-persistent geometry stream.
- Refactor grid-in-view line creation to make the same context repeatedly callable.
- gridline filtering corrections
- Fix orbitgt pointcloud position
- Implement fixes for point cloud relative paths and node transforms
- improved flickering silhouettes
- Fix raster view attachments using black background color.
- Fix delay before raster view attachments appear in a sheet view.
- Fix WebGL1 clipping shaders.
- Fixed silhouettes for instanced geometry when running with WebGL1
- Allow saved map layer definition to be deleted from setting service.
- No longer parse MapLayerSource URL for 'basemap' token.
- promote NativeApp to beta
- Support nested clip volumes.
- Precompile WebGL shaders by default.
- Promote globe view tools to public. Add NextVersion promotion entries for these and for thematic display.
- Optimize reality model processing.
- Drop deprecated ldclient-js dependency
- Remove deprecated ElementEditor that was replaced by EditCommands.
- Renamed InteractiveEditingSession to GraphicalEditingScope.
- Update release tags.
- Add BriefcaseTxns for monitoring changes to the briefcase.
- Update api tags
- ViewCreator2d API - modelType parameter removed
- Add an option to use the virtual cursor to help with element locate w/touch input.
- Added capability to scale the model display transform nonuniformly and have still Accusnap properly.

## 2.14.4
Thu, 22 Apr 2021 21:07:33 GMT

_Version update only_

## 2.14.3
Thu, 15 Apr 2021 15:13:16 GMT

_Version update only_

## 2.14.2
Thu, 08 Apr 2021 14:30:09 GMT

### Updates

- fix imports in CheckpointConnection.ts to not reference own barrel

## 2.14.1
Mon, 05 Apr 2021 16:28:00 GMT

### Updates

- Fix raster view attachments using black background color.
- Fix delay before raster view attachments appear in a sheet view.

## 2.14.0
Fri, 02 Apr 2021 13:18:42 GMT

### Updates

- Polish up InteractiveEditingSession API and promote to beta.
- rework Authentication to use IpcHost
- Fixed isAuthorized check. 
- Fix GPU Profiler for display-test-app
- Grid drawing code
- fixed z for edges and polylines when extended behind the eye
- Don't use GCS to align reality model if not in project vicinity.
- Refine test for calculating pixel size for tile sphere
- Fix Viewport.turnCameraOn to invoke setupFromView, and add Viewport.turnCameraOff.
- Fix shader bug in function unpackFloat which affected iOS unpacking floats precisely.
- MapLayerImageryProviders now handle 401 errors.
- Quick grid performance fix from Earlin.
- fix check in cartographicToDbFromGcs which causes certain locations to query GCS when they should not.
- Refactor attribution logo cards and add OpenStreetMap building attribution
- Update Quantity Formatter to support UnitFormattingSettingsProvider for persisting and retrieving unit format settings.
- Use ProcessDetector.isMobileBrowser to detect mobile frontends.
- Align scheduling of tile content requests more closely with capabilities of HTTP and RPC.
- Support for Bump Tool Settings
- Add missing ViewState.viewFlags setter.
- Simplified web app signIn, following the pattern established for desktops. The logic for silent signin has now been moved to WebViewerApp. 

## 2.13.0
Tue, 09 Mar 2021 20:28:13 GMT

### Updates

- Update parsing of string input in Accudraw to use quantity parsing.
- Initial setup for adding "basic manipulation" tools and commands to editor package.
- Added ElementSetTool base class.
- ElementSetTool class documentation.
- Fixed broken double angle bracket link syntax
- Fix iOS problem where a viewport would not redraw until resizing after closing multiple viewports.
- Fix incorrect GPU memory limits.
- Fix incorrect cached transform for plan projection models after the model's range changes.
- Fix Viewport.requestRedraw failing to request next animation frame.
- Imagery providers were incorrectly created for WMTS and AzureMaps. Improved testing.
- Split imagery providers in their own file.
- refactor IModelApp startup
- Improve grid line fade for vertical lines by drawing from center out.
- Allow applications to react to WebGL context loss by overriding RenderSystem.contextLossHandler.
- IPC shim (WIP) for local webviewer apps.
- Added MoveElementsTool
- implemented nonlocatable for planar classifiers
- Update how custom QuantityType definitions are defined and registered.
- Add planar clip mask support.
- Fix transparent depthless map failing to blend with background color or skybox.
- add notifications for changed elements on SaveChanges
- Updated to use TypeScript 4.1
- Undo/Redo shortcuts
- begin rename project from iModel.js to iTwin.js
- Allow the same label to be used in two different units within the same family but in different systems.
- Fix failure to call screen-space effects `shouldApply` function when reading pixels.
- fix for running display-performance-test-app with a saved view which has volume classification using overrides

## 2.12.3
Mon, 08 Mar 2021 15:32:00 GMT

_Version update only_

## 2.12.2
Wed, 03 Mar 2021 18:48:52 GMT

### Updates

- Fix incorrect cached transform for plan projection models after the model's range changes.
- Add workaround for bogus transform in tile tree for empty model.

## 2.12.1
Tue, 23 Feb 2021 20:54:45 GMT

### Updates

- Prevent buggy decorators from invalidating other decorators' cached decorations.
- Fixed regression introduced recently that prevent WMS map layers from being displayed.

## 2.12.0
Thu, 18 Feb 2021 22:10:13 GMT

### Updates

- The about dialog now works better on smaller screens and mobile devices.
- Support clearing color/transparency overrides by element ids and not just key.
- Deprecate detachChangeCache()
- dont toggle persistent html decoration's dom attachment
- Fix regressions in image diff tests caused by changes to tile selection logic.
- added flag to truncate ecsql blob values
- Smoother frustum transition
- enter requestContexts in map layer settings service so that activity Id can be tracked in SEQ logs
- Implement external textures for iModel tiles.
- Fix failure to compute frustum depth from view attachments causing them to be severely clipped.
- Added new ArcGis token generator/manager. ArcGISMapLAyerImageryProvider now check for token error messages when fetch tile, inform end-user and raise an event.  Token is generated / appended dynamically to each ArcGIS request.
- Add options for limiting GPU memory allocated for tile contents.
- Don't change the imodeljs-icon opacity on mobile devices that don't support hover.
- Fix locate for particle effects.
- Add support for defining custom particle effects.
- NativeApp now uses Ipc
- Added support for Slope and Hillshade modes for Thematic display of Terrain
- AccuDraw bi-directional value updates
- Fixed AccuDraw shortcuts in apps like DR

## 2.11.2
Thu, 18 Feb 2021 02:50:59 GMT

### Updates

- NativeApp download progress fix

## 2.11.1
Thu, 04 Feb 2021 17:22:41 GMT

_Version update only_

## 2.11.0
Thu, 28 Jan 2021 13:39:27 GMT

### Updates

- Don't allow AccuDraw in exaggerated views.
- Avoid decoding the same texture image multiple times when receiving multiple simultaneous requests.
- Add support for altering the image produced by a Viewport using custom screen-space post-processing effects.
- work on NativeApp and editing commands
- Improve ElementGeometry documentation.
- Account for aspect ratio skew in core decorations.
- Add ability for caller to override format per QuantityType.
- Add ability to set unit system for quantity formats to the same four supported by Presentation manager.
- Fix hilite silhouette ignoring weight overrides for polylines.
- Use optimized planar map corners for size
- The type of ViewState3d.displayStyle is DisplayStyle3dState, to reduce need to cast.
- Ensure quantity formatter is initialized once IModelApp.startup is awaited.
- Added new WMTS capabilities parser and improved general support of WMTS.
- WmtsCapabilities now using 'xml-js' instead of 'fast-xml-parser'.
- Apply workaround for Intel HD 620/630 driver bug.
- Show iModel.js version rather than Application version in iModel.js Card"
- Bias global reality models to match terrain corrections.
- Modified OrbitGT point clouds to be able to override their model color.
- Support global navigation with camera off
- Add Viewport.onResized event; add option not to preserve order of geometry added to a GraphicBuilder for an overlay decoration (improves performance).
- Display spatial view in context of section drawing view if so specified.
- Add support for section-cut graphics display.
- Add notion of attaching and detaching a ViewState to/from a Viewport. On attach, register event listeners to automatically synchronize the Viewport's state when aspects of the ViewState are modified, eliminating the need to manually synchronize or use specific Viewport APIs. In detach, deallocate Viewport-specific resources such as WebGL objects used for rendering view attachments.
- #415276 Fixed line widths for wide lines that extend behind the eye.

## 2.10.3
Fri, 08 Jan 2021 18:34:03 GMT

_Version update only_

## 2.10.2
Fri, 08 Jan 2021 14:52:02 GMT

### Updates

- WmtsCapabilities now using 'xml-js' instead of 'fast-xml-parser'.
- Bias global reality models to match terrain corrections.

## 2.10.1
Tue, 22 Dec 2020 00:53:38 GMT

### Updates

- Added new WMTS capabilities parser and improved general support of WMTS.

## 2.10.0
Fri, 18 Dec 2020 18:24:01 GMT

### Updates

- Update minimum Node version to 10.17.0
- Support compact representation of DisplayStyleSettings.excludedElements.
- Handle missing 'window' object when run in Node for support of Server-Side Rendering
- Ensure proper disposal of WebGL resources owned by Target.
- Add tests for undefined values in script.
- Fixed an issue where WMS GetFeatureInfo would not work correctly on all sublayers.
- Correct reprojection to allow non-rigid linear transform.
- Fix tap on measure distance marker showing information for wrong segment.
- Add ability for caller to override quantity display format per QuantityType.
- Make view globe tools use GCS reprojection as necessary to improve precision when navigating within the iModel extents.
- Support display of OSM Buildings.

## 2.9.9
Sun, 13 Dec 2020 19:00:03 GMT

### Updates

- Add ability for caller to override quantity display format per QuantityType.

## 2.9.8
Fri, 11 Dec 2020 02:57:36 GMT

_Version update only_

## 2.9.7
Wed, 09 Dec 2020 20:58:23 GMT

### Updates

- Fixed an issue where WMS GetFeatureInfo would not work correctly on all sublayers.

## 2.9.6
Mon, 07 Dec 2020 18:40:48 GMT

_Version update only_

## 2.9.5
Sat, 05 Dec 2020 01:55:56 GMT

_Version update only_

## 2.9.4
Wed, 02 Dec 2020 20:55:40 GMT

_Version update only_

## 2.9.3
Mon, 23 Nov 2020 20:57:56 GMT

_Version update only_

## 2.9.2
Mon, 23 Nov 2020 15:33:50 GMT

### Updates

- Apply workaround for transparency anomalies caused by buggy Intel drivers.

## 2.9.1
Thu, 19 Nov 2020 17:03:42 GMT

_Version update only_

## 2.9.0
Wed, 18 Nov 2020 16:01:50 GMT

### Updates

- pass map layer accessKeys through configOptions instead of hardcoded
- Preliminary support for interactive editing sessions.
- Clean up EventSource API for push events.
- Fix ECEF for reality models
- Change key name for MapboxLayers
- Create animation tile trees if only transform present.
- disable frontend Bentley telemetry in iModelBank use case
- Thematic surface isolines are now pickable. Previously, trying to select an area in between isolines for a surface would select the surface. Now the empty space in between does not count.
- Added ability to override the color of a point cloud.
- Work around memory issues on iPads when rendering reality tile trees by introducing a mobile-only memory threshold which triggers a prune on tile trees.
- Fix issue where some apps would exception when quantityFormatter.onIntialize was called before redux state was set up.
- Fix QuantityFormatter volume definitions.
- Support for push events
- Set reality tile and terrain branches to own their own children.
- Add call to reload tool settings UI.
- Added ViewCreator APIs

## 2.8.1
Tue, 03 Nov 2020 00:33:56 GMT

### Updates

- disable frontend Bentley telemetry in iModelBank use case

## 2.8.0
Fri, 23 Oct 2020 17:04:02 GMT

### Updates

- Ensure transform animations in schedule scripts are applied correctly to tile graphics.
- #460803 Improve clip arrow control visibility.
- handle undefined _lut in FeatureOverrides when webgl context is lost, which obscured the actual context loss
- link to webgl compatibility checker in context loss error message
- Restore reality model and schedule script init - inadvertently removed.
- fixed hilite/emphasis interaction for for non-default options
- fixed hilite/emphasize interaction
- Root WMS sublayer is now included is the list of Sublayers.  First level of children is visible by default, unless too many layers are found (in that case we make the root sublayer visible only).  Made sure prefixed sublayers groups are correctly linked to root sublayer.  Also removed prefix from title for prefixed sublayers.
- Added optional wms authentication
- #468491 Stop touch viewing operations from affect last dynamics point.
- IModelConnection.onOpen is not raised when opening iModel with NativeApp.openBriefcase
- Support down-sampling very large textures in tiles.
- Reduce threshold for ecef validation.
- Remove deprecated SpatialModelTileTrees.
- Add methods on viewport for attach/detach reality models.  Support -1 for detach.
- Add support for OPC point clouds in Reality Data widget.
- Added color mix to thematic display for background map terrain and point clouds
- added IModelApp.translateErrorNumber

## 2.7.6
Wed, 11 Nov 2020 16:28:23 GMT

_Version update only_

## 2.7.5
Fri, 23 Oct 2020 16:23:50 GMT

### Updates

- Reduce threshold for ecef validation.

## 2.7.4
Mon, 19 Oct 2020 17:57:01 GMT

_Version update only_

## 2.7.3
Wed, 14 Oct 2020 17:00:59 GMT

_Version update only_

## 2.7.2
Tue, 13 Oct 2020 18:20:38 GMT

_Version update only_

## 2.7.1
Thu, 08 Oct 2020 13:04:35 GMT

### Updates

- Ensure transform animations in schedule scripts are applied correctly to tile graphics.

## 2.7.0
Fri, 02 Oct 2020 18:03:32 GMT

### Updates

- Added MapLayerSettingsService to persist custom map sources between sessions for same project/model
- Support authorization via URL suffix for Cesium ion.  Handle PBR texture.
- Fixes to front end methods to pull, merge and push. 
- Fixed desktop authorization after recent changes. 
- Support literal double-quote characters in quoted key-in arguments.
- Restore reality model and schedule script init - inadvertently removed.
- Generate normals for 3d view decorations.
- Fix locate for plan projection models with non-depth-buffered background map.
- Calculate correct up vector even when ECEF is bad.
- On iOS download in background
- Look and move can now start from key. Don't use ctrl key due to browser conflicts.
- Added switches to turn on and off the WMS feature of the map layer widget
- Added optional wms authentication
- Added a person to the "set up walk camera" tool decorations.
- Cleaned up formatting of glsl shader code produced for better human readability when debugging shaders.
- Support thematic display of point clouds.
- Added thematic display to background terrain

## 2.6.5
Sat, 26 Sep 2020 16:06:34 GMT

_Version update only_

## 2.6.4
Tue, 22 Sep 2020 17:40:07 GMT

_Version update only_

## 2.6.3
Mon, 21 Sep 2020 14:47:09 GMT

### Updates

- Support literal double-quote characters in quoted key-in arguments.

## 2.6.2
Mon, 21 Sep 2020 13:07:44 GMT

### Updates

- Calculate correct up vector even when ECEF is bad.

## 2.6.1
Fri, 18 Sep 2020 13:15:09 GMT

_Version update only_

## 2.6.0
Thu, 17 Sep 2020 13:16:12 GMT

### Updates

- Supply symbology overrides for map geometry so that view defaults (isolate) are not applied.
- Moved ESLint configuration to a plugin
- Fix potential unbounded growth of an array each time a Viewport's scene is recreated.
- react to telemetry and introspection client changes
- Allow level 1 imagery tiles to be used (the planar projection requires them at max zoom).  Force depth buffer for large globe tiles.
- Add optional TileAdmin.Props.minimumSpatialTolerance as terminating condition for tile refinement.
- Add support for opening a key-in palette to run key-ins.
- Remove azure map support.  Don't expose mapbox sources by default.
- Add support for quoted strings during key-in parsing
- Added validation to select only queryable layer in the GetFeatureInfo of the WMS layers
- #437338 First attempt at walk tool collisions using depth buffer w/o changing view.
- reduce jumpiness when zooming with mouse wheel quickly
- make zoom with wheel faster when rolling quickly

## 2.5.5
Wed, 02 Sep 2020 17:42:23 GMT

### Updates

- Edges only render using the monochrome color if render mode is wireframe.

## 2.5.4
Fri, 28 Aug 2020 15:34:15 GMT

_Version update only_

## 2.5.3
Wed, 26 Aug 2020 11:46:00 GMT

_Version update only_

## 2.5.2
Tue, 25 Aug 2020 22:09:08 GMT

_Version update only_

## 2.5.1
Mon, 24 Aug 2020 18:13:04 GMT

### Updates

- Tweak reality model alignment test.  Add getRealityModelAppearanceOverrides.

## 2.5.0
Thu, 20 Aug 2020 20:57:09 GMT

### Updates

- Change to use toast message to inform user of extension loaded. 
- Decorators can now optionally have their decorations cached to achieve a potential performance benefit.
- Introduce IModelApp security options (including CSRF protection).
- Fixed Web Accessibility issues
- Move types from FeatureSymbology namespace from imodeljs-frontend to imodeljs-common.
- When recalling a saved view with elevated plan projections, ensure the elevation is applied.
- Fix an exception when drawing a surface that should have a texture but doesn't.
- Use IModelRoutingContext
- Added mobile oidc client
- Moved SpecialKey & FunctionKey enums to ui-abstract & started using them throughout UI packages
- Support reality model transparency
- Refine reality model alignment test to avoid misapplication where no misalignment exists.
- element editor
- Switch to ESLint
- Fix inaccurate snapping for elevated plan projection models.
- Fix for crash when doing volume classification and there is no classifier geometry.
- Make IModelApp globally accessible for debugging.

## 2.4.2
Fri, 14 Aug 2020 16:34:09 GMT

### Updates

- Fix regressions in background map locate and ground bias.
- Add support for restart query

## 2.4.1
Fri, 07 Aug 2020 19:57:43 GMT

### Updates

- add missing rbac-client dep
- Synch map layer imagery when properties change (could cause new tree to be used).

## 2.4.0
Tue, 28 Jul 2020 16:26:24 GMT

### Updates

- Added ability to enable antialiasing
- remove linewidth adjustment for non-antialiased lines (like in transparent pass).
- GraphicBuilder optionally accounts for the view's aspect ratio skew when computing level of detail.
- Support Map Layer Settings.
- Implement devicePixelRatioOverride on RenderSystem.Options.
- RenderSystem option controlling whether device pixel ratio is taken into account when computing level of detail for tiles and decoration graphics.
- Changes to support new HitDetail.isMapHit classificiation.
- Optimize reality tile loading.
- Decoration optimization: internally include range in order to reduce performance impact of pickable decorations.
- overlay-tooltip should use overflow:hidden
- Address LGTM warnings in UI code.

## 2.3.3
Thu, 23 Jul 2020 12:57:15 GMT

### Updates

- Fix regression that could result in increased number of tile requests.

## 2.3.2
Tue, 14 Jul 2020 23:50:36 GMT

_Version update only_

## 2.3.1
Mon, 13 Jul 2020 18:50:14 GMT

_Version update only_

## 2.3.0
Fri, 10 Jul 2020 17:23:14 GMT

### Updates

- geometry clip containment
- Fully-transparent classifiers indicate the classified geometry should be clipped.
- A TiledGraphicsProvider may override scene creation.
- Add ability to override selected aspects of a viewport's display style.
- Fix failure to locate textures when deserializing glTF in some instances.
- Fix exception on missing shader uniform on Linux under specific combination of graphics settings.
- Viewport now supports multiple feature override providers. The featureOverrideProvider property is deprecated.
- added removeData() to native storage
- Honor non-locatable flag on TerrainSettings.
- Implement new thematic display modes: slope and hillshade.
- enforce max texture size for stepped gradients.
- New thematic gradient modes implemented and documented: Stepped, SteppedWithDelimiter, and IsoLines
- Use height from ECEF transform for terrain cartesian region.

## 2.2.1
Tue, 07 Jul 2020 14:44:52 GMT

_Version update only_

## 2.2.0
Fri, 19 Jun 2020 14:10:03 GMT

### Updates

- add ViewState.adjustAspectRatio
- Promote EmphasizeElements and IModelConnection.query() to public API.
- Add support for cel-shaded views; promote many APIs, particularly display-related ones.
- Expand frustum when fitting background map to avoid clipping in plan views.
- Refactor FeatureTrackingManager
- Return the new GeoServiceStatus instead of IModelStatus.BadRequest
- Gpu profiler fix for readPixel calls
- Orient silhouette clip for background map correctly in parallel projections
- Added MessageManager.MaxDisplayedStickyMessages & support for maximum displayed sticky messages
- Add support for applying different clip volumes to groups of models in a spatial view.
- A GeometricModel may override specific view flag at display time, e.g. to specify that the model should always be drawn in wireframe mode.
- Optimize thematic sensor display by using eye space instead of world space in the shaders.

## 2.1.0
Thu, 28 May 2020 22:48:59 GMT

### Updates

- Handle height value when calculating ecef transform for maps.
- RenderClipVolume now supports ClipVectors containing more than one ClipPrimitive.
- Remove now-unused clipping mask shaders.
- An unhandled exception no longer closes the electron window.
- Fix silently-caught exception during asynchronous loading of EntityState constructors."
- Raise tile load event when map corners are reprojected.
- Fix incorrect conversion of display priority to frustum depth.
- ViewState3d.supportsCamera() returns false if 3d manipulations are disallowed.
- Orthographic view attachments now render directly onto the sheet view.
- Add support for perspective view attachments.
- Added support for WebGL2 to shader debug
- Make thematic gradient texture adhere to max texture size of system.
- Optimize thematic sensor display by culling sensors based on a distanceCutoff property on ThematicDisplaySensorSettings.
- Reduce number of shader programs produced for clipping.
- small improvements to WebGL1 & WebGL2 performance & fix for output of hlsl shaders for debug
- Some very minor performance improvements to WebGL1 & 2 shaders.
- improve Terrain shaders; default to WebGL2

## 2.0.0
Wed, 06 May 2020 13:17:49 GMT

### Updates

- Fixed setup of UserInfo from browser clients, and more cleanups to AccessToken API. 
- Add a peerDependency on @bentley/extension-client
- lookAtViewAlignedVolume should adjust view delta for limits and not fail.
- Show min/max window error for mouse wheel zoom.
- Show min/max window error for mouse wheel zoom.
- Revert bogus backend extract-api change. More frontend api changes.
- Limit minimum alpha weight to prevent transparent geometry at far plane from becoming invisible.
- Separate Viewport.scheduleScriptFraction into analysisFraction and timePoint.
- SpatialViewState.areAllTileTreesLoaded correctly checks secondary classifier and drape trees.
- `IModelApp.startup` is now async.
- `IModelApp.shutdown()` is now async.
- Make locate work for background map with depth turned off.
- Setup initialization of briefcase cache for offline workflows. (VSTS#286489)
- Monitor progress of downloading briefcases, ability to cancel download of briefcases. 
- Introduce BriefcaseConnection, make IModelConnection abstract
- Remove ^ for ulas client dep in the frontend"
- Improve performance of shadow display on macOS by avoiding frequent calls to gl.getParameter().
- Added support for customized lighting including hemisphere lights.
- React to clients/UlasClient changes
- Expand descendant clipping for reality tiles.   Test noGcsDefined when calculating map ECEF.
- Fix regression causing reality models not to be clipped by view clip.
- Clip upsampled terrain tile triangles to avoid overlapping transparency anomalies.
- Add feature to optionally colorize pixels inside or outside clip regions.
- WebGL Compatibility functionality moved to webgl-compatibility package
- Added support for backward slashes in erroneous URLs of Reality Data in PW Context Share
- Reality models now cast and receive solar shadows.
- NativeApp.deleteBriefcase should work in offline scenarios. 
- Dont reproject tiles if GeoLocation from tool.
- Support for progress/cancel from ios
- Ensure view decorations are scaled based on device-pixel ratio.
- Ellipsoid API
- Handle map tiles without depth buffering in ellipsoid map projection.
- Adjust viewport's Z planes when background map display is toggled.
- Refactor ExtensionAdmin for Extension Service support
- Make iModelConnection an optional arg to track() in FeatureTrackingManager.
- Fix error explanation from InteractiveTool filterHit not been shown.
- Ensure 2d views have known extents at construction.
- Do not cull on content range if children present.
- Fix global frustum expansion.
- Remove deprecated APIs; see NextVersion.md for details.
- Fix garbled terrain imagery caused by premature texture disposal.
- Fix reprojection of map tiles.
- Fix a bug in populating layer command lists, and ensure plan projection elevations are compared properly.
- Fix for cannot pick clip handles when elements are emphasized
- Always set planar flag for 2d geometry.
- Fix documentation of DisplayStyle timePoint units.
- Fix regression causing transparency threshold to be ignored in HiddenLine and SolidFill render modes.
- Fix potentially uninitialized lighting uniforms.
- fixed pick of volume classified geometry
- fixed hilite for volume classifiers
- Update definition of toolsettings properties.  To assist with responsive UI based on screen size, Lock property is now specified with the property it locks.
- Change to make ui-abstract a peer dependency, this required updating some test apps to explicitly defing ui-abstract as a dependency.
- Fix for EcefLocation.createFromCartographicOrigin. Tooltip for monument point handle.
- Refine frustum/globe intersection calculation.
- Request high-performance webgl context.
- added rendering frame lifecycle callbacks required for 3dmaps plugin
- react to changes in imodeljs-clients
- move OidcFrontendClient from imodeljs-clients
- update IModelApp to require FrontendAuthorizationClient
- Introduce SnapshotConnection and BlankConnection subclasses of IModelConnection
- Promote properties from IModelToken onto IModelConnection
- When computing the pixel size of a tile in a perspective view, use the point on its bounding sphere closest to the camera."
- increase default wheel zoom durtaion to .5 seconds
- Discard ECEF-dependent tile trees when ECEF location changes.
- And parseKeyin and parseAndRun methods to ToolRegistry.
- #285220 Wrong LocateResponse when 1st HitList entry isn't the accepted hit.
- Fix terrain sometimes drawing garbage imagery due to freed textures.
- Ensure the view updates in response to changes to terrain transparency.
- openBriefcase should not access internet.
- Fix material color inappropriately being applied in SolidFill mode when feature symbology overrides are in effect.
- Added NativeApp.deleteBriefcase, avoided authorization exceptions when offline. 
- Refactored NativeApp API and RPC interfaces. This continues to be WIP. 
- Differentiated RemoteBriefcaseConnection-s from LocalBriefcaseConnection-s for use in web and native applications. These are now sub-classes of the abstract base class BriefcaseConnection. 
- Setup ability to use NativeApp.openBriefcase() in offline scenarios. 
- add new interface for native app
- VSTS#217447, 162382: Cleanups to implementation of downloading/opening/discovering briefcases in native applications (WIP). 
- initialize connectivity status on NativeApp.startup() and unregister callback on NativeApp.shutdown()
- VSTS#296110: Setup a way to close briefcases when the native application is offline. 
- Remove named clip code, we ended up not wanting to save clips independent of saved views.
- Renamed OIDC constructs for consistency; Removed SAML support.
- Support OrbitGT point cloud dislay.
- RenderSystem.Options allows overriding WebGLContextAttributes.
- #275962 Fix EmphasizeElements.toJSON for color overrides
- Change pickNearestVisibleGeometry to not return "plane" points outside of npc range.
- Fix z-fighting of blanking regions when logarithmic depth buffer is used.
- Precompile shaders in order of priority during idle time when no viewports exist.
- Project location error messages and tool assistance.
- Passing optional iModel context/project as it is the one to be used for Reality Data originating from ContextShare(RDS)
- Ensure unused tile trees are purged at regular intervals.
- Added API in MessageManager to display either a Toast or Sticky message using React components.
- Always accept point on reality model when snapping and remove message about nearest snap.
- Optimize reality tile display.  
- Add mechanism to preload reality tiles included in an expanded frustum. Support display of ellipsoidal map tiles without depth buffering.
- Reduce the number of surface shader variations by 75%
- react to new clients packages from imodeljs-clients
- Temporarily reinstated OidcBrowserClient and marked it deprec
- remove decorationDiv member of DecorateContext.
- Add ways to set contextId for BlankConnection
- Remove deprecated static PluginAdmin.loadPlugin and PluginAdmin.register methods.  Use the new IModelApp.pluginAdmin versions of the methods.
- Remove 'const' from exported enums.
- Fix being unable to roll wheel to zoom while rotating the view (merge error).
- Upgrade to Rush 5.23.2
- #301812 #288370 Fix label font specifications. Added max label width option to Marker.
- Made management of loaded tiles and tile trees more robust, particularly in context of multiple viewports; fixed tile progress statistics for reality/map tiles.
- Added some shader debug features
- support for editing
- The API for snapshot iModels is now public.
- Add SnapshotConnection.openRemote
- Add SnapshotConnection.isRemote
- Rename iModel.js Plugins to iModel.js Extensions
- Synch drape tile tree settings when terrain settings change.
- Tentative snap should not hilite reality models.
- Add API and shader system for thematic display.
- Alpha feature: thematic sensor display.
- Limit the number of simultaneously-active requests for TileTreeProps.
- Move Tiles and EditingFunctions out of IModelConnection namespace.
- Replaced ViewManager.onNewTilesReady with TileAdmin events.
- Clean up Tile and TileTree APIs.
- #271737 Fix handle2dRotateZoom
- Fix exception when an extension fails to load.
- Prevent edges of nearly-coincident surface from showing through another element.
- Prevent text background color from being overridden by FeatureSymbology.Overrides; fix ugly raster text when transparency is overridden to zero.
- Promoted some @beta to @public in Ui packages & ToolAssistance for 2.0 release.
- Add ToolAdmin method that allows tool to send UI Sync Event messages.
- Moved Property classes and interfaces to ui-abstract package.
- Update tools to use the new BaseDialogItem for lock toggles in Tool Settings specifications.
- Update tools that use the DefaultToolSettingsProvider to match its refactor using DialogItem interfaces rather that ToolSettings classes.
- Update to use UiItemManager
- Ensure view extents are updated when iModel's displayed extents change (e.g. when loading reality models).
- Update release tags and documentation for Tile-related APIs.
- Remove support for the iModel.js module system by no longer delivering modules.
- decrease default durations for viewing operations
- #281634 - make use of WebGL2 bit-wise ops
- Prevent white-on-white reversal from applying to decorations and reality models.
- Prevent exceptions in Firefox when more than one viewport is open and one is resized such that its width or height is zero.

## 1.14.1
Wed, 22 Apr 2020 19:04:00 GMT

### Updates

- Documentation

## 1.14.0
Tue, 31 Mar 2020 15:44:19 GMT

### Updates

- #269633 #285220 Wrong LocateResponse when 1st HitList entry isn't the accepted hit.
- Tentative snap should not hilite reality models.
- Ensure view decorations are scaled by device-pixel ratio.

## 1.13.0
Wed, 04 Mar 2020 16:16:31 GMT

### Updates

- #275962 Fix EmphasizeElements.toJSON for color overrides

## 1.12.0
Wed, 12 Feb 2020 17:45:50 GMT

### Updates

- #269169 Cancel drag operations when button is released outside of view. Suspend view tool animation when cursor moves out of view.
- Option to omit area patterns from tiles.
- Ignore ReadPixels calls when using GpuProfiler
- iModel write API development
- Fix broken links
- Fix regression causing background map to be affected by view's symbology overrides.
- Added support for backward slashes in erroneous URLs of Reality Data in PW Context Share
- Prevent reuse of cached tiles after project extents change.
- VSTS#256133: Fixed issue with reopening connections if the backend crashes. Fixes to integration tests. 
- Fix incorrect aspect ratio for 3d view attachments.
- Overriding transparency of a textured surface or raster text multiplies the texture alpha by the override rather than replacing it.
- Better documentation of OidcDesktopClient/IOidcFrontendClient
- Consolidate ViewState code shared with backend's ViewDefinition using ViewDetails.
- Add support for plan projection models with 3d display priority.
- Customizable display of plan projection models.
- Break up System.ts into modular files.
- Fix setAuxiliaryCoordinateSystem
- Reduced the number of tiles that must be loaded before a zoomed-in view is complete.
- Resolve circular dependencies between tile-related types.
- Support for TypeDoc 0.16.8
- Mark as deprecated classes and interfaces that have moved to bentley/ui-abstract.
- Change feature tracking API for plugins as requested by Design Review. 
- EN: #124601 - Initial implementation of WebGL2

## 1.11.0
Wed, 22 Jan 2020 19:24:12 GMT

### Updates

- For fit, adjust the aspect ratio so that one dimension is increased rather than just adjusting Y.
- Fixed minor typo on RealityData rootDocument property
- TileAdmin.Props.useProjectExtents now defaults to true for better performance.
- Ensure ViewState3d's with camera enabled always have the eyepoint centered when they're created
- Fix aspect ratio adjustment bug in camera views
- Small fix for Fit when aspectRatioSkew isn't 1.0.
- Fix shadows not updating after clearing emphasized/isolated elements.
- Simplify iterator for GeometryList.
- Fix shadow rendering on MacOS Safari and any other unknown client that could fail in the same way.
- Native apps can now cancel tile requests in progress on the backend.
- Reduce tile level-of-detail (thereby improving FPS and memory usage) for models that are small relative to the project extents.
- Remvoe echo test function from devTools
- #258853 Fix for pickDepthPoint
- Add isSpatiallyLocated and isPlanProjection to GeometricModel3dState.
- Added primitive composite value.
- Make hilite and flash target syncing not depend on BeTimePoint.
- Upgrade to TypeScript 3.7.2.
- Add a FeatureToggleClient to iModelApp.
- Gracefully handle an invalid acs id
- ViewZoom not sets focus from depth point.
- #257813 Rest zoom and look tools is mouse wheel is used to zoom.

## 1.10.0
Tue, 07 Jan 2020 19:44:01 GMT

### Updates

- Clear reality tile children loading flag when selecting. 
- Animate change view operations
- Average the gpu profiler times for the last 120 frames instead of updating each frame; also simplify PerformnaceMetrics
- Implement tile availability testing for Cesium World Terrain.
- Return error message from concurrent query manager
- Fixed some bugs associated with device pixel ratio.
- Fix flickering view when zooming in/out while a section clip is applied.
- Adjust focus plane when zooming with mouse wheel.
- Prevent analysis style from overriding texture image for non-animated surfaces.
- Do not force unload of children on reality tile trees as these may be shared among viewports.
- Added support for displaying images embedded in a GeometryStream.
- Added IModelConnection.onOpen event."
- Regenerate shadow map when feature symbology overrides change.
- Use parent if reality tile children are loading.
- Allow events to be sent from backend to frontend
- Fixed Viewport.turnCameraOn() having no effect if the contents of the viewport have uniform depth.
- Set focus distance from depth point for viewing tools.
- Start of new walk tool using mouse + keyboard and touch controls.
- Reduce redundancy between CPU and GPU timers, creating a single interface for this; update display performance tests to save both CPU and GPU data (if available)
- Use pointerlockchange event to make sure it's supported.
- Reduced CPU overhead of computing uniform variable values.
- Moved tile IO-related APIs from frontend to common.
- #254280 #254276 Address "jump" when starting touch viewing operations.
- Add features prop to iModelApp and specify a default implementation for FeatureTrackingManager.
- Move PluginUiManager and PluginUiProvider to ui-abstract package.
- Use onTouchMoveStart for control sticks. Fix issue with key transiton.
- LookAndMoveTool change to use mouse look instead of treating mouse like a control stick.
- Add setting to easily disable pointer lock for walk tool.
- Fix walk tool pan when is 2d or camera is off
- Fix edges of surfaces in 2d views sometimes showing through surfaces in front of them.

## 1.9.0
Tue, 10 Dec 2019 18:08:56 GMT

### Updates

- Logo dialog is now modal.
- Animate mouse wheel zooms
- Align cartesian coordinates when attaching reality models.
- Animate applying saved views
- Code quality report fixes
- Make iModel.js viewports adhere to DPI of a host display.
- Code cleanup from codeQL hits
- Setup OidcDesktopClient for Electron use cases. 
- Don't execute our event loop if there is no need
- Fix regression causing animation to be uneven.
- Fix warnings from static analysis
- Don't use map tiles until reprojection is complete.
- Volume Clasify reality data only
- Don't fade grid refs when camera is off, draw based on count. Simplify modal dialog auto close.
- Treat half-floats and full-floats the same.
- Added WebGLDisposable interface with defined 'isDisposed' member
- Fix regression in EmphasizeElements.overrideElements() when both color and alpha are overridden.
- Prevent touch events from firing mouse events when modal dialog is up.
- Fix unintentional darkening of views
- Only align reality models if near same height.
- Added ability to adjust tile size modifier for Viewports to trade quality for performance or vice-versa.
- Add QuantityTypes LengthSurvey and LengthEngineering to provide more formatting options and support for Survey Feet.
- Change zoom view handle to set zoom ratio based on y distance from anchor point.

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- Added iModel.js logo in lower right corner of views.
- Touch move event should not clear viewport animator. Put a time limit on what's considered a touch tap.
- Clip low resolution terrain tiles to their displayable children ranges.
- Fix bing tile attribution.  Optimize map reprojection.
- Logo card link opens in a new tab/window.
- Update PluginAdmin.loadPlugin to accept a plugin path with a url scheme already defined.
- optimized ReadPixels call for when volumes classifiers are in use
- Flashed element wasn't being cleared after a tentative.
- Limit map tile loading in orthographic views.
- Add css styles in IModelApp.ts
- Open logo card on touch start.
- Allow zoom handle to move through depth point.
- Added measure area by points tool. Measure and clip tool decoration improvements.
- Added missing topic descriptions
- When rendering transparent objects during opaque pass, ensure alpha is set to 1.
- Report unsuported snap mode for view independent geometry when not using origin snap instead of unsnappable subcategory
- Rework reality model loading to preload tiles.
- Added method to Plugin that allows a Plugin to control whether the "loaded" message appears on repeated loads of same Plugin.
- When a reality tile is not present use higher resolution tiles if ready.
- Fix excessive number of tile requests when solar shadows are enabled.
- Change shadow bias to 0.1
- Ensure only surfaces cast shadows.
- Tweak map and terrain tile loading.
- Improve user experience by not displaying underresolved tiles.
- Add support for view-independent display.
- View target center handle now uses depth preview point instead of AccuSnap.
- Added depth point preview for rotate, pan, and zoom tools.
- When depth point is from an element hit, flash the element too.
- Depth preview refinement and new view tool cursors.
- Simplify walk tool by using Viewport Animator interface
- Add walk cursor
- Fix shadows failing to draw after resizing a viewport.
- Use Viewport.animate for zoom and scroll tools

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

### Updates

- Anisotropic filting of draped map tiles.
- Add debug tool for drape frustum.
- Added MarkerSet.changeViewport
- Allow sub classes of OidcBrowserClient to override the settings passed to the underlying oidc-client library. 
- Tweaks to ambient occlusion settings.
- Fixed issues with use of OIDC AuthCode workflow in Electron and Single Page Applications.
- Update DefaultToolSettingsProvider to create responisve UI.
- Reduce size of Cesium ION copyright logo.
- Cleanup AO settings.
- Added badge support to context menu items. Moved some Plugin Ui definitions to ui-abstract.
- Concatenate projection and model matrix to avoid jitter.
- Make toJSON methods of EmphasizeElements and FeatureSymbology.Appearance return pure JSON types.
- Added support for English key-ins in addition to translated key-ins
- Simplify fitView. Hypermodeling plugin cleanup.
- Rework perspective frustum calculation for planar projections
- Fix plugin loader to honor the bundleName from the manifest file of the plugin.
- Prevent background map terrain from being affected by default symbology overrides.
- Fix failure to report shader compilation errors to user in debug builds.
- Create terrain tiles about center to correct drape jitter.
- Fix terrain skirt quantization
- Fixes for making volume classifiers work.
- Fixes to volume classifier hilite & flashing
- Fixed EmphasizeElements.wantEmphasis having no effect if neither color nor transparency were overridden.
- Added better control over auto-disposal of decoration graphics.
- New wip plugin for hypermodeling support.
- Added popup toolbar when cursor stops over marker or marker is tapped.
- Add imageUtil functions that are used in Design Review and needed in other packages.
- Improve horizon calculation
- Fixed bug that caused duplicated points to be handled improperly in batched spatial<->geocoord conversions
- MarkerSet applies only to a single ScreenViewport
- Make viewport member of MarkerSet public
- More OIDC fixes for logout of electron apps. 
- Improve performance for multiple viewports.
- Added New badge for UI items
- Cross-platform function to open an image in a new window.
- Reduce planar texture frustum by clipping to view planes.
- Fix planar-classified regions not displaying hilite silhouettes in perspective views.
- Prioritize loading of map tiles.
- RenderSystem.Options.displaySolarShadows now defaults to true; and directScreenRendering has no effect (deprecated).
- Ensure shadows are continually updated using the best available tiles.
- Apply transparency cutoff to shadows
- Ensure transparency threshold takes into account material and feature overrides.
- Make shadows not apply to world decorations
- Reduce threshold for moving camera in planar texture projection
- Added initial ui-abstract package setup
- Added UiAdmin with support for displaying Menus and Toolbars at a location

## 1.6.0
Wed, 09 Oct 2019 20:28:42 GMT

### Updates

- Implement proper flashing and hiliting of classified geometry.
- Add new range that represents the dipslayed extents.  This is currently used to set the displayed depths.
- Dont expand displayed extents for unbounded trees.
- Added support for overriding feature symbology to use a hilite effect.
- Fix display artifacts caused by interpolation of material settings.
- Rework frustum calculation for terrain draping.
- Fix inability to locate polylines and edges if their transparency was overridden.
- Add GPU timing queries for devtools.
- Addressed memory leaks when repeatedly restarting IModelApp (typically only done in tests.)
- Enable display of non-spatial, spatially-located models in spatial views.
- Geometry of planar classifier models is not required to itself be planar.
- Fixes for getting image from readMarkup
- Refine planar texture frustum calculation to handle parallel views.
- Errors during shader program compilation produce exceptions.
- Improve shadow lighting to match shadow direction
- Fixed multiple viewport shadows
- Refine classification frustum calculation.
- Support transparency for terrain and planar classification.
- Tool assistance for viewing tools. Prompt punctuation consistency.

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- AccuDraw Popup Editors. Improved editor sizes. Editor Params improvements.
- Support animation and classification in same tiles.
- Always adjust y dimension for aspectRatioSkew
- Added support for blank IModelConnections
- Added Cesium ION logo; fixed exception when opening a second viewport while terrain, shadows,  or planar classification are enabled.
- Add checkbrowser.js, refine i18n in Tool
- Don't try to correct clip plane handle location when plane has been moved outside project extents. Updated image for two finger drag svg.
- Refine frustum calculation for planar projection to create a tighter fit. 
- Added ViewManager.getElementToolTip for overriding default persistent element tooltip.
- Various EVSM shadow tweaks
- Fix scenario in which a tile request is canceled after its http request completes and it remains perpetually in the request queue.
- Fixed elements failing to draw if transparency was overridden to be exactly 15.
- Fix marker decorations not updating when markers are added or deleted; fix canvas decorations sometimes failing to display in Firefox.
- Fix a problem with direct-screen rendering (black viewport in certain situations).
- Fix edges of instanced geometry failing to respect edge color override defined by display style.
- Fix transparency for some shaders
- Added Viewport.readImageToCanvas() to obtain viewport image as a HTMLCanvasElement with a 2d rendering context.
- Ensure IModelApp.queryRenderCompatibility() always returns an error message if webgl context creation fails.
- Fix failure to locate an element if it also serves as a modeled element for a sub-model.
- Added missing iconSpec to measure and clipping tools.
- Correct ViewClipByPlaneTool icon.
- Add minArgs, maxArgs, and parseAndRun to PluginTool
- Added ToolTipProvider interface to augment tool tips.
- Fix tool tip formatting for terrain.
- Enable display of non-spatial, spatially-located models in spatial views.
- Add public Tool method translateWithNamespace to allow plugins to supply their own localization.
- Support animation of models within RenderSchedule.
- Added support for iterating a Viewport's per-model category visibility overrides.
- Refine planar projection frustum
- Added autoExpand property to PropertyRecord
- Add QuantityFormatter.onInitialized method to set up default formatting and parsing Specs. Update SetupCameraTool to use new LengthDescription (PropertyDescription)
- Only apply pseudo-rtc workaround if no true RTC exist in GLTF
- Performance optimization (benefits non-chromium-based browsers): Render directly to an on-screen canvas when rendering only a single viewport.
- Select elements tool assistance. Add touch inputs, use new qualifier+button mouse inputs.
- Fix for pinch zoom not being smooth.
- Added facility to load plugins specified in settings at startup
- Add ability for QuantityFormatter to generate station formatting.
- Allow cached tiles to be used across revisions as long as the model geometry has not changed.
- Tool Assistance changes per UX Design
- Tool assistance: Measure tools, view clip tools, and touch cursor inputs.
- Added touch entries to ToolAssistanceImage
- Only force update of tool assistance for touch tap that creates the touch cursor.
- Upgrade to TypeScript 3.6.2
- Fix WindowAreaTool full screen cursor. Added selected view frustum debug tool.

## 1.4.0
Tue, 10 Sep 2019 12:09:49 GMT

### Updates

- Register tools for AccuDraw shortcuts to support keyboard shortcuts.
- Partially support animation of classifiers for MicroSoft Poc.
- Prevent ambient occlusion from being applied to unlit geometry.
- Add methods for setting render schedule in display style
- Identify classified reality data to avoid snap using classification element geometry.
- Apply pseudo bias to batch range when tileset has huge offset.
- Add workaround for ContextCapture tiles with large offsets.
- Load bentleyjs-core before geometry-core instead of in parallel from the IModelJsLoader script
- Refine tile corners on reprojection.  Fix bing HTTP request
- Added a new component for the Poc, an icon picker.
- Support symbology overrides with no batchId for render schedules, Plugin case fixes.
- Don't display markers that are very close to eye point.
- Change how Marker scale is computed for views background map displayed.
- Report coordinates to message center for copy to clipboard. Support drawing views.
- Ensure texture memory is properly tracked.
- Add support for GeometricModel.geometryGuid for detecting whether tiles for a model can be reused across versions
- Added access to debugging features to RenderSystem via RenderSystemDebugControl; includes support for forcing webgl context loss and toggling pseudo-wiremesh surface display.
- Support reality model masking via black classifier geometry.
- Support nearest snap for reality models.
- Remove doubling of planar classifier size.  This caused excessive generation time.
- Refine texture projection calculation to include height range (for terrain). 
- Ensure DisplayStyle3dState.sunDirection is synchronized with DisplayStyle3dSettings JSON.
- Clip volume applied to view also applies to reality models.
- Added SetupCameraTool for defining camera by eye point and target point.
- Prioritize requests for reality model tiles based on distance from camera.
- Allow an app to specify touch-specific instructions in tool assistance.
- Tweak tile priorities so that reality models don't block quicker maps and classifiers.
- Call to pickNearestVisibleGeometry on 1st data button almost always succeeds now that acs plane is used, remove from updateTargetCenter.

## 1.3.0
Tue, 13 Aug 2019 20:25:53 GMT

### Updates

- Add a frontend keyin UI and handler.
- Add inertia to Pan and Rotate tools
- Add test to avoid crash on null view
- Add support for BackstageComposer so Plugins can add backstage items.
- Fix loading bug with IModelConnection.codeSpecs
- Support depth buffered background map and terrain provided through Cesium World Terrain.  Switch to logarithmic Z-Buffer
- Added CursorPopupRenderer to render multiple CursorPopups per RelativePosition.
- Added CursorPrompt, improved Pointer messages
- Added support for displaying shadows.
- Fixed inability to select pickable overlay decorations when elements are emphasized or isolated in the viewport.
- EmphasizeElements API for resymbolizing and isolating elements.
- Fix Feature IDs for planar classification picking.
- Use https: to download Plugin files, unless server is localhost
- Correct cutting plane direction for Syncro schedule support.
- Fix element locate occassionally locating transparent areas of textured surfaces.
- Fix DecorateContext.addDecoration() ignoring view background graphic type.
- Fix specular lighting in specific case when specular exponent is zero.
- Improved grid display performance.
- Don't check eyeDot in camera view.
- Grid - fix loop test point, check spacing once when camera is off, don't fade unless decreasing.
- Mass properties tool, report error when selection contains no valid elements for operation.
- Report WebGL context loss to the user.
- Optimized shader programs by moving computations from fragment to vertex shader; implemented material atlases to reduce number of draw calls associated with surface materials.
- Measure distance, don't use cursor location in decorate while suspended.
- Plugin changes to support building to tar files and hosting by external web servers.
- Allow defining points with `number[]` and `{x,y}` or `{x,y,z}`
- Made onClick event handler in LinkElementInfo optional.
- Change SelectTool to always start in pick mode, add better filter explanations.
- Add tool assistance for SelectTool.
- Update SelectTool to set want tool setting property to true.
- Rework map imagery and terrain tile trees to improve display fidelity during panning and zooming.
- If a material specifies a pattern map and transparency, multiply pattern alpha by material alpha.
- Fix a bug in which a tile request could become stuck in the "loading" state.
- Added Tool.parseAndRun to make executing Tools from keyins easier.
- Project point to ACS plane when zooming if an element isn't identify and no background map is displayed.

## 1.2.0
Wed, 24 Jul 2019 11:47:26 GMT

### Updates

- Added optional HTMLElement member to Marker
- Product Backlog Items 148512: OidcBrowserClient can be used for authorization code workflows; Product Backlog Item 148571: Generalized OidcBrowserClient to work with Cesium and SharePoint.
- Catch load errors for Sprites
- Remove colinear clip shape points. Grid spacing is a double.
- Added tests for Spatial Classifications
- Added TileAdmin option to disable "magnification" tile refinement strategy, which can prevent production of extraordinarily large tiles in some cases.
- ViewManager.dropViewport clears tool events associated with the dropped viewport, preventing errors in async event processing code. Added Viewport.isDisposed property.
- Added limited opt-in support for drawing tiles from secondary IModelConnections and locating elements within them. Users must implement tools that can properly handle results like a HitDetail pointing to a different IModelConnection than the one associated with the viewport.
- Fix Viewport.addViewedModels() failing to update view if some models needed to be loaded asynchronously.
- Fix empty message body when display Bing map attribution info.
- Update beta PluginUiProvider interfaces.
- Add support for GroupItemInsertSpec, badges, and svg symbolId in ToolbarItemInsertSpecs
- Added method to get element mass properties.
- Added option to discard alpha channel when converting ImageBuffer to HTMLCanvasElement.
- Measure distance, allow snap outside project extents for version compare. Added measure length, area, and volume tools.
- Various OIDC related fixes - Bugs: 148507, 148508, Product Backlog Items: 148510, 148517, 148522.
- Add PluginUiManager class and PluginUiProvider interface that will be used by Plugins to specify UI components to add to an iModeljs application.
- Choose handle location for for section plane that is visible in the view.
- Temporarily undid change to save tokens in local storage. 
- Added ToolAssistance support and Tool.iconSpec
- The WebGL rendering system now takes advantage of Vertex Array Objects if they are available via an extension.  These provide a measurable performance increase in certain datasets.

## 1.1.0
Mon, 01 Jul 2019 19:04:29 GMT

### Updates

- Added userAgent, renderer, and vendor to WebGLRenderCompatibilityInfo
- Cleaned up background map API
- Support batch Ids in I3dm (instanced) tiles
- Add support for applying bing elevation to background map (Terrain).
- Avoid forwarding tile content request to backend if request is canceled while awaiting content from blob storage.
- Support batch tables in 3d Tilesets.
- Added SelectTool.processMiss method to better support clearing logical selections.
- Clip from element change to try local range XZ or YZ when XY extents aren't valid.
- Added Viewport.onChangeView event to notify listeners when a new ViewState becomes associated with the Viewport.
- Eliminate need to cache tool setting properties by ensuring active tool is available before activeToolChanged event is fired.
- Removed missing group descriptions
- Support draping of background map tiles on reality models.
- Added internal method to retrieve attachments from SheetViewState for use in saving/recalling views.
- Fix for Bing attribution hotspot - was unreliable with elements behind it.
- Fix bing map URL template - http: -> https:
- Fix background map tile when child not found.
- Fix failure to use geocoordinate system to transform map tiles.
- Ensure new tiles are loaded when edge display is toggled.
- Fix usage of varyings
- Fix incorrect range computation when Viewport.zoomToPlacementProps encounters a null range.
- Added support for 'HTMLElement | string' for message strings
- Allow index.html to set a CDN from which to load imodeljs external modules.
- Make Viewport.invaildateDecorations @beta, was @internal
- Add default unhandled exception handler to ToolAdmin
- Added feature tracking info to UserInfo obtained by OidcBrowserClient. 
- Ensure we never have two active snap or tooltip requests
- Refine tile selection for map tiles
- Prevent default symbology overrides applying to subcategories whose appearances were explicitly overridden.
- Add option to periodically purge unused tile trees from memory.
- Allow Viewport's readImage() method to resize images as requested.
- Force toolsettings to refresh when a tool is started even if new toolId is same as active toolId.
- Fixed skybox for extreeme otho zoomin
- Exit on uncaught exception in render loop (Electron only)
- Thumbnail size was limited to 64K
- Improve memory management for tile trees.
- Update to TypeScript 3.5
- A Viewport can now be instructed to load models when enabling their display.

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- RPC system now accepts only basic values (primitives, "interface" objects, and binary).
- Updated release tags. 
- Added Viewport.changeViewedModel2d
- Clip shape tool should only set AccuDraw rotation on 1st point.
- Fix a prompt. Clip from element change to ignore selection set containing clip transient.
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
- Constructors for BeButtonEvent classes now take props argument
- Remove back face culling option due to lack of performance benefit and other observations
- Increase precision of clipping by transforming clip planes off the GPU.
- Change ModifyElementSource to internal.
- Added onActiveClipChanged event to ViewClipDecorationProvider instead of having to implement ViewClipEventHandler. Support for named clips using SettingsAdmin (needs integration tests).
- Saved clip integration tests. Change view rotate wheel to only zoom about target center when displayed.
- Support multipass rendering for planar classification for computers that down support multi-target framebuffers
- Refactored and simplified implementation of IModelDb.open
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
- Use HTMLElements for tooltips
- Improve touch cursor visibility. Fix tap on canvas decoration when touch cursor is active.
- Loader finds and loads css files in production mode.

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Support spatial classification of context reality models.
- API methods for adding and removing context reality models
- Account for view clip in adjustZPlanes. Fit view needs to check clipVolume ViewFlag.
- Increase ambient light to .2
- Adds parameter for api-extractor to validate missing release tags
- Eliminate display performance issue caused by normal matrix computation.
- Remove requirement that JavaScript classnames match BIS classnames
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
- Fix handle drag test. Support smart lock wth clip shape tool. Offset all clip planes w/shift.
- View clip fixes and start of tools.
- Fit view support for planes clip primitive. View clipping tools.
- Fix tolerance multiplier for reality models
- Cull geometry outside view clipping volume before drawing.
- Fix root tile range on webmercator tile tree for ground bias.
- Added support for disabling certain capabilities for performance testing
- Adding support for readPixels performance testing
- Prevent tooltip from blocking tool event loop.
- Add test coverage in frontend
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
- When loading a perspective view, fix up potentially bad camera settings.
- Reduce mininum front clip.
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
- Eliminate depedency on JavaScript class names for EnityState subclasses
- Add support for appending GeoJson to existing IModel
- Use default background map type if an invalid type is specified in JSON.
- Ensure queries for large numbers of subcategories are paged appropriately.
- Improve graphics performance in Firefox.
- Only use instancing optimization if the system supports instancing.
- update Sprite after it is loaded
- Introduce LoggerCategory enum to advertise logger categories used by this package.
- Logging fixes.
- Put sourcemap in npm package.
- Documentation cleanup
- Add SVG to ImageSourceFormat
- Add imodeljs-markup
- Added vpDiv between parent and canvas
- Allow a view's extent limits to be overridden.
- Update measure distance tooltip on click. Improve total distance visibility.
- Add alpha tags to PropertyEditorParams interfaces that are not ready for public use.
- Improved performance of multipass rendering
- Improve default rotate point for navigation cube
- Fixes to OidcBrowserClient.
- Optimize frontend renderer's performance by minimizing allocations of float arrays passed to the GPU.
- Add more discrete, efficient Viewport synchronization events.
- Added the ability to override category visibility on a per-model basis.
- Rework projection of planar classifiers
- Refactor classification  rename to SpatialClassification
- Remove "assembly lock" from SelectTool now that SelectionScope has been implemented.
- Remove IModelApp subclasses
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
- Don't draw Sprite before it is loaded
- Unit tests and fixed ColorEditor alignment
- Fix errors on Linux caused by case-sensitivity and shader optimizations.
- Upgrade TypeDoc dependency to 0.14.2
- Update the primitive types to be within a Primitives namespace.
- Allow IModelApp subclass to override applicationId & applicationVersion
- Revert static inheritance in IModelApp.ts
- Wrap applicationId & applicationVersion in IModelApp
- Changes to build process to put all JavaScript files in version-specific subdirectories to avoid browser caching problems when deploying new versions.
- View undo only saves changes to ViewState, not categories, models, or diplayStyle
- Clip tool changes now that undo/redo does not affect clipping. Right-click menu support for clip handles.
- Only save viewing volume for view undo rather than cloning ViewState
- Tools to create and modify view clip.
- Reality data shown as Model and picker
- World decorations ignore symbology overrides defined for the view.

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Add ColorEditor to list of available Type Editors including new ColorParams to specify set of colors.
- FitViewTool enhancement to fit to isolated elements or clip volume.
- Supply additional statistics for monitoring tile requests.
- Resolve transparency rendering error in multi-pass compositor due to way textures are bound.
- Cleaned up documentation related to the display system.
- Use bubble-up for keyboard events
- Plugin Enhancements
- Documentation for Skybox
- Added vertex handles for line/arrow markup.

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- Add ios oidc client
- geometry-core camel case
- Add Selection Scope toolsettings to SelectTool.
- Allow subclasses of Range to use static methods
- Raise events when a Viewport's always- or never-drawn element sets change.
- OIDC changes needed for Angular client
- Changes package.json to include api-extractor and adds api-extractor.json
- Default SelectTool to select all members of the selected element's assembly.
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
- Example code (in comments) for frustum interpolator
- Consistent naming of "get" methods in Growable arrays.
- Add EmphasizeElements to/from wire format methods
- Draw non-emphasized elements in "fade-out", non-locatable mode.
- Move neverDrawn/alwaysDrawn to Viewport they are not part of the persistent ViewState. Change Viewport.addFeatureOverrides to an interface.
- Rework and simplify ecef transform for reality models.
- Correct ID for loading classifier trees.
- Fix clipping volume being inconsistently applied to view.
- Don't make textures transparent unless technique enables it.
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
- Added markup mode
- Events are now on ScreenViewport.parentDiv rather than canvas
- Update for geometry GrowableXYArray usage.
- Measure Distance - change selected segment hilite. Measure Location - WIP use ecef transform.
- Make it possible to define editor params for default Type Editors not explicitly specified by name.
- Fixed a bug which caused non-locatable geometry to be rendered when no other symbology was overridden.
- Defer loading of edges until needed
- Omit animation branches that are not visible.
- Improve efficiency and completeness of SubCategory loading for ViewStates.
- Save BUILD_SEMVER to globally accessible map. PluginAdmin and Plugin classes defined. IModelJsLoader improved.
- Add optional iModel argument to EntityState.clone 
- Added GeometricModelState.queryModelRange
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
- Make view transition animations smoother
- Optimizations to tile format and schedule animation.
- Tile requests can optionally specify a retryInterval.
- Cleanup of DefaultToolSetting provider and EnumButtonGroup editor including new EditorParams.
- Move property definitions to imodeljs-frontend so they could be used by tools to define properties for tool settings. Add toolsettings to Select Tool.
- Added a new property to PropertyRecord - links.
- IModelConnection.connectionTimeout is public to allow application customization.
- Upgrade to TypeScript 3.2.2

## 0.188.0
Wed, 16 Jan 2019 16:36:09 GMT

### Updates

- Report unsigned measure distance deltas.
- Add batch id to schedule scripts
- Add batchID to schedule scripts
- Handle wider variety of GLTF bounding boxes etc.

## 0.187.0
Tue, 15 Jan 2019 15:18:59 GMT

_Version update only_

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
- Enable path interpolation
- Enable schedule animation
- If view delta is too large or small, set it to max/min rather than aborting viewing operations.
- Fix transform order when pushing branch.
- Implement quaternion interpolation for Synchro schedule animation
- Remove trash files
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
- Turn off locate circle when mouse leaves a view

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

- Route map tiles over https

## 0.174.0
Mon, 10 Dec 2018 13:24:09 GMT

### Updates

- Touch tap with AccuSnap enabled now brings up a decoration planchette to help choose the snap point.

## 0.173.0
Thu, 06 Dec 2018 22:03:29 GMT

### Updates

- Map api cors fix
- Fix failure to display Bing maps logo.
- Fix "maximum window" error when viewing large drawings.

## 0.172.0
Tue, 04 Dec 2018 17:24:39 GMT

### Updates

- Changed index file name to match package name. Change imports to use other packages' index file.

## 0.171.0
Mon, 03 Dec 2018 18:52:58 GMT

### Updates

- WIP: add support for schedule animation (symbology).
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

_Version update only_

## 0.168.0
Sat, 17 Nov 2018 14:20:11 GMT

_Version update only_

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

_Version update only_

## 0.160.0
Wed, 17 Oct 2018 18:18:38 GMT

_Version update only_

## 0.159.0
Tue, 16 Oct 2018 14:09:09 GMT

_Version update only_

## 0.158.0
Mon, 15 Oct 2018 19:36:09 GMT

_Version update only_

## 0.157.0
Sun, 14 Oct 2018 17:20:06 GMT

### Updates

- Fixing scripts for linux

## 0.156.0
Fri, 12 Oct 2018 23:00:10 GMT

### Updates

- Initial release

