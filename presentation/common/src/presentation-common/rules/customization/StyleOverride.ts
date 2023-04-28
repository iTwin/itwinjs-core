/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RuleBase } from "../Rule";

/**
 * Style override rules allow customizing display style of specific types of ECInstances.
 *
 * @see [Style override reference documentation page]($docs/presentation/customization/StyleOverride.md)
 * @public
 * @deprecated in 3.x. Use [[ExtendedDataRule]] instead. See [extended data usage page]($docs/presentation/customization/ExtendedDataUsage.md) for more details.
 */
export interface StyleOverride extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: "StyleOverride";

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/presentation/advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * Foreground color that should be used for node. The value should be an [ECExpression]($docs/presentation/advanced/ECExpressions.md)
   * whose result would evaluate to one the following formats:
   * - color name (`Red`, `Blue`, etc.)
   * - `rgb(255, 255, 255)`
   * - `#0F0F0F`
   */
  foreColor?: string;

  /**
   * Background color that should be used for node. The value should be an [ECExpression]($docs/presentation/advanced/ECExpressions.md)
   * whose result would evaluate to one the following formats:
   * - color name (`Red`, `Blue`, etc.)
   * - `rgb(255, 255, 255)`
   * - `#0F0F0F`
   */
  backColor?: string;

  /**
   * Font style that should be used for node. The value should be an [ECExpression]($docs/presentation/advanced/ECExpressions.md)
   * whose result would evaluate to one the following values:
   * - `"Bold"`
   * - `"Italic"`
   * - `"Italic,Bold"`
   * - `"Regular"`
   *
   * Defaults to `"Regular"`.
   */
  fontStyle?: string;
}
