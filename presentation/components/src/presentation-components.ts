/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Presentation } from "@bentley/presentation-frontend";
import { initializeLocalization, initializePropertyValueRenderers } from "./presentation-components/common/Utils";

/* eslint-disable deprecation/deprecation */

/**
 * @module Core
 *
 * @docs-group-description Core
 * Common types used all across ($presentation-components) package.
 */
export { IPresentationDataProvider } from "./presentation-components/common/IPresentationDataProvider";
export { IUnifiedSelectionComponent } from "./presentation-components/common/IUnifiedSelectionComponent";
export { ContentBuilder } from "./presentation-components/common/ContentBuilder";
export { IContentDataProvider, ContentDataProvider, ContentDataProviderProps, CacheInvalidationProps } from "./presentation-components/common/ContentDataProvider";
export { DataProvidersFactory, DataProvidersFactoryProps } from "./presentation-components/DataProvidersFactory";
export { useRulesetRegistration } from "./presentation-components/hooks/UseRulesetRegistration";

/**
 * @module Logging
 *
 * @docs-group-description Logging
 * Types related to logging in ($presentation-components) package.
 */
export * from "./presentation-components/ComponentsLoggerCategory";

/**
 * @module Properties
 *
 * @docs-group-description Properties
 * Presentation-specific [Properties]($ui-components:Properties).
 */
export { InstanceKeyValueRenderer } from "./presentation-components/properties/InstanceKeyValueRenderer";

/**
 * @module PropertyGrid
 *
 * @docs-group-description PropertyGrid
 * Presentation features for [PropertyGrid]($ui-components) component.
 */
export { IPresentationPropertyDataProvider, PresentationPropertyDataProvider, PresentationPropertyDataProviderProps, DEFAULT_PROPERTY_GRID_RULESET } from "./presentation-components/propertygrid/DataProvider";
export { propertyGridWithUnifiedSelection, PropertyGridWithUnifiedSelectionProps } from "./presentation-components/propertygrid/WithUnifiedSelection";
export { FavoritePropertiesDataFilterer, FavoritePropertiesDataFiltererProps } from "./presentation-components/propertygrid/FavoritePropertiesDataFilterer";
export * from "./presentation-components/propertygrid/UseUnifiedSelection";

/**
 * @module FavoriteProperties
 *
 * @docs-group-description FavoriteProperties
 * Presentation features for [Favorite properties]($ui-components:Favorite).
 */
export { FavoritePropertiesDataProvider, FavoritePropertiesDataProviderProps } from "./presentation-components/favorite-properties/DataProvider";

/**
 * @module Table
 *
 * @docs-group-description Table
 * Presentation features for [Table]($ui-components) component.
 */
export { IPresentationTableDataProvider, PresentationTableDataProvider, PresentationTableDataProviderProps } from "./presentation-components/table/DataProvider";
export { tableWithUnifiedSelection, TableWithUnifiedSelectionProps } from "./presentation-components/table/WithUnifiedSelection";

/**
 * @module Tree
 *
 * @docs-group-description Tree
 * Presentation features for [Tree]($ui-components:Tree) component.
 */
export { PresentationTreeDataProvider, PresentationTreeDataProviderProps, PresentationTreeDataProviderDataSourceEntryPoints } from "./presentation-components/tree/DataProvider";
export { IPresentationTreeDataProvider } from "./presentation-components/tree/IPresentationTreeDataProvider";
export { IFilteredPresentationTreeDataProvider } from "./presentation-components/tree/FilteredDataProvider";
export { DEPRECATED_treeWithUnifiedSelection, TreeWithUnifiedSelectionProps } from "./presentation-components/tree/WithUnifiedSelection";
export { DEPRECATED_treeWithFilteringSupport, TreeWithFilteringSupportProps } from "./presentation-components/tree/WithFilteringSupport";
export { UnifiedSelectionTreeEventHandler, UnifiedSelectionTreeEventHandlerParams, useUnifiedSelectionTreeEventHandler } from "./presentation-components/tree/controlled/UseUnifiedSelection";
export { useControlledTreeFiltering, ControlledTreeFilteringProps } from "./presentation-components/tree/controlled/UseControlledTreeFiltering";
export { DEPRECATED_controlledTreeWithFilteringSupport, ControlledTreeWithFilteringSupportProps } from "./presentation-components/tree/controlled/WithFilteringSupport";
export { DEPRECATED_controlledTreeWithVisibleNodes, ControlledTreeWithVisibleNodesProps } from "./presentation-components/tree/controlled/WithVisibleNodes";
export { usePresentationTreeNodeLoader, PresentationTreeNodeLoaderProps } from "./presentation-components/tree/controlled/TreeHooks";

/**
 * @module Viewport
 *
 * @docs-group-description Viewport
 * Presentation features for [ViewportComponent]($ui-components).
 */
export { viewWithUnifiedSelection, ViewWithUnifiedSelectionProps } from "./presentation-components/viewport/WithUnifiedSelection";

/**
 * @module DisplayLabels
 *
 * @docs-group-description DisplayLabels
 * Types related to display labels.
 */
export { IPresentationLabelsProvider, PresentationLabelsProvider, PresentationLabelsProviderProps } from "./presentation-components/labels/LabelsProvider";

/**
 * @module UnifiedSelection
 *
 * @docs-group-description UnifiedSelection
 * Utilities for working with [Unified Selection]($docs/learning/presentation/Unified-Selection/index.md) within [React](https://reactjs.org/) components.
 */
export { UnifiedSelectionContext, UnifiedSelectionContextProvider, UnifiedSelectionContextProviderProps, UnifiedSelectionState, useUnifiedSelectionContext } from "./presentation-components/unified-selection/UnifiedSelectionContext";

Presentation.registerInitializationHandler(initializeLocalization);
Presentation.registerInitializationHandler(initializePropertyValueRenderers);
