/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RuleBase } from "../Rule";

/**
 * ImageId override rules allow setting an image ID to specific types of ECInstances.
 *
 * @see [Image ID override reference documentation page]($docs/presentation/customization/ImageIdOverride.md)
 * @public
 * @deprecated in 3.x. Use [[ExtendedDataRule]] instead. See [extended data usage page]($docs/presentation/customization/ExtendedDataUsage.md) for more details.
 */
export interface ImageIdOverride extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: "ImageIdOverride";

  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/presentation/advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * An expression whose result becomes the image ID. This is
   * an [ECExpression]($docs/presentation/customization/ECExpressions.md), so ID can be
   * defined/formatted dynamically based on the context - for example ECInstance property value.
   *
   * @minLength 1
   */
  imageIdExpression: string;
}
