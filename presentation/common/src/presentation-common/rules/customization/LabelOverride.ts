/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ConditionContainer, RuleBase, RuleTypes } from "../Rule";

/**
 * Label override rules provide advanced ways to override instance labels and descriptions in
 * exchange of some performance penalty.
 *
 * @see [Label override reference documentation page]($docs/presentation/Customization/LabelOverride.md)
 * @public
 * @deprecated Use [[InstanceLabelOverride]] rule instead.
 */
export interface LabelOverride extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.LabelOverride;

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/Customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * An expression whose result becomes the label. This is
   * an [ECExpression]($docs/presentation/Customization/ECExpressions.md), so label
   * can be defined/formatted dynamically based on the context - for example
   * ECInstance property value. May be [localized]($docs/presentation/Advanced/Localization.md).
   *
   * @minLength 1
   */
  label?: string;

  /**
   * An expression whose result becomes the description. This is
   * an [ECExpression]($docs/presentation/Customization/ECExpressions.md), so
   * description can be defined/formatted dynamically based on the context - for example
   * ECInstance property value. May be [localized]($docs/presentation/Advanced/Localization.md).
   *
   * @minLength 1
   */
  description?: string;
}
