/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export * from "./FrontEndDevTools";

export * from "./tools/ChangeViewFlagsTool";
export * from "./tools/EmphasizeElementsTool";
export * from "./tools/FrustumDecoration";
export * from "./tools/ProjectExtents";
export * from "./tools/RenderSystemTools";
export * from "./tools/RenderTargetTools";
export * from "./tools/ReportWebGLCompatibilityTool";

export * from "./ui/Button";
export * from "./ui/CheckBox";
export * from "./ui/ColorInput";
export * from "./ui/ComboBox";
export * from "./ui/NestedMenu";
export * from "./ui/NumericInput";
export * from "./ui/RadioBox";
export * from "./ui/Slider";
export * from "./ui/TextBox";

export * from "./widgets/DiagnosticsPanel";
export * from "./widgets/FpsTracker";
export * from "./widgets/KeyinField";
export * from "./widgets/MemoryTracker";
export * from "./widgets/TileStatisticsTracker";
export * from "./widgets/ToolSettingsTracker";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("frontend-devtools", BUILD_SEMVER);
}

/**
 * @docs-group-description UiWidgets
 * Functions for creating basic UI widgets.
 */
