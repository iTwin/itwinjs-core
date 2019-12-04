/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/**
 * @module Core
 *
 * @docs-group-description Core
 * Common types used for retrieving presentation data from iModels.
 */
export { PersistenceHelper } from "./PersistenceHelper";
export { Presentation } from "./Presentation";
export { PresentationManager, PresentationManagerProps } from "./PresentationManager";
export { RulesetManager } from "./RulesetManager";
export { RulesetVariablesManager } from "./RulesetVariablesManager";
export { FavoritePropertiesManager, FavoriteProperties } from "./favorite-properties/FavoritePropertiesManager";
export { IFavoritePropertiesStorage, IModelAppFavoritePropertiesStorage } from "./favorite-properties/FavoritePropertiesStorage";

/**
 * @module UnifiedSelection
 *
 * @docs-group-description UnifiedSelection
 * Types related to [unified selection]($docs/learning/presentation/Unified-Selection/index.md).
 */
export { SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType, SelectionChangesListener } from "./selection/SelectionChangeEvent";
export { ISelectionProvider } from "./selection/ISelectionProvider";
export { SelectionManager, SelectionManagerProps } from "./selection/SelectionManager";
export { SelectionScopesManager, SelectionScopesManagerProps } from "./selection/SelectionScopesManager";
export { SelectionHandler } from "./selection/SelectionHandler";
export { HiliteSet, HiliteSetProvider } from "./selection/HiliteSetProvider";
export { SelectionHelper } from "./selection/SelectionHelper";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
/* istanbul ignore next */
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("presentation-frontend", BUILD_SEMVER);
}
