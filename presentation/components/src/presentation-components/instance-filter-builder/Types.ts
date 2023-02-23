/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import { PrimitiveValue } from "@itwin/appui-abstract";
import { PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "@itwin/components-react";
import { PropertiesField } from "@itwin/presentation-common";

/**
 * Type that describes instance filter based on [Descriptor]($presentation-common) fields. It can be
 * one filter condition or group of filter conditions joined by logical operator.
 * @beta
 */
export type PresentationInstanceFilter = PresentationInstanceFilterConditionGroup | PresentationInstanceFilterCondition;

/**
 * Data structure that describes group of filter condition joined by logical operator.
 * @beta
 */
export interface PresentationInstanceFilterConditionGroup {
  /** Operator that should be used to join conditions. */
  operator: PropertyFilterRuleGroupOperator;
  /** Conditions in this group. */
  conditions: PresentationInstanceFilter[];
}

/**
 * Data structure that describes single filter condition.
 * @beta
 */
export interface PresentationInstanceFilterCondition {
  /** [PropertiesField]($presentation-common) that contains property used in this condition. */
  field: PropertiesField;
  /** Operator that should be used to compare property value. */
  operator: PropertyFilterRuleOperator;
  /** Value that property should be compared to. */
  value?: PrimitiveValue;
}

/**
 * Function that checks if supplied [[PresentationInstanceFilter]] is [[PresentationInstanceFilterConditionGroup]].
 * @beta
 */
export function isPresentationInstanceFilterConditionGroup(filter: PresentationInstanceFilter): filter is PresentationInstanceFilterConditionGroup {
  return (filter as any).conditions !== undefined;
}
