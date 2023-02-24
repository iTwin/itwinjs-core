---
publish: false
---
# NextVersion

Table of contents:

- [AppUi](#appui)
  - [Static manager classes](#static-manager-classes)
- [Mesh intersection with ray](#mesh-intersection-with-ray)

## AppUi

### Static manager classes

In an effort to reduce usage complexity and discoverability of this package, many `*Manager` classes are now exposed through the `UiFramework` entry point. The direct classes access is being deprecated.

Each `initialize` method have been made internal and were always called automatically internally, call to these method can be safely removed from external code.

Below is a list of the changes from this move, some of these new access point may be reworked to further reduce the complexity, so they are marked `@beta`. Already `@deprecated` method were not moved to the new interfaces.

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

## Mesh intersection with ray

New functionality computes the intersection(s) of a [Ray3d]($core-geometry) with a [Polyface]($core-geometry). By default, [PolyfaceQuery.intersectRay3d]($core-geometry) returns a [FacetLocationDetail]($core-geometry) for the first found facet that intersects the infinite line parameterized by the ray. A callback can be specified in the optional [FacetIntersectOptions]($core-geometry) parameter to customize intersection processing, e.g., to filter and collect multiple intersections. Other options control whether to populate the returned detail with interpolated auxiliary vertex data: normals, uv parameters, colors, and/or the barycentric scale factors used to interpolate such data.

There is also new support for intersecting a `Ray3d` with a triangle or a polygon. [BarycentricTriangle.intersectRay3d]($core-geometry) and [BarycentricTriangle.intersectSegment]($core-geometry) return a [TriangleLocationDetail]($core-geometry) for the intersection point of the plane of the triangle with the infinite line parameterized by a ray or segment. Similarly, [PolygonOps.intersectRay3d]($core-geometry) returns a [PolygonLocationDetail]($core-geometry) for the intersection point in the plane of the polygon. Both returned detail objects contain properties classifying where the intersection point lies with respect to the triangle/polygon, including `isInsideOrOn` and closest edge data.
