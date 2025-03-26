/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/**
 * @module Core
 *
 * @docs-group-description Core
 * Common types used for retrieving presentation data from iModels.
 */
export { PresentationProps, Presentation } from "./presentation-frontend/Presentation.js";
export {
  IModelHierarchyChangeEventArgs,
  IModelContentChangeEventArgs,
  MultipleValuesRequestOptions,
  GetNodesRequestOptions,
  GetContentRequestOptions,
  GetDistinctValuesRequestOptions,
  PresentationManagerProps,
  PresentationManager,
} from "./presentation-frontend/PresentationManager.js";
export { RulesetManager } from "./presentation-frontend/RulesetManager.js";
export { RulesetVariablesManager } from "./presentation-frontend/RulesetVariablesManager.js";
export {
  FavoritePropertiesScope,
  PropertyFullName,
  FavoritePropertiesOrderInfo,
  FavoritePropertiesManagerProps,
  FavoritePropertiesManager,
} from "./presentation-frontend/favorite-properties/FavoritePropertiesManager.js";
export {
  IFavoritePropertiesStorage,
  DefaultFavoritePropertiesStorageTypes,
  createFavoritePropertiesStorage,
} from "./presentation-frontend/favorite-properties/FavoritePropertiesStorage.js";
export { consoleDiagnosticsHandler, createCombinedDiagnosticsHandler } from "./presentation-frontend/Diagnostics.js";

/**
 * @module Logging
 *
 * @docs-group-description Logging
 * Types related to logging in this package.
 */
export { PresentationFrontendLoggerCategory } from "./presentation-frontend/FrontendLoggerCategory.js";

/**
 * @module UnifiedSelection
 *
 * @docs-group-description UnifiedSelection
 * Types related to [unified selection]($docs/presentation/unified-selection/index.md).
 */
export {
  SelectionChangesListener,
  SelectionChangeEvent,
  SelectionChangeType,
  SelectionChangeEventArgs,
} from "./presentation-frontend/selection/SelectionChangeEvent.js";
export { ISelectionProvider } from "./presentation-frontend/selection/ISelectionProvider.js";
export { SelectionManagerProps, SelectionManager } from "./presentation-frontend/selection/SelectionManager.js";
export { SelectionScopesManagerProps, SelectionScopesManager, createSelectionScopeProps } from "./presentation-frontend/selection/SelectionScopesManager.js";
export { SelectionHandlerProps, SelectionHandler } from "./presentation-frontend/selection/SelectionHandler.js";
export { HiliteSet, HiliteSetProviderProps, HiliteSetProvider } from "./presentation-frontend/selection/HiliteSetProvider.js";
export { SelectionHelper } from "./presentation-frontend/selection/SelectionHelper.js";
