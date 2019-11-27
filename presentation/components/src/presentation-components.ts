/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/**
 * @module Core
 *
 * @docs-group-description Core
 * Common types used all across presentation-component package.
 */
export { IPresentationDataProvider } from "./common/IPresentationDataProvider";
export { IUnifiedSelectionComponent } from "./common/IUnifiedSelectionComponent";
export { ContentBuilder } from "./common/ContentBuilder";
export { IContentDataProvider, ContentDataProvider, CacheInvalidationProps } from "./common/ContentDataProvider";
export { DataProvidersFactory, DataProvidersFactoryProps } from "./DataProvidersFactory";
export { useRulesetRegistration } from "./hooks/UseRulesetRegistration";

/**
 * @module PropertyGrid
 *
 * @docs-group-description PropertyGrid
 * Types related to `PropertyGrid` component in `@bentley/ui-components` package.
 */
export { IPresentationPropertyDataProvider, PresentationPropertyDataProvider } from "./propertygrid/DataProvider";
export { propertyGridWithUnifiedSelection, PropertyGridWithUnifiedSelectionProps } from "./propertygrid/WithUnifiedSelection";

/**
 * @module FavoriteProperties
 *
 * @docs-group-description FavoriteProperties
 * Types related to `FavoriteProperties` component in `@bentley/ui-components` package.
 */
export { FavoritePropertiesDataProvider, FavoritePropertiesDataProviderProps } from "./favorite-properties/DataProvider";

/**
 * @module Table
 *
 * @docs-group-description Table
 * Types related to `Table` component in `@bentley/ui-components` package.
 */
export { IPresentationTableDataProvider, PresentationTableDataProvider, PresentationTableDataProviderProps } from "./table/DataProvider";
export { tableWithUnifiedSelection, TableWithUnifiedSelectionProps } from "./table/WithUnifiedSelection";

/**
 * @module Tree
 *
 * @docs-group-description Tree
 * Types related to `Tree` component in `@bentley/ui-components` package.
 */
export { PresentationTreeDataProvider } from "./tree/DataProvider";
export { IPresentationTreeDataProvider } from "./tree/IPresentationTreeDataProvider";
export { treeWithUnifiedSelection, TreeWithUnifiedSelectionProps } from "./tree/WithUnifiedSelection";
export { treeWithFilteringSupport, TreeWithFilteringSupportProps } from "./tree/WithFilteringSupport";
export { useControlledTreeUnifiedSelection } from "./tree/controlled/UseUnifiedSelection";
export { controlledTreeWithUnifiedSelection, ControlledTreeWithUnifiedSelectionProps } from "./tree/controlled/WithUnifiedSelection";
export { useControlledTreeFiltering } from "./tree/controlled/UseControlledTreeFiltering";
export { controlledTreeWithFilteringSupport, ControlledTreeWithFilteringSupportProps } from "./tree/controlled/WithFilteringSupport";
export { controlledTreeWithModelSource, ControlledTreeWithModelSourceProps } from "./tree/controlled/WithModelSource";
export { usePresentationNodeLoader, PresentationNodeLoaderProps } from "./tree/controlled/TreeHooks";

/**
 * @module Viewport
 *
 * @docs-group-description Viewport
 * Types related to `Viewport` component in `@bentley/ui-components` package.
 */
export { viewWithUnifiedSelection, ViewWithUnifiedSelectionProps } from "./viewport/WithUnifiedSelection";

/**
 * @module DisplayLabels
 *
 * @docs-group-description DisplayLabels
 * Types related to display labels
 */
export { IPresentationLabelsProvider, LabelsProvider } from "./labels/LabelsProvider";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
/* istanbul ignore next */
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("presentation-components", BUILD_SEMVER);
}
