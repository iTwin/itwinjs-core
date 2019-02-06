/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export { default as UiFramework } from "./ui-framework/UiFramework";

export * from "./ui-framework/AppState";
export * from "./ui-framework/FrameworkState";
export * from "./ui-framework/UiFramework";
export * from "./ui-framework/CoreToolDefinitions";

export * from "./ui-framework/clientservices/IModelServices";
export * from "./ui-framework/clientservices/ProjectServices";

export * from "./ui-framework/feedback/ValidationTextbox";
export * from "./ui-framework/feedback/ElementTooltip";

export * from "./ui-framework/messages/InputField";
export * from "./ui-framework/messages/Pointer";

export * from "./ui-framework/oidc/SignIn";
export * from "./ui-framework/oidc/SignOut";

export * from "./ui-framework/openimodel/ApplicationHeader";
export * from "./ui-framework/openimodel/BlockingPrompt";
export * from "./ui-framework/openimodel/IModelCard";
export * from "./ui-framework/openimodel/IModelList";
export * from "./ui-framework/openimodel/IModelOpen";
export * from "./ui-framework/openimodel/IModelViewPicker";
export * from "./ui-framework/openimodel/Navigation";
export * from "./ui-framework/openimodel/ProjectDialog";
export * from "./ui-framework/openimodel/ProjectDropdown";
export * from "./ui-framework/openimodel/ProjectTabs";

export * from "./ui-framework/overallcontent/OverallContent";
export * from "./ui-framework/overallcontent/state";

export * from "./ui-framework/pickers/ListPicker";
export * from "./ui-framework/pickers/ModelSelector";
export * from "./ui-framework/pickers/ViewSelector";

export * from "./ui-framework/messages/AppNotificationManager";
export * from "./ui-framework/configurableui/ConfigurableUiContent";
export * from "./ui-framework/configurableui/ConfigurableUiControl";
export * from "./ui-framework/configurableui/ConfigurableUiManager";
export * from "./ui-framework/content/ContentControl";
export * from "./ui-framework/content/ContentGroup";
export * from "./ui-framework/content/ContentLayout";
export * from "./ui-framework/content/ContentViewManager";
export * from "./ui-framework/dragdrop/DragDropLayerManager";
export * from "./ui-framework/dragdrop/ZoneTargets";
export * from "./ui-framework/frontstage/Frontstage";
export * from "./ui-framework/frontstage/FrontstageComposer";
export * from "./ui-framework/frontstage/FrontstageDef";
export * from "./ui-framework/frontstage/FrontstageManager";
export * from "./ui-framework/frontstage/FrontstageProvider";
export * from "./ui-framework/frontstage/NestedFrontstage";
export * from "./ui-framework/shared/IconComponent";
export * from "./ui-framework/shared/Item";
export * from "./ui-framework/shared/ItemDefBase";
export * from "./ui-framework/shared/ItemMap";
export * from "./ui-framework/shared/ItemProps";
export * from "./ui-framework/keyboardshortcut/KeyboardShortcut";
export * from "./ui-framework/keyboardshortcut/KeyboardShortcutMenu";
export * from "./ui-framework/messages/MessageManager";
export * from "./ui-framework/ModalDialogManager";
export * from "./ui-framework/frontstage/ModalFrontstage";
export * from "./ui-framework/navigationaids/NavigationAidControl";
export * from "./ui-framework/widgets/NavigationWidget";
export * from "./ui-framework/widgets/StackedWidget";
export * from "./ui-framework/messages/StandardMessageBox";
export * from "./ui-framework/widgets/StatusBar";
export * from "./ui-framework/widgets/StatusBarWidgetControl";
export * from "./ui-framework/zones/StatusBarZone";
export * from "./ui-framework/workflow/Task";
export * from "./ui-framework/widgets/ToolbarWidgetBase";
export * from "./ui-framework/widgets/ToolWidget";
export * from "./ui-framework/content/ViewportContentControl";
export * from "./ui-framework/widgets/Widget";
export * from "./ui-framework/widgets/WidgetControl";
export * from "./ui-framework/widgets/WidgetDef";
export * from "./ui-framework/widgets/WidgetFactory";
export * from "./ui-framework/workflow/Workflow";
export * from "./ui-framework/zones/FrameworkZone";
export * from "./ui-framework/zones/toolsettings/ToolSettingsZone";
export * from "./ui-framework/zones/toolsettings/ToolUiProvider";
export * from "./ui-framework/zones/toolsettings/DefaultToolSettingsProvider";

export * from "./ui-framework/zones/Zone";
export * from "./ui-framework/zones/ZoneDef";

export * from "./ui-framework/toolbar/ActionItemButton";
export * from "./ui-framework/toolbar/GroupItem";
export * from "./ui-framework/toolbar/ToolButton";

export * from "./ui-framework/backstage/Backstage";
export * from "./ui-framework/backstage/FrontstageLaunch";
export * from "./ui-framework/backstage/CommandLaunch";
export * from "./ui-framework/backstage/TaskLaunch";

export * from "./ui-framework/navigationaids/CubeNavigationAid";
export * from "./ui-framework/navigationaids/SheetNavigationAid";
export * from "./ui-framework/navigationaids/SheetsModalFrontstage";
export * from "./ui-framework/navigationaids/StandardRotationNavigationAid";

export * from "./ui-framework/settings/Settings";

export * from "./ui-framework/statusfields/ActivityCenter";
export * from "./ui-framework/statusfields/MessageCenter";
export * from "./ui-framework/statusfields/SnapMode";
export * from "./ui-framework/statusfields/PromptField";
export * from "./ui-framework/statusfields/SelectionInfo";

export * from "./ui-framework/tools/AnalysisAnimation";
export * from "./ui-framework/tools/AnalysisAnimationToolSettings";

export * from "./ui-framework/utils/ViewUtilities";
export * from "./ui-framework/utils/redux-ts";
export * from "./ui-framework/utils/PropsHelper";

export * from "./ui-framework/syncui/SyncUiEventDispatcher";
export * from "./ui-framework/syncui/BooleanListener";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("ui-framework", BUILD_SEMVER);
}

/** @docs-package-description
 * The ui-framework package contains application fragments for Login, Project, iModel and View selection,
 * and configuration of the application UI with the Backstage, Frontstages, Widgets, etc.
 * For more information, see [learning about ui-framework]($docs/learning/framework/index.md).
 */
/**
 * @docs-group-description Backstage
 * Classes for working with a Backstage
 */
/**
 * @docs-group-description ClientServices
 * Classes for working with services for iModels, Login and Projects
 */
/**
 * @docs-group-description ConfigurableUi
 * Classes for working with the Application UI Configuration
 */
/**
 * @docs-group-description ContentView
 * Classes for working with a Content View, Group, Layout or Control
 */
/**
 * @docs-group-description Dialog
 * Classes for working with a modal dialog
 */
/**
 * @docs-group-description DragDrop
 * Classes for managing DragDrop API drag layers
 */
/**
 * @docs-group-description Frontstage
 * Classes for working with a Frontstage
 */
/**
 * @docs-group-description Item
 * Classes for working with an Item in a Tool Widget, Navigation Widget or Backstage
 */
/**
 * @docs-group-description KeyboardShortcut
 * Classes for working with Keyboard Shortcuts
 */
/**
 * @docs-group-description NavigationAids
 * Classes for working with Navigation Aids
 */
/**
 * @docs-group-description Notification
 * Classes for working with a Notification or Message
 */
/**
 * @docs-group-description OIDC
 * Classes for working with the OpenID Connect (OIDC) protocol
 */
/**
 * @docs-group-description OpenIModel
 * Classes for working with the UI for opening an iModel
 */
/**
 * @docs-group-description OverallContent
 * Classes for working with the overall content of the application UI
 */
/**
 * @docs-group-description Picker
 * Classes for working with various pickers
 */
/**
 * @docs-group-description Settings
 * Classes for Settings page
 */
/**
 * @docs-group-description State
 * Classes for maintaining state
 */
/**
 * @docs-group-description StatusBar
 * Classes for defining a StatusBar
 */
/**
 * @docs-group-description SyncUi
 * Classes for informing UI components to sync/refresh their display
 */

/**
 * @docs-group-description WorkflowTask
 * Classes for working a Workflow or Task
 */
/**
 * @docs-group-description Tools
 * Core Tool definitions
 */
/**
 * @docs-group-description ToolSettings
 * Classes for working Tool Settings
 */
/**
 * @docs-group-description Utilities
 * Various utility classes for working with a UI and Redux.
 */
/**
 * @docs-group-description Widget
 * Classes for working with a Widget
 */
/**
 * @docs-group-description Zone
 * Classes for working with a Zone
 */
