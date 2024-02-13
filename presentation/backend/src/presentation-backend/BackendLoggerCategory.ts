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
 * @public
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
 * @public
 */
export enum PresentationBackendNativeLoggerCategory {
  ECObjects = "ECObjects",
  ECObjects_ECExpressions = "ECObjects.ECExpressions",
  ECObjects_ECExpressions_Parse = "ECObjects.ECExpressions.Parse",
  ECObjects_ECExpressions_Evaluate = "ECObjects.ECExpressions.Evaluate",

  ECPresentation = "ECPresentation",
  ECPresentation_Connections = "ECPresentation.Connections",
  ECPresentation_Tasks = "ECPresentation.Tasks",
  ECPresentation_Hierarchies = "ECPresentation.Navigation",
  ECPresentation_Hierarchies_Cache = "ECPresentation.Navigation.Cache",
  ECPresentation_Content = "ECPresentation.Content",
  ECPresentation_Update = "ECPresentation.Update",
  ECPresentation_Update_Hierarchies = "ECPresentation.Update.Hierarchies",
  ECPresentation_Update_Content = "ECPresentation.Update.Content",
  ECPresentation_Rules = "ECPresentation.Rules",
  ECPresentation_RulesetVariables = "ECPresentation.RulesetVariables",
  ECPresentation_ECExpressions = "ECPresentation.ECExpressions",
  ECPresentation_Serialization = "ECPresentation.Serialization",

  /** @deprecated in 4.0. The logging namespace is not used anymore. */
  ECPresentation_Localization = "ECPresentation.Localization",
  /** @deprecated in 4.0. Use [[ECPresentation]] */
  ECPresentation_RulesEngine = "ECPresentation.RulesEngine",
  /** @deprecated in 4.0. Use [[ECPresentation_Content]] */
  ECPresentation_RulesEngine_Content = "ECPresentation.Content",
  /** @deprecated in 4.0. The logging namespace is not used anymore. */
  ECPresentation_RulesEngine_Localization = "ECPresentation.Localization",
  /** @deprecated in 4.0. Use [[ECPresentation_Hierarchies]] */
  ECPresentation_RulesEngine_Navigation = "ECPresentation.Navigation",
  /** @deprecated in 4.0. Use [[ECPresentation_Hierarchies_Cache]] */
  ECPresentation_RulesEngine_Navigation_Cache = "ECPresentation.Navigation.Cache",
  /** @deprecated in 4.0. Use [[ECPresentation_Tasks]] */
  ECPresentation_RulesEngine_Threads = "ECPresentation.Tasks",
  /** @deprecated in 4.0. Use [[ECPresentation_Update]] */
  ECPresentation_RulesEngine_Update = "ECPresentation.Update",
  /** @deprecated in 4.0. Use [[ECPresentation_RulesetVariables]] */
  ECPresentation_RulesEngine_RulesetVariables = "ECPresentation.RulesetVariables",
}
