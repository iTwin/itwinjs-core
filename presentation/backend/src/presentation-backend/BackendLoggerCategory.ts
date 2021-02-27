/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/**
 * Logger categories used by this package
 * @note All logger categories in this package start with the `presentation-backend` prefix.
 * @see [Logger]($bentley)
 * @beta
 */
export enum PresentationBackendLoggerCategory {
  Package = "presentation-backend",

  /** The logger category used by the [[PresentationManager]] class and other related classes. */
  PresentationManager = "presentation-backend.PresentationManager",

  /** The logger category used by Presentation RPC implementation. */
  Rpc = "presentation-backend.Rpc",

  /** The logger category used by Presentation IPC implementation. */
  Ipc = "presentation-backend.Ipc",
}

/**
 * Logger categories used by this package
 * @note Logger categories used by the [[PresentationManager]] native addon.
 * @see [Logger]($bentley)
 * @beta
 */
export enum PresentationBackendNativeLoggerCategory {
  ECObjects = "ECObjects",
  ECObjects_ECExpressions = "ECObjects.ECExpressions",
  ECObjects_ECExpressions_Parse = "ECObjects.ECExpressions.Parse",
  ECObjects_ECExpressions_Evaluate = "ECObjects.ECExpressions.Evaluate",

  ECPresentation = "ECPresentation",
  ECPresentation_Connections = "ECPresentation.Connections",
  ECPresentation_Localization = "ECPresentation.Localization",
  ECPresentation_RulesEngine = "ECPresentation.RulesEngine",
  ECPresentation_RulesEngine_Content = "ECPresentation.RulesEngine.Content",
  ECPresentation_RulesEngine_Localization = "ECPresentation.RulesEngine.Localization",
  ECPresentation_RulesEngine_Navigation = "ECPresentation.RulesEngine.Navigation",
  ECPresentation_RulesEngine_Navigation_Cache = "ECPresentation.RulesEngine.Navigation.Cache",
  ECPresentation_RulesEngine_Threads = "ECPresentation.RulesEngine.Threads",
  ECPresentation_RulesEngine_Update = "ECPresentation.RulesEngine.Update",
  ECPresentation_RulesEngine_RulesetVariables = "ECPresentation.RulesEngine.RulesetVariables",
}
