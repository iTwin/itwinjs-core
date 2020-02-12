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
export { PersistenceHelper } from "./presentation-frontend/PersistenceHelper";
export { Presentation } from "./presentation-frontend/Presentation";
export { PresentationManager, PresentationManagerProps } from "./presentation-frontend/PresentationManager";
export { RulesetManager } from "./presentation-frontend/RulesetManager";
export { RulesetVariablesManager } from "./presentation-frontend/RulesetVariablesManager";
export { FavoritePropertiesManager, FavoriteProperties } from "./presentation-frontend/favorite-properties/FavoritePropertiesManager";
export { IFavoritePropertiesStorage, IModelAppFavoritePropertiesStorage } from "./presentation-frontend/favorite-properties/FavoritePropertiesStorage";

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
export { SelectionHandler } from "./presentation-frontend/selection/SelectionHandler";
export { HiliteSet, HiliteSetProvider } from "./presentation-frontend/selection/HiliteSetProvider";
export { SelectionHelper } from "./presentation-frontend/selection/SelectionHelper";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
/* istanbul ignore next */
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("presentation-frontend", BUILD_SEMVER);
}
