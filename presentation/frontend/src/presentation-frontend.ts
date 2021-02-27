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
export { Presentation } from "./presentation-frontend/Presentation";
export {
  IModelContentChangeEventArgs, IModelHierarchyChangeEventArgs, PresentationManager, PresentationManagerProps,
} from "./presentation-frontend/PresentationManager";
export { RulesetManager } from "./presentation-frontend/RulesetManager";
export { RulesetVariablesManager } from "./presentation-frontend/RulesetVariablesManager";
export {
  FavoritePropertiesManager, PropertyFullName, FavoritePropertiesOrderInfo,
  FavoritePropertiesScope, getFieldInfos, createFieldOrderInfos,
} from "./presentation-frontend/favorite-properties/FavoritePropertiesManager";
export { IFavoritePropertiesStorage } from "./presentation-frontend/favorite-properties/FavoritePropertiesStorage";
export { NodeIdentifier, StateTracker } from "./presentation-frontend/StateTracker";

/**
 * @module Logging
 *
 * @docs-group-description Logging
 * Types related to logging in this package.
 */
export * from "./presentation-frontend/FrontendLoggerCategory";

/**
 * @module UnifiedSelection
 *
 * @docs-group-description UnifiedSelection
 * Types related to [unified selection]($docs/learning/presentation/Unified-Selection/index.md).
 */
export {
  SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType, SelectionChangesListener,
} from "./presentation-frontend/selection/SelectionChangeEvent";
export { ISelectionProvider } from "./presentation-frontend/selection/ISelectionProvider";
export { SelectionManager, SelectionManagerProps } from "./presentation-frontend/selection/SelectionManager";
export { SelectionScopesManager, SelectionScopesManagerProps, getScopeId } from "./presentation-frontend/selection/SelectionScopesManager";
export { SelectionHandler, SelectionHandlerProps } from "./presentation-frontend/selection/SelectionHandler";
export { HiliteSet, HiliteSetProvider, HiliteSetProviderProps } from "./presentation-frontend/selection/HiliteSetProvider";
export { SelectionHelper } from "./presentation-frontend/selection/SelectionHelper";
