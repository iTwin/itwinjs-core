/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import { FilterRuleGroupOperator, FilterRuleOperator } from "./Operators";

/** @alpha */
export type Filter = FilterCondition | FilterConditionGroup;

/** @alpha */
export interface FilterConditionGroup {
  operator: FilterRuleGroupOperator;
  conditions: Array<FilterConditionGroup | FilterCondition>;
}

/** @alpha */
export interface FilterCondition {
  property: PropertyDescription;
  operator: FilterRuleOperator;
  value?: PropertyValue;
}

/** @alpha */
export function isFilterConditionGroup(filter: Filter): filter is FilterConditionGroup {
  return (filter as any).conditions !== undefined;
}
