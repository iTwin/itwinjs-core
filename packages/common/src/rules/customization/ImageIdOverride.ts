/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RuleTypes, RuleBase, ConditionContainer } from "../Rule";

/**
 * Rule that allows overriding default icon and dynamically define an icon
 * for a particular node based on the context.
 */
export interface ImageIdOverride extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.ImageIdOverride;

  /**
   * Defines an image ID that should be used for nodes that meet rule condition. This is
   * an [ECExpression]($docs/learning/customization/ECExpressions.md), so ID can be
   * defined/formatted dynamically based on the context - for example ECInstance property value.
   *
   * @minLength 1
   */
  imageIdExpression: string;
}
