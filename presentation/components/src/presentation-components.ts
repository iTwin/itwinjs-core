/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Presentation } from "@bentley/presentation-frontend";
import { initializeLocalization, initializePropertyValueRenderers } from "./presentation-components/common/Utils.js";

/* eslint-disable deprecation/deprecation */

/**
 * @module Core
 *
 * @docs-group-description Core
 * Common types used all across ($presentation-components) package.
 */
export { IPresentationDataProvider } from "./presentation-components/common/IPresentationDataProvider.js";
export { IUnifiedSelectionComponent } from "./presentation-components/common/IUnifiedSelectionComponent.js";
export { ContentBuilder } from "./presentation-components/common/ContentBuilder.js";
export { IContentDataProvider, ContentDataProvider, ContentDataProviderProps, CacheInvalidationProps } from "./presentation-components/common/ContentDataProvider.js";
export { DataProvidersFactory, DataProvidersFactoryProps } from "./presentation-components/DataProvidersFactory.js";
export { useRulesetRegistration } from "./presentation-components/hooks/UseRulesetRegistration.js";

/**
 * @module Logging
 *
 * @docs-group-description Logging
 * Types related to logging in ($presentation-components) package.
 */
export * from "./presentation-components/ComponentsLoggerCategory.js";

/**
 * @module Properties
 *
 * @docs-group-description Properties
 * Presentation-specific [Properties]($ui-components:Properties).
 */
export { InstanceKeyValueRenderer } from "./presentation-components/properties/InstanceKeyValueRenderer.js";

/**
 * @module PropertyGrid
 *
 * @docs-group-description PropertyGrid
 * Presentation features for [PropertyGrid]($ui-components) component.
 */
export { IPresentationPropertyDataProvider, PresentationPropertyDataProvider, PresentationPropertyDataProviderProps, DEFAULT_PROPERTY_GRID_RULESET } from "./presentation-components/propertygrid/DataProvider.js";
export { propertyGridWithUnifiedSelection, PropertyGridWithUnifiedSelectionProps } from "./presentation-components/propertygrid/WithUnifiedSelection.js";
export { FavoritePropertiesDataFilterer, FavoritePropertiesDataFiltererProps } from "./presentation-components/propertygrid/FavoritePropertiesDataFilterer.js";
export * from "./presentation-components/propertygrid/UseUnifiedSelection.js";

/**
 * @module FavoriteProperties
 *
 * @docs-group-description FavoriteProperties
 * Presentation features for [Favorite properties]($ui-components:Favorite).
 */
export { FavoritePropertiesDataProvider, FavoritePropertiesDataProviderProps } from "./presentation-components/favorite-properties/DataProvider.js";

/**
 * @module Table
 *
 * @docs-group-description Table
 * Presentation features for [Table]($ui-components) component.
 */
export { IPresentationTableDataProvider, PresentationTableDataProvider, PresentationTableDataProviderProps } from "./presentation-components/table/DataProvider.js";
export { tableWithUnifiedSelection, TableWithUnifiedSelectionProps } from "./presentation-components/table/WithUnifiedSelection.js";

/**
 * @module Tree
 *
 * @docs-group-description Tree
 * Presentation features for [Tree]($ui-components:Tree) component.
 */
export { PresentationTreeDataProvider, PresentationTreeDataProviderProps, PresentationTreeDataProviderDataSourceEntryPoints } from "./presentation-components/tree/DataProvider.js";
export { IPresentationTreeDataProvider } from "./presentation-components/tree/IPresentationTreeDataProvider.js";
export { IFilteredPresentationTreeDataProvider } from "./presentation-components/tree/FilteredDataProvider.js";
export { DEPRECATED_treeWithUnifiedSelection, TreeWithUnifiedSelectionProps } from "./presentation-components/tree/WithUnifiedSelection.js";
export { DEPRECATED_treeWithFilteringSupport, TreeWithFilteringSupportProps } from "./presentation-components/tree/WithFilteringSupport.js";
export { UnifiedSelectionTreeEventHandler, UnifiedSelectionTreeEventHandlerParams, useUnifiedSelectionTreeEventHandler } from "./presentation-components/tree/controlled/UseUnifiedSelection.js";
export { useControlledTreeFiltering, ControlledTreeFilteringProps } from "./presentation-components/tree/controlled/UseControlledTreeFiltering.js";
export { DEPRECATED_controlledTreeWithFilteringSupport, ControlledTreeWithFilteringSupportProps } from "./presentation-components/tree/controlled/WithFilteringSupport.js";
export { DEPRECATED_controlledTreeWithVisibleNodes, ControlledTreeWithVisibleNodesProps } from "./presentation-components/tree/controlled/WithVisibleNodes.js";
export { usePresentationTreeNodeLoader, PresentationTreeNodeLoaderProps } from "./presentation-components/tree/controlled/TreeHooks.js";

/**
 * @module Viewport
 *
 * @docs-group-description Viewport
 * Presentation features for [ViewportComponent]($ui-components).
 */
export { viewWithUnifiedSelection, ViewWithUnifiedSelectionProps } from "./presentation-components/viewport/WithUnifiedSelection.js";

/**
 * @module DisplayLabels
 *
 * @docs-group-description DisplayLabels
 * Types related to display labels.
 */
export { IPresentationLabelsProvider, PresentationLabelsProvider, PresentationLabelsProviderProps } from "./presentation-components/labels/LabelsProvider.js";

/**
 * @module UnifiedSelection
 *
 * @docs-group-description UnifiedSelection
 * Utilities for working with [Unified Selection]($docs/learning/presentation/Unified-Selection/index.md) within [React](https://reactjs.org/) components.
 */
export { UnifiedSelectionContext, UnifiedSelectionContextProvider, UnifiedSelectionContextProviderProps, UnifiedSelectionState, useUnifiedSelectionContext } from "./presentation-components/unified-selection/UnifiedSelectionContext.js";

Presentation.registerInitializationHandler(initializeLocalization);
Presentation.registerInitializationHandler(initializePropertyValueRenderers);
