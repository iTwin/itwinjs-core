/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ConditionContainer, RuleBase, RuleTypes } from "../Rule";

/**
 * Rule to override default node style and dynamically define a foreground/background
 * colors and a font style for a particular nodes.
 *
 * @see [More details]($docs/presentation/Customization/StyleOverride.md)
 * @public
 */
export interface StyleOverride extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.StyleOverride;

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/Customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * Foreground color that should be used for node. The value should be an [ECExpression]($docs/presentation/Advanced/ECExpressions.md)
   * whose result would evaluate to one the following formats:
   * - color name (`Red`, `Blue`, etc.)
   * - `rgb(255, 255, 255)`
   * - `#0F0F0F`
   */
  foreColor?: string;

  /**
   * Background color that should be used for node. The value should be an [ECExpression]($docs/presentation/Advanced/ECExpressions.md)
   * whose result would evaluate to one the following formats:
   * - color name (`Red`, `Blue`, etc.)
   * - `rgb(255, 255, 255)`
   * - `#0F0F0F`
   */
  backColor?: string;

  /**
   * Font style that should be used for node. The value should be an [ECExpression]($docs/presentation/Advanced/ECExpressions.md)
   * whose result would evaluate to one the following values:
   * - `"Bold"`
   * - `"Italic"`
   * - `"Italic,Bold"`
   * - `"Regular"`
   *
   * Defaults to `"FontStyle.Regular"`.
   */
  fontStyle?: string;
}
