# Change Log - @bentley/imodeljs-frontend

This log was last generated on Fri, 21 Sep 2018 23:16:13 GMT and should not be manually modified.

## 0.129.0
Fri, 21 Sep 2018 23:16:13 GMT

### Updates

- Added customized pointer messages to ViewsFrontstage
- Rework animation data to pack values and simplify extraction.
- Fix assertions when loading map tiles.
- Exclude contents of /frontend/render/webgl/ from SDK docs.
- WIP #34205 - Selection of classifiers for reality data.
- Initial implementation of quantity formatting package, tests, and example usage in IModelApp.
- Increase darkening of unclassified geometry.  Don't flash reality models. (For Bob Mankowsky YII)
- WIP - Classification darkening of outside.
- WIP #34200 and #34205 - Add select and flash to classified reality data.

## 0.128.0
Fri, 14 Sep 2018 17:08:05 GMT

### Updates

- Should not call updateDynamics from onTimerEvent. Fix AccuDraw hint/dynamic interaction.
- Fix AccuSnap error sprite display.
- added ViewChangeOptions for zoom/scroll methods of Viewport

## 0.127.0
Thu, 13 Sep 2018 17:07:11 GMT

### Updates

- rename overlay2dDecoration to canvasDecoration
- added methods to zoom to elements by ids, props, or placements.

## 0.126.0
Wed, 12 Sep 2018 19:12:10 GMT

*Version update only*

## 0.125.0
Wed, 12 Sep 2018 13:35:50 GMT

### Updates

- Ray3d.intersectionWithPlane fix !number instead of checking undefined. Added project point to line or plane in view helper methods for tools.
- SimpleViewTest - Moved incident marker and project extents under test tool menu.
- TentativePoint.setCurrSnap needs to reset adjustedPoint from a pre-located SnapDetail.

## 0.124.0
Tue, 11 Sep 2018 13:52:59 GMT

### Updates

- SelectTool EditManipulator support.
- Added EditManipulator arrow controls.

## 0.123.0
Wed, 05 Sep 2018 17:14:50 GMT

### Updates

- AccuDraw nearest snap intersection should use single segment of linestring. Support nearest snap with locked distance
- PBI#30301: Add ability to reuse briefcases when opening a new IModelConnection/IModelDb. <br/> Opening a new ReadWrite IModelConnection at the frontend would try and reuse any existing briefcase that was previously opened by the same user. Opening a new Exclusive IModelDb at the backend can be configured to reuse or create/acquire a new briefcase. <br/> PBI#30302: Add method to purge the briefcase manager cache. <br/> When backend instances are brought down it's important that any briefcases they acquired from the Hub be properly disposed of. The iModelHub imposes an artificial limit of 20 briefcases per user, and acquiring more briefcases will cause an error.Added a new BriefcaseManager.purgeCache() method to help with this - the method closes any open briefcases, deletes the registered briefcase id from the Hub, and deletes the physical cache folder containing the Dbs. Note that the accessToken passed in to the method must match the accessToken used to acquire any briefcases that are to be deleted - so this only works in the limited environment where the entire cache was hydrated for the same user.
- AccuDraw shortcuts. Make it easier to use AccuDraw and dynamics with an InputCollector.

## 0.122.0
Tue, 28 Aug 2018 12:25:19 GMT

### Updates

- Fix clipping shader compilation errors on iOS.
- AccuDraw compute intersection with nearest snap. AccuDraw smart rotation.
- Fix FPS and Render Time shown in the SimpleViewTest app.
- added ScreenViewport. You must now call ScreenViewport.create to create viewports

## 0.121.0
Fri, 24 Aug 2018 12:49:09 GMT

### Updates

- Constructor for Viewport now takes an HTML div as the argument, creates the canvas, and adds it to the div. Bing logo now drawn when Bing background maps are drawn.

## 0.120.0
Thu, 23 Aug 2018 20:51:32 GMT

### Updates

- rework deocorator api. Eliminated Decoration and DecorationList. New interface for Decorators that are added/dropped from ViewManager.

## 0.119.0
Thu, 23 Aug 2018 15:25:49 GMT

### Updates

- AccuDraw fixes

## 0.118.0
Tue, 21 Aug 2018 17:20:41 GMT

### Updates

- convertTouchMoveStartToButtonDownAndMotion now calls onMouseStartDrag. Added SelectTool touch support.
- ViewManip touch event support. Don't disable snapping when touch move converted to mouse motion.
- Fix TransientIdSequence. Fix AccuSnap.findLocatableHit not setting filtered status.
- TSLint New Rule Enforcements
- Updated to use TypeScript 3.0

## 0.117.0
Wed, 15 Aug 2018 17:08:54 GMT

### Updates

- WIP: Reality mesh classification via stencil volumes

## 0.116.0
Wed, 15 Aug 2018 15:13:19 GMT

### Updates

- Documentation

## 0.115.0
Tue, 14 Aug 2018 15:21:27 GMT

*Version update only*

## 0.114.0
Tue, 14 Aug 2018 12:04:18 GMT

### Updates

- Use binary transfer for Sprites
- IdleTool default touch support for pan and pinch zoom.
- Change some AccuSnap, TentativeSnap, and AccuDraw method to property accessors. Remove unused scrollOnNoMotion arg and update method from ViewManip.
- Implemented Look, Scroll, Zoom, and Fly ViewManip handles.
- Added IModelConnection.Views.getThumbnail
- Update view zoom and scroll indicator decorations.
- Supply input source to ElementLocateManager.doLocate, use a larger pick aperture for touch input.
- Sheet view state no longer waits for attachment views to load

