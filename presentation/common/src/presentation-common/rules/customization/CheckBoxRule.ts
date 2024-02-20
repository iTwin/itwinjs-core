/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RuleBase } from "../Rule";

/**
 * CheckBox rules provide a way to create a checkbox for specific types of ECInstance's.
 *
 * @see [CheckBox rule reference documentation page]($docs/presentation/customization/CheckBoxRule.md)
 * @public
 * @deprecated in 3.x. Use [[ExtendedDataRule]] instead. See [extended data usage page]($docs/presentation/customization/ExtendedDataUsage.md) for more details.
 */
export interface CheckBoxRule extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: "CheckBox";

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/presentation/advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * Name of boolean type ECProperty which is bound with the check box state. When set, property
   * value gets bound to checkbox state.
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
