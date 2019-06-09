/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export * from "./Button";
export * from "./CheckBox";
export * from "./ColorInput";
export * from "./ComboBox";
export * from "./NestedMenu";
export * from "./NumericInput";
export * from "./RadioBox";
export * from "./Slider";
export * from "./TextBox";
export * from "./DiagnosticsPanel";
export * from "./FpsTracker";
export * from "./FrustumDecoration";
export * from "./MemoryTracker";
export * from "./TileStatisticsTracker";
export * from "./ToolSettingsTracker";

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
