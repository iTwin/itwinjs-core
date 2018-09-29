/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

// tslint:disable:naming-convention
/**
 * Enum of logging namespaces used by Presentation library.
 * Use `@bentley/bentleyjs-core/Logger` to enable logging for these namespaces.
 */
export const enum LoggingNamespaces {
  ECObjects = "ECObjects",
  ECObjects_ECExpressions = "ECObjects.ECExpressions",
  ECObjects_ECExpressions_Parse = "ECObjects.ECExpressions.Parse",
  ECObjects_ECExpressions_Evaluate = "ECObjects.ECExpressions.Evaluate",

  ECPresentation = "ECPresentation",
  ECPresentation_Connections = "ECPresentation.Connections",
  ECPresentation_RulesEngine = "ECPresentation.RulesEngine",
  ECPresentation_RulesEngine_Content = "ECPresentation.RulesEngine.Content",
  ECPresentation_RulesEngine_Localization = "ECPresentation.RulesEngine.Localization",
  ECPresentation_RulesEngine_Navigation = "ECPresentation.RulesEngine.Navigation",
  ECPresentation_RulesEngine_Navigation_Cache = "ECPresentation.RulesEngine.Navigation.Cache",
  ECPresentation_RulesEngine_Threads = "ECPresentation.RulesEngine.Threads",
  ECPresentation_RulesEngine_Update = "ECPresentation.RulesEngine.Update",
  ECPresentation_RulesEngine_RulesetVariables = "ECPresentation.RulesEngine.RulesetVariables",
}

// tslint:enable:naming-convention
