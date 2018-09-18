/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RuleTypes, RuleBase, ConditionContainer } from "../Rule";
import { SingleSchemaClassSpecification } from "../ClassSpecifications";

/**
 * Base class for all [[SortingRule]] implementations
 */
export interface SortingRuleBase extends RuleBase, ConditionContainer {
  /**
   * Defines a condition for the rule, which needs to be met in order to execute it. Condition
   * is an [ECExpression]($docs/learning/ECExpressions.md), which can use
   * a [limited set of symbols]($docs/learning/customization/ECExpressions.md#rule-condition).
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

/** Sorting rule implementations */
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
 */
export interface DisabledSortingRule extends SortingRuleBase {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.DisabledSorting;
}
