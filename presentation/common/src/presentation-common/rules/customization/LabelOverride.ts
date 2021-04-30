/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ConditionContainer, RuleBase, RuleTypes } from "../Rule";

/**
 * Rule to override labels and descriptions of nodes which pass rule's
 * condition.
 *
 * **Important:** Prefer [[InstanceLabelOverride]] over this rule when possible as it
 * has better performance.
 *
 * @see [More details]($docs/learning/presentation/Customization/LabelOverride.md)
 * @public
 * @deprecated Use [[InstanceLabelOverride]]
 */
export interface LabelOverride extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.LabelOverride;

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/learning/presentation/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/learning/presentation/Customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * Defines the label that should be used for node. This is
   * an [ECExpression]($docs/learning/presentation/Customization/ECExpressions.md), so label
   * can be defined/formatted dynamically based on the context - for example
   * ECInstance property value. May be [localized]($docs/learning/presentation/Localization.md).
   *
   * @minLength 1
   */
  label?: string;

  /**
   * Defines the description that should be used for node. This is
   * an [ECExpression]($docs/learning/presentation/Customization/ECExpressions.md), so
   * description can be defined/formatted dynamically based on the context - for example
   * ECInstance property value. May be [localized]($docs/learning/presentation/Localization.md).
   *
   * @minLength 1
   */
  description?: string;
}
