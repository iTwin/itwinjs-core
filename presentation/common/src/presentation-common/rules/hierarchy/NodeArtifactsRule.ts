/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RuleBase } from "../Rule";

/**
 * Node artifacts rules are used to create and assign artifacts to specific nodes. The artifacts can be
 * accessed when evaluating parent node's `hideExpression` to decide whether it should be hidden or not.
 *
 * @see [Node artifacts rule reference documentation page]($docs/presentation/hierarchies/NodeArtifactsRule.md)
 * @public
 */
export interface NodeArtifactsRule extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: "NodeArtifacts";

  /**
   * Specifies an [ECExpression]($docs/presentation/customization/ECExpressions.md#rule-condition) that
   * allows applying node artifacts based on evaluation result, e.g. by some property of the parent node.
   */
  condition?: string;

  /**
   * A map of [ECExpressions]($docs/presentation/hierarchies/ECExpressions.md#specification) whose evaluation results
   * are used as artifact values.
   */
  items: { [key: string]: string };
}
