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
export { PresentationProps, Presentation } from "./presentation-backend/Presentation.js";
export {
  ContentCacheConfig,
  PresentationManagerCachingConfig,
  MultiElementPropertiesResponse,
  PresentationAssetsRootConfig,
  PresentationManagerProps,
  PresentationManager,
} from "./presentation-backend/PresentationManager.js";
/* eslint-disable @typescript-eslint/no-deprecated */
export { MultiManagerPresentationProps, SingleManagerPresentationProps } from "./presentation-backend/Presentation.js";
export {
  HierarchyCacheMode,
  HierarchyCacheConfig,
  MemoryHierarchyCacheConfig,
  DiskHierarchyCacheConfig,
  HybridCacheConfig,
  UnitSystemFormat,
} from "./presentation-backend/PresentationManager.js";
/* eslint-enable @typescript-eslint/no-deprecated */
export { RulesetManager } from "./presentation-backend/RulesetManager.js";
export { RulesetVariablesManager } from "./presentation-backend/RulesetVariablesManager.js";
export { RulesetInsertOptions, RulesetEmbedderProps, RulesetEmbedder } from "./presentation-backend/RulesetEmbedder.js";
export { BackendDiagnosticsHandler, BackendDiagnosticsOptions, BackendDiagnosticsAttribute } from "./presentation-backend/Utils.js";

/**
 * @module Logging
 *
 * @docs-group-description Logging
 * Types related to logging in this package.
 */
export { PresentationBackendLoggerCategory, PresentationBackendNativeLoggerCategory } from "./presentation-backend/BackendLoggerCategory.js";

const globalSymbolPresentationBackend = Symbol.for("itwin.presentation.backend.globals");
if ((globalThis as any)[globalSymbolPresentationBackend]) {
  // Get the stack trace from when the module was first loaded
  const firstLoadStack = (globalThis as any)[globalSymbolPresentationBackend].stack;

  const error = new Error(
    "Multiple @itwin/presentation-backend imports detected! This may happen if:\n" +
      "- You have multiple versions of the package installed\n" +
      "- Your bundling configuration is incorrect\n" +
      "- You're importing from both ESM and CommonJS versions",
  );

  /* eslint-disable no-console */
  console.error("Duplicate @itwin/presentation-backend import:", error);
  console.error("First import occurred at:", firstLoadStack);
  console.error("Current import occurred at:", error.stack);
  /* eslint-enable no-console */

  throw error;
} else {
  (globalThis as any)[globalSymbolPresentationBackend] = {
    stack: new Error().stack,
  };
}