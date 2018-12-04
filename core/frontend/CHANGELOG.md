# Change Log - @bentley/imodeljs-frontend

This log was last generated on Mon, 03 Dec 2018 18:52:58 GMT and should not be manually modified.

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

