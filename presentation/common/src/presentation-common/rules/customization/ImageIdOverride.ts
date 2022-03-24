/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { ConditionContainer, RuleBase, RuleTypes } from "../Rule";

/**
 * ImageId override rules allow setting an image ID to specific types of ECInstances.
 *
 * @see [Image ID override reference documentation page]($docs/presentation/Customization/ImageIdOverride.md)
 * @public
 * @deprecated Use [[ExtendedDataRule]] instead. See [extended data usage page]($docs/presentation/Customization/ExtendedDataUsage.md) for more details.
 */
export interface ImageIdOverride extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.ImageIdOverride;

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/Customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * An expression whose result becomes the image ID. This is
   * an [ECExpression]($docs/presentation/Customization/ECExpressions.md), so ID can be
   * defined/formatted dynamically based on the context - for example ECInstance property value.
   *
   * @minLength 1
   */
  imageIdExpression: string;
}
