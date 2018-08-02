# Change Log - @bentley/imodeljs-frontend

This log was last generated on Thu, 02 Aug 2018 14:48:42 GMT and should not be manually modified.

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

