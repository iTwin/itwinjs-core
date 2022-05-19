/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import { FilterRuleGroupOperator, FilterRuleOperator } from "./Operators";

/** @alpha */
export type Filter = FilterRule | FilterRuleGroup;

/** @alpha */
export interface FilterRuleGroup {
  operator: FilterRuleGroupOperator;
  rules: Array<Filter>;
}

/** @alpha */
export interface FilterRule {
  property: PropertyDescription;
  operator: FilterRuleOperator;
  value?: PropertyValue;
}

/** @alpha */
export function isFilterRuleGroup(filter: Filter): filter is FilterRuleGroup {
  return (filter as any).rules !== undefined;
}
