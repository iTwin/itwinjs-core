/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { ConditionContainer, RuleBase, RuleTypes } from "../Rule";

/**
 * Rule that allows configuring check boxes for certain nodes.
 *
 * Is also allows binding check box state with boolean properties by setting [[propertyName]] parameter.
 * If [[propertyName]] is not set, then [[defaultValue]] is used for default check box state.
 *
 * @see [More details]($docs/presentation/Customization/CheckBoxRule.md)
 * @public
 */
export interface CheckBoxRule extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.CheckBox;

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * Name of boolean type ECProperty which is bound with the check box state. When set,
   * property value gets bound to checkbox state.
   *
   * @minLength 1
   */
  propertyName?: string;

  /**
   * Should property value be inversed for the check box state.
   *
   * **Note:** Only makes sense when bound to an ECProperty.
   */
  useInversedPropertyValue?: boolean;

  /**
   * Default value to use for the check box state
   *
   * **Note:** Only makes sense when *not* bound to an ECProperty.
   */
  defaultValue?: boolean;

  /**
   * Indicates whether check box is enabled or disabled.
   */
  isEnabled?: string | boolean;
}
