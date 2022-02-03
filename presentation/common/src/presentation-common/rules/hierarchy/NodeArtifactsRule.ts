/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { ConditionContainer, RuleBase, RuleTypes } from "../Rule";

/**
 * Rule used to create and assign artifacts to specific nodes. The artifacts can be
 * accessed when evaluating parent node's `hideExpression` to decide whether it should
 * be hidden or not.
 *
 * A typical use case:
 * - The hierarchy consists of *Subject* nodes and each *Subject* may or may not have child *Model* nodes. There are 2 types
 * of *Models*: *A* & *B*, we want *ModelA* nodes to be visible and *ModelB* ones to be hidden. We want *Subject* node to be
 * visible only if it has a *Model* (either *A* or *B*). In this case we can't use `hideIfNoChildren` flag on *Subjects*, because
 * a *Subject* node may only have a related *ModelB* which means *Subject* doesn't have children and should be displayed as a leaf node.
 * The solution is to use `NodeArtifacts` on the *ModelB* nodes and a `hideExpression` on *Subject* nodes. The expression can access
 * artifacts created by child *ModelB* nodes: `NOT ThisNode.HasChildren AND NOT ThisNode.ChildrenArtifacts.AnyMatches(x => x.IsModelB)`
 *
 * @note The rule is costly performance-wise and should only be used in very limited amount of specific cases where
 * hidden child nodes need to be used to used to determine parent node's visibility.
 *
 * @see [More details]($docs/presentation/Hierarchies/NodeArtifactsRule.md)
 * @public
 */
export interface NodeArtifactsRule extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.NodeArtifacts;

  /**
   * Defines a condition for the rule, which needs to be met in order for it to be used. Condition
   * is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/Customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * A map of items that define the values stored in the artifacts data structure.
   *
   * The key part of the pair should be unique within all keys which are used for specific
   * presentation object, even if they are applied using different `NodeArtifacts` definitions.
   *
   * The value part of the pair is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/Customization/ECExpressions.md#override-value) and whose
   * evaluated result is used as the artifact value.
   */
  items: { [key: string]: string };
}
