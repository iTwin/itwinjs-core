---
publish: false
---
# NextVersion

Table of contents:

- [AppUi](#appui)
  - [Static manager classes](#static-manager-classes)

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
