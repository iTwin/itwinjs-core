/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { SingleSchemaClassSpecification } from "../ClassSpecifications";
import { RuleBase } from "../Rule";

/**
 * Sorting rules provide a way to either disable sorting or sort instances by specific properties.
 *
 * @see [Sorting rule reference documentation page]($docs/presentation/customization/SortingRule.md)
 * @public
 */
export interface SortingRuleBase extends RuleBase {
  /**
   * Defines a condition which needs to be met in order for the rule to be used. The condition is an
   * [ECExpression]($docs/presentation/customization/ECExpressions.md#rule-condition) which has to
   * evaluate to a boolean value.
   */
  condition?: string;

  /** Specifies ECClass whose ECInstances should be sorted. */
  class?: SingleSchemaClassSpecification;

  /** Specifies that [[class]] attribute defined in this rule should be handled polymorphically. */
  isPolymorphic?: boolean;
}

/**
 * Sorting rules provide a way to either disable sorting or sort instances by specific properties.
 *
 * @see [Sorting rule reference documentation page]($docs/presentation/customization/SortingRule.md)
 * @public
 */
export type SortingRule = PropertySortingRule | DisabledSortingRule;

/**
 * Rule to configure sorting for certain ECInstances in the hierarchy and/or content. It is possible to configure different sorting for different types of ECInstances.
 *
 * @see [Property sorting rule reference documentation section]($docs/presentation/customization/SortingRule.md#property-sorting-rule)
 * @public
 */
export interface PropertySortingRule extends SortingRuleBase {
  /** Used for serializing to JSON. */
  ruleType: "PropertySorting";

  /**
   * Specifies name of the property which should be used for sorting.
   *
   * @minLength 1
   */
  propertyName: string;

  /** Specifies whether instances should be sorted in ascending order or descending. */
  sortAscending?: boolean;
}

/**
 * Rule to disable sorting for certain ECInstances in the hierarchy and/or content.
 *
 * @see [Disabled sorting rule reference documentation section]($docs/presentation/customization/SortingRule.md#disabled-sorting-rule)
 * @public
 */
export interface DisabledSortingRule extends SortingRuleBase {
  /** Used for serializing to JSON. */
  ruleType: "DisabledSorting";
}
