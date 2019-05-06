/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export * from "./Markup";
export * from "./MarkupTool";
export * from "./RedlineTool";
export * from "./SelectTool";
export * from "./TextEdit";
export * from "./Undo";
export * from "./SvgJsExt";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("imodeljs-markup", BUILD_SEMVER);
}

/** @docs-package-description
 * The ($markup) package supplies tools for creating, editing, and saving SVG-based markups of iModel.js Viewports.
 */
/**
 * @docs-group-description MarkupApp
 * Classes for configuring and administering the markup system.
 */
/**
 * @docs-group-description MarkupTools
 * Classes for supplying interactive tools for creating and editing markup elements.
 */
