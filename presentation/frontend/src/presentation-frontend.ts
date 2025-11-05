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

const globalSymbolPresentationFrontend = Symbol.for("itwin.presentation.frontend.globals");
if ((globalThis as any)[globalSymbolPresentationFrontend]) {
  // Get the stack trace from when the module was first loaded
  const firstLoadStack = (globalThis as any)[globalSymbolPresentationFrontend].stack;

  const error = new Error(
    "Multiple @itwin/presentation-frontend imports detected! This may happen if:\n" +
      "- You have multiple versions of the package installed\n" +
      "- Your bundling configuration is incorrect\n" +
      "- You're importing from both ESM and CommonJS versions",
  );

  /* eslint-disable no-console */
  console.error("Duplicate @itwin/presentation-frontend import:", error);
  console.error("First import occurred at:", firstLoadStack);
  console.error("Current import occurred at:", error.stack);
  /* eslint-enable no-console */

  throw error;
} else {
  (globalThis as any)[globalSymbolPresentationFrontend] = {
    stack: new Error().stack,
  };
}