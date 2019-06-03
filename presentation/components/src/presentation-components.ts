/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Components */

/** @module Common */
export { IPresentationDataProvider } from "./common/IPresentationDataProvider";
export { ContentBuilder } from "./common/ContentBuilder";
export { IContentDataProvider, ContentDataProvider, CacheInvalidationProps } from "./common/ContentDataProvider";
export { DataProvidersFactory, DataProvidersFactoryProps } from "./DataProvidersFactory";

/** @module PropertyGrid */
export { IPresentationPropertyDataProvider, PresentationPropertyDataProvider } from "./propertygrid/DataProvider";
export { propertyGridWithUnifiedSelection, PropertyGridWithUnifiedSelectionProps } from "./propertygrid/WithUnifiedSelection";

/** @module Table */
export { IPresentationTableDataProvider, PresentationTableDataProvider, PresentationTableDataProviderProps } from "./table/DataProvider";
export { tableWithUnifiedSelection, TableWithUnifiedSelectionProps } from "./table/WithUnifiedSelection";

/** @module Tree */
export { PresentationTreeDataProvider } from "./tree/DataProvider";
export { IPresentationTreeDataProvider } from "./tree/IPresentationTreeDataProvider";
export { treeWithUnifiedSelection, TreeWithUnifiedSelectionProps } from "./tree/WithUnifiedSelection";
export { treeWithFilteringSupport, TreeWithFilteringSupportProps } from "./tree/WithFilteringSupport";

/** @module Viewport */
export { viewWithUnifiedSelection, ViewWithUnifiedSelectionProps } from "./viewport/WithUnifiedSelection";

/** @module DisplayLabels */
export { IPresentationLabelsProvider, LabelsProvider } from "./labels/LabelsProvider";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
/* istanbul ignore next */
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("presentation-components", BUILD_SEMVER);
}
