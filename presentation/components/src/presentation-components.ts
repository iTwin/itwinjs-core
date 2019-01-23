/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Components */

/** @module Common */
export { ContentBuilder } from "./common/ContentBuilder";
export { ContentDataProvider } from "./common/ContentDataProvider";

/** @module PropertyGrid */
export { IPresentationPropertyDataProvider, PresentationPropertyDataProvider } from "./propertygrid/DataProvider";
export { propertyGridWithUnifiedSelection } from "./propertygrid/WithUnifiedSelection";

/** @module Table */
export { IPresentationTableDataProvider, PresentationTableDataProvider } from "./table/DataProvider";
export { tableWithUnifiedSelection } from "./table/WithUnifiedSelection";

/** @module Tree */
export { PresentationTreeDataProvider } from "./tree/DataProvider";
export { IPresentationTreeDataProvider } from "./tree/IPresentationTreeDataProvider";
export { treeWithUnifiedSelection } from "./tree/WithUnifiedSelection";
export { treeWithFilteringSupport } from "./tree/WithFilteringSupport";

/** @module Viewport */
export { viewWithUnifiedSelection } from "./viewport/WithUnifiedSelection";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
/* istanbul ignore next */
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("presentation-components", BUILD_SEMVER);
}
