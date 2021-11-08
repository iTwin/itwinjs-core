/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { SingleSchemaClassSpecification } from "../ClassSpecifications";
import { ConditionContainer, RuleBase, RuleTypes } from "../Rule";

/**
 * Base class for all [[SortingRule]] implementations. Not
 * meant to be used directly, see `SortingRule`.
 *
 * @public
 */
export interface SortingRuleBase extends RuleBase, ConditionContainer {
  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/presentation/Advanced/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/presentation/Hierarchies/ECExpressions.md#rule-condition).
   */
  condition?: string;

  /**
   * Specification of ECClass whose ECInstances should be sorted by this rule.
   * Defaults to all classes in current context if not specified.
   */
  class?: SingleSchemaClassSpecification;

  /** Should [[class]] defined in this rule be handled polymorphically. */
  isPolymorphic?: boolean;
}

/**
 * Sorting rule implementations
 *
 * @see [More details]($docs/presentation/Customization/SortingRule.md)
 * @public
 */
export type SortingRule = PropertySortingRule | DisabledSortingRule;

/**
 * Rule to configure sorting for certain ECInstances in the hierarchy and/or content.
 * It is possible to configure different sorting for different types of ECInstances.
 *
 * Multiple sorting rules may be applied for the same instances - in this case the
 * instances are first sorted by the highest priority rule and then the lower priority ones.
 *
 * **Note:** This rule is not meant to be used to sort grouping nodes, custom nodes or
 * other non ECInstance type of nodes.
 *
 * @public
 */
export interface PropertySortingRule extends SortingRuleBase {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.PropertySorting;

  /**
   * Name of the property which should be used for sorting
   *
   * @minLength 1
   */
  propertyName: string;

  /** Will sort in ascending order if set to true, otherwise descending. Defaults to `true`. */
  sortAscending?: boolean;
}

/**
 * Rule to disable sorting for certain ECInstances in the hierarchy and/or content.
 *
 * **Note:** Disabling sorting increases performance
 *
 * **Note:** This rule is not meant to be used to sort grouping nodes, custom nodes or
 * other non ECInstance type of nodes.
 *
 * @public
 */
export interface DisabledSortingRule extends SortingRuleBase {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.DisabledSorting;
}
