/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import { FilterRuleGroupOperator, FilterRuleOperator } from "@itwin/components-react";
import { ClassId, PropertiesField } from "@itwin/presentation-common";

export type PresentationInstanceFilter = PresentationInstanceFilterConditionGroup | PresentationInstanceFilterCondition;

export interface PresentationInstanceFilterConditionGroup {
  operator: FilterRuleGroupOperator;
  conditions: PresentationInstanceFilter[];
}

export interface PresentationInstanceFilterCondition {
  operator: FilterRuleOperator;
  field: PropertiesField;
  value?: PropertyValue;
}

export interface PropertyInfo {
  sourceClassIds: ClassId[];
  field: PropertiesField;
  propertyDescription: PropertyDescription;
}
