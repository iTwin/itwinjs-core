---
publish: false
---
# NextVersion

Table of contents:

<<<<<<< HEAD
- [AppUi](#appui)
  - [Static manager classes](#static-manager-classes)
=======
- [Updated minimum requirements](#updated-minimum-requirements)
  - [Node.js](#node-js)
  - [WebGL](#webgl)
  - [Electron](#electron)
- [Mesh offset](#mesh-offset)
- [Mesh intersection with ray](#mesh-intersection-with-ray)
>>>>>>> 38cb1be0ce (new ray-mesh intersection methods (#5110))

## AppUi

### Static manager classes

In an effort to reduce usage complexity and discoverability of this package, many `*Manager` classes are now exposed through the `UiFramework` entry point. The direct classes access is being deprecated.

Each `initialize` method have been made internal and were always called automatically internally, call to these method can be safely removed from external code.

Below is a list of the changes from this move, some of these new access point may be reworked to further reduce the complexity, so they are marked `@beta`. Already `@deprecated` method were not moved to the new interfaces.

<<<<<<< HEAD
| Original access | New access |
|---|---|
 ConfigurableUiManager.addFrontstageProvider | UiFramework.frontstages.addFrontstageProvider
 ConfigurableUiManager.loadKeyboardShortcuts | UiFramework.keyboardShortcuts.loadKeyboardShortcuts
 ConfigurableUiManager.registerControl | UiFramework.controls.register
 ConfigurableUiManager.isControlRegistered | UiFramework.controls.isRegistered
 ConfigurableUiManager.createControl | UiFramework.controls.create
 ConfigurableUiManager.unregisterControl | UiFramework.controls.unregister
 ConfigurableUiManager.initialize |
 ConfigurableUiManager.loadTasks |
 ConfigurableUiManager.loadWorkflow |
 ConfigurableUiManager.loadWorkflows |
 ConfigurableUiManager.initialize |
 ConfigurableUiManager | UiFramework.controls
 KeyboardShortcutManager.initialize |
 KeyboardShortcutManager | UiFramework.keyboardShortcuts
 FrontstageManager.initialize |
 FrontstageManager.setActiveLayout | UiFramework.content.layouts.setActive
 FrontstageManager.setActiveContentGroup | UiFramework.content.layouts.setActiveContentGroup
 FrontstageManager | UiFramework.frontstages
 ToolSettingsManager.initialize |
 ToolSettingsManager | UiFramework.toolSettings
 ContentLayoutManager.getLayoutKey | UiFramework.content.layouts.getKey
 ContentLayoutManager.getLayoutForGroup | UiFramework.content.layouts.getForGroup
 ContentLayoutManager.findLayout | UiFramework.content.layouts.find
 ContentLayoutManager.addLayout | UiFramework.content.layouts.add
 ContentLayoutManager.setActiveLayout | UiFramework.content.layouts.setActive
 ContentLayoutManager.refreshActiveLayout | UiFramework.content.layouts.refreshActive
 ContentLayoutManager | UiFramework.content.layouts
 ContentDialogManager.initialize |
 ContentDialogManager.openDialog | UiFramework.content.dialogs.open
 ContentDialogManager.closeDialog | UiFramework.content.dialogs.close
 ContentDialogManager.activeDialog | UiFramework.content.dialogs.active
 ContentDialogManager.dialogCount | UiFramework.content.dialogs.count
 ContentDialogManager.getDialogZIndex | UiFramework.content.dialogs.getZIndex
 ContentDialogManager.getDialogInfo | UiFramework.content.dialogs.getInfo
 ContentDialogManager | UiFramework.content.dialogs
 ContentViewManager | UiFramework.content
 ModalDialogManager.openDialog | UiFramework.dialogs.modal.open
 ModalDialogManager.closeDialog | UiFramework.dialogs.modal.close
 ModalDialogManager.activeDialog | UiFramework.dialogs.modal.active
 ModalDialogManager.dialogCount | UiFramework.dialogs.modal.count
 ModalDialogManager | UiFramework.dialogs.modal
 ModelessDialogManager.initialize |
 ModelessDialogManager.openDialog | UiFramework.dialogs.modeless.open
 ModelessDialogManager.closeDialog | UiFramework.dialogs.modeless.close
 ModelessDialogManager.activeDialog | UiFramework.dialogs.modeless.active
 ModelessDialogManager.dialogCount | UiFramework.dialogs.modeless.count
 ModelessDialogManager.getDialogZIndex | UiFramework.dialogs.modeless.getZIndex
 ModelessDialogManager.getDialogInfo | UiFramework.dialogs.modeless.getInfo
 ModelessDialogManager | UiFramework.dialogs.modeless
 UiShowHideManager | UiFramework.visibility
 UiFramework.childWindowManager.openChildWindow | UiFramework.childWindows.open
 UiFramework.childWindowManager.findChildWindowId | UiFramework.childWindows.findId
 UiFramework.childWindowManager.closeAllChildWindows | UiFramework.childWindows.closeAll
 UiFramework.childWindowManager.closeChildWindow | UiFramework.childWindows.close
 UiFramework.backstageManager | UiFramework.backstage
=======
Web browsers display 3d graphics using an API called [WebGL](https://en.wikipedia.org/wiki/WebGL), which comes in 2 versions: WebGL 1, released 11 years ago; and WebGL 2, released 6 years ago. WebGL 2 provides many more capabilities than WebGL 1. Because some browsers (chiefly Safari) did not provide support for WebGL 2, iTwin.js has maintained support for both versions, which imposed some limitations on the features and efficiency of its rendering system.

Over a year ago, support for WebGL 2 finally became [available in all major browsers](https://www.khronos.org/blog/webgl-2-achieves-pervasive-support-from-all-major-web-browsers). iTwin.js now **requires** WebGL 2 - WebGL 1 is no longer supported. This change will have no effect on most users, other than to improve their graphics performance. However, users of iOS will need to make sure they have upgraded to iOS 15 or newer to take advantage of WebGL 2 (along with the many other benefits of keeping their operating system up to date).

[IModelApp.queryRenderCompatibility]($frontend) will now produce [WebGLRenderCompatibilityStatus.CannotCreateContext]($webgl-compatibility) for a client that does not support WebGL 2.

### Electron

Electron versions from 14 to 17 reached their end-of-life last year, and for this reason, support for these versions was dropped. To be able to drop Node 16, Electron 22 was also dropped. iTwin.js now supports only Electron 23.

## Mesh offset

The new static method [PolyfaceQuery.cloneOffset]($core-geometry) creates a mesh with facets offset by a given distance. The image below illustrates the basic concepts.

![Offset Example 1](./assets/cloneOffsetMeshBoxes.png "Original box mesh, offset box, and chamfered offset box")

At left is the original box, size 3 x 5 in the large face and 2 deep. The middle is constructed by `cloneOffset` with offset of 0.15 and default options. Note that it maintains the original sharp corners. The right box is constructed with [OffsetMeshOptions.chamferAngleBetweenNormals]($core-geometry) of 80 degrees. This specifies that when the original angle between normals of adjacent facets exceeds 80 degrees the corner should be chamfered, creating the slender chamfer faces along the edges and the triangles at the vertices. The default 120 degree chamfer threshold encourages corners to be extended to intersection rather than chamfered.

The image below illustrates results with a more complex cross section.

![Offset Example 2](./assets/cloneOffsetMeshExample2.png "Offset with sharp corners and with chamfers.")

The lower left is the original (smaller, inside) mesh with the (transparent) offset mesh around it with all sharp corners. At upper right the offset has chamfers, again due to setting the `chamferAngleBetweenNormals` to 120 degrees.

## Mesh intersection with ray

New functionality computes the intersection(s) of a [Ray3d]($core-geometry) with a [Polyface]($core-geometry). By default, [PolyfaceQuery.intersectRay3d]($core-geometry) returns a [FacetLocationDetail]($core-geometry) for the first found facet that intersects the infinite line parameterized by the ray. A callback can be specified in the optional [FacetIntersectOptions]($core-geometry) parameter to customize intersection processing, e.g., to filter and collect multiple intersections. Other options control whether to populate the returned detail with interpolated auxiliary vertex data: normals, uv parameters, colors, and/or the barycentric scale factors used to interpolate such data.

There is also new support for intersecting a `Ray3d` with a triangle or a polygon. [BarycentricTriangle.intersectRay3d]($core-geometry) and [BarycentricTriangle.intersectSegment]($core-geometry) return a [TriangleLocationDetail]($core-geometry) for the intersection point of the plane of the triangle with the infinite line parameterized by a ray or segment. Similarly, [PolygonOps.intersectRay3d]($core-geometry) returns a [PolygonLocationDetail]($core-geometry) for the intersection point in the plane of the polygon. Both returned detail objects contain properties classifying where the intersection point lies with respect to the triangle/polygon, including `isInsideOrOn` and closest edge data.
>>>>>>> 38cb1be0ce (new ray-mesh intersection methods (#5110))
