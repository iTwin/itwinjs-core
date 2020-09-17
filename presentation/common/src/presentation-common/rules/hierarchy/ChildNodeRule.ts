/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ConditionContainer, RuleTypes } from "../Rule";
import { NavigationRuleBase } from "./NavigationRule";

/**
 * Child node rules define nodes that are displayed at
 * each child hierarchy level.
 *
 * @see [More details]($docs/learning/presentation/Hierarchies/ChildNodeRule.md)
 * @public
 */
export interface ChildNodeRule extends NavigationRuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.ChildNodes;

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/learning/presentation/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/learning/presentation/Hierarchies/ECExpressions.md#rule-condition).
   */
  condition?: string;
}
