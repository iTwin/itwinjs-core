/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RuleTypes, RuleBase, ConditionContainer } from "../Rule";
import { ContentSpecification } from "./ContentSpecification";

/**
 * Defines content that's displayed in content controls (table view,
 * property pane, etc.) and the content that's selected in
 * [unified selection]($docs/learning/unified-selection/index.md) controls
 */
export interface ContentRule extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.Content;

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/learning/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/learning/content/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /** Specifications that define content returned by the rule */
  specifications: ContentSpecification[];
}
