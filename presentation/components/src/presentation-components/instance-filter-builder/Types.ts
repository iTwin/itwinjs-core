/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import { PrimitiveValue, PropertyDescription } from "@itwin/appui-abstract";
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
  value?: PrimitiveValue;
}

/** @alpha */
export interface InstanceFilterPropertyInfo {
  sourceClassId: ClassId;
  field: PropertiesField;
  propertyDescription: PropertyDescription;
  className: string;
  categoryLabel?: string;
}
