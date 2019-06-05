/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

export { PersistenceHelper } from "./PersistenceHelper";
export { Presentation } from "./Presentation";
export { PresentationManager, PresentationManagerProps } from "./PresentationManager";
export { RulesetManager } from "./RulesetManager";
export { RulesetVariablesManager } from "./RulesetVariablesManager";

/** @module UnifiedSelection */
export { SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType, SelectionChangesListener } from "./selection/SelectionChangeEvent";
export { ISelectionProvider } from "./selection/ISelectionProvider";
export { SelectionManager, SelectionManagerProps } from "./selection/SelectionManager";
export { SelectionScopesManager, SelectionScopesManagerProps } from "./selection/SelectionScopesManager";
export { SelectionHandler } from "./selection/SelectionHandler";
export { HiliteSet } from "./selection/HiliteSetProvider";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
/* istanbul ignore next */
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("presentation-frontend", BUILD_SEMVER);
}
