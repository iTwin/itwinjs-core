/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import { PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "./Operators";

/**
 * Type that describes property filter.
 * @beta
 */
export type PropertyFilter = PropertyFilterRule | PropertyFilterRuleGroup;

/**
 * Data structure that describes group of filter rules.
 * @beta
 */
export interface PropertyFilterRuleGroup {
  /** Operator that should join rules in this group. */
  operator: PropertyFilterRuleGroupOperator;
  /** Rules in this group. */
  rules: Array<PropertyFilter>;
}

/**
 * Data structure that describes single filter rule.
 * @beta
 */
export interface PropertyFilterRule {
  /** Property used in this rule. */
  property: PropertyDescription;
  /** Operator that should be used to evaluate property value. */
  operator: PropertyFilterRuleOperator;
  /** Value that property should be compared to. */
  value?: PropertyValue;
}

/**
 * Function that checks if supplied filter is rule group.
 * @beta
 */
export function isPropertyFilterRuleGroup(filter: PropertyFilter): filter is PropertyFilterRuleGroup {
  return (filter as any).rules !== undefined;
}
