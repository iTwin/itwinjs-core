/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import { PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "@itwin/components-react";
import { ClassId, PropertiesField } from "@itwin/presentation-common";

/** @alpha */
export type PresentationInstanceFilter = PresentationInstanceFilterConditionGroup | PresentationInstanceFilterCondition;

/** @alpha */
export interface PresentationInstanceFilterConditionGroup {
  operator: PropertyFilterRuleGroupOperator;
  conditions: PresentationInstanceFilter[];
}

/** @alpha */
export interface PresentationInstanceFilterCondition {
  operator: PropertyFilterRuleOperator;
  field: PropertiesField;
  value?: PropertyValue;
}

/** @alpha */
export interface PropertyInfo {
  sourceClassIds: ClassId[];
  field: PropertiesField;
  propertyDescription: PropertyDescription;
}
