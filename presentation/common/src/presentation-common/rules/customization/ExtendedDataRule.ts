/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { ConditionContainer, RuleBase, RuleTypes } from "../Rule";

/**
 * Rule used to inject some extended data into presentation data
 * objects (nodes, records).
 *
 * A couple of typical use cases:
 * - Table is showing models and elements polymorphically and application
 *   wants to handle all models and all elements differently. The rule can be used
 *   to inject some flag that tells whether table row represents a model or an element.
 * - Tree shows a hierarchy of models and elements. Then element node is clicked,
 *   application needs to additionally know element model's ID. The rule can be used
 *   to inject that ID into element's node.
 *
 * @see [More details]($docs/presentation/Customization/ExtendedDataRule.md)
 * @public
 */
export interface ExtendedDataRule extends RuleBase, ConditionContainer {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.ExtendedData;

  /**
   * Defines a condition for the rule, which needs to be met in order for it to be used. Condition
   * is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/Customization/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * A map of items that define the values stored in the extended data structure.
   *
   * The key part of the pair should be unique within all keys which are used for specific
   * presentation object, even if they are applied using different `ExtendedData` definitions.
   *
   * The value part of the pair is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/Customization/ECExpressions.md#rule-condition) and whose
   * evaluated result is used as the value of the extended data item.
   */
  items: { [key: string]: string };
}