## 0.113.0
Fri, 10 Aug 2018 05:06:20 GMT

### Updates

- Fixed bugs in ClipMaskVolume constructor.
- Fix for 2d views attachments modifying transform of their root view
- Code cleanup
- Fix number of varying vectors exceeding maximum on iOS.
- Fix quantization errors with world decorations located far from the origin.
- WIP: Turn on stenciling for use in classification of reality meshes.

## 0.112.0
Tue, 07 Aug 2018 12:19:22 GMT

### Updates

- Support pickable decorations.
- Detect tap and double tap and provide tool methods to handle these events.
- Remove old gesture events. Added onTouchComplete event for when all fingers leave surface.
- Moved tapCount to BeTouchEvent. Added methods to convert touch event to mouse events. Rename onModelMotion to onMouseMotion.
- Added separate ToolSettings for touch move distance and delay.
- Support spherical skybox image projections.
- Support cubemap skybox images.

## 0.111.0
Mon, 06 Aug 2018 19:25:38 GMT

### Updates

- All 3d view attachments overlay correctly.
- 'Fit View' in a sheet view fits to the dimensions of the sheet.
- Fix for not selecting the first sheet tile of 3d view attachment

## 0.110.0
Thu, 02 Aug 2018 14:48:42 GMT

*Version update only*

## 0.109.0
Thu, 02 Aug 2018 09:07:03 GMT

*Version update only*

## 0.108.0
Wed, 01 Aug 2018 14:24:06 GMT

### Updates

- Fixed bugs with simple 3d attachment cases
- Attachment tile 3d bug fixes
- 3d view attachments can be located by tools.
- Updated to use TypeScript 2.9

## 0.107.0
Tue, 31 Jul 2018 16:29:14 GMT

*Version update only*

## 0.106.0
Tue, 31 Jul 2018 13:01:51 GMT

*Version update only*

## 0.105.0
Tue, 31 Jul 2018 11:36:14 GMT

### Updates

- Added OneAtATimePromise for handling mouse move round-trips to the server over slow HTTP connections
- Let IdleTool handle start drag event to install view tools instead of using middle button events. Fixes for tentative points.
- make all tool event methods async
- Added receivedDownEvent to InteractiveTool to check if up events should be sent. ToolAdmin button event cleanup.
- throw away repeated keyboard events. They interfere with mouse motion replacement
- Fix being able to pan when rotate toolis active. Start of touch event support.
- 3d view attachments
- EN: TFS#914011 - Finished Skybox gradient and spherical texture shaders
- 3d view attachments are working

## 0.104.1
Thu, 26 Jul 2018 21:35:07 GMT

### Updates

- Support separate view flags per model.

## 0.104.0
Thu, 26 Jul 2018 18:25:15 GMT

### Updates

- Implement six-sided skybox cubes.
- 2d geometry is properly clipped using ClipMaskVolume
- attachment id array on SheetViewState has type Id64Array
- Maintain image aspect ratio in cubemap skybox.
- Add support for dynamic 3d clipping volumes.

## 0.103.0
Tue, 24 Jul 2018 15:52:31 GMT

### Updates

- Fix import issues in published packages

## 0.102.0
Tue, 24 Jul 2018 14:13:01 GMT

### Updates

- added ToolTip to AccuSnap
- Rotate view tool target handle add. Fixed data button not accounting for snap location.
- Fix getGridPlaneViewIntersections.
- Make reality models locate-able
- computeRootToNpc should not be changing frustFraction
- remove get/setShow methods on ViewFlags. They were redundant.
- Support tentative with RotateView tool.
- alignWithRootZ needs to set corrected rotation on view state.
- Remove remnants of rotation sphere in ViewRotate. Change animateFrustumChange to not default to no animation.
- Don't call animateFrustumChange from applyViewState if animationTime is undefined.
- Updating performance metrics
- Support rendering on iOS.

## 0.101.0
Mon, 23 Jul 2018 22:00:01 GMT

### Updates

- Flash snap curve primitive
- Disable accusnap debugging.
- Fix adjustSnapPoint. Display normal at snap location.
- Fix window area horizontal/vertical decoration line
- Support creating textures from HTML image elements.
- Freeze IModel.projectExtents. Drawing grids was destroying it
- Move snap related setting from ElementLocateManager to AccuSnap.
- Fix white textures while loading reality model tiles.
- Fix import issue in Polyline.ts
- Fix import issue in Primitive.ts
- Handler to reopen a connection if the backend was moved should really be skipped for calls originating from other connections. 
- Viewport supports custom logic for overriding symbology.
- Fix assertion when creating point string graphics
- ClipVolumes are created using rendering system.
- ClipVolume -> RenderClipVolume
- ClipMaskVolume class for clipping view attachments
- Support overriding line pattern symbology.
- TFS#917985: Tweaked the internal mechanism when opening a new IModelConnection for better performance. Added more logging to enable the router/provisioner team to potential diagnose performance issues. 
- Fix transparency in perspective views
- Fix rendering of translucent textures.
- WIP: TFS#914011 - Rendergradient skybox using shader.
- Added optional display of tile bounding volumes for debugging purposes.
- Fix for testing undefined values for colors
- ShaderBuilder dynamically builds shaders incorporating clipping for various clip plane set lengths alongside normal shader programs
- SheetViewState member name cleanup.

