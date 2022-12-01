/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import { PropertyDescription, PropertyValueFormat } from "@itwin/appui-abstract";
import { isPropertyFilterRuleGroup, PropertyFilter, PropertyFilterRule, PropertyFilterRuleGroup } from "@itwin/components-react";
import {
  CategoryDescription, ClassInfo, Descriptor, Field, FIELD_NAMES_SEPARATOR, NestedContentField, PropertiesField,
} from "@itwin/presentation-common";
import { createPropertyDescriptionFromFieldInfo } from "../common/ContentBuilder";
import { findField } from "../common/Utils";
import { InstanceFilterPropertyInfo, isPresentationInstanceFilterConditionGroup, PresentationInstanceFilter, PresentationInstanceFilterCondition, PresentationInstanceFilterConditionGroup } from "./Types";

/** @alpha */
export function createInstanceFilterPropertyInfos(descriptor: Descriptor): InstanceFilterPropertyInfo[] {
  const propertyInfos = new Array<InstanceFilterPropertyInfo>();
  for (const field of descriptor.fields) {
    propertyInfos.push(...createPropertyInfos(field));
  }
  return propertyInfos;
}

/** @internal */
export function createPresentationInstanceFilter(descriptor: Descriptor, filter: PropertyFilter) {
  if (isPropertyFilterRuleGroup(filter))
    return createPresentationInstanceFilterConditionGroup(descriptor, filter);
  return createPresentationInstanceFilterCondition(descriptor, filter);
}

/** @internal */
export function getInstanceFilterFieldName(property: PropertyDescription) {
  const [_, fieldName] = property.name.split(INSTANCE_FILTER_FIELD_SEPARATOR);
  return fieldName;
}

function getPropertySourceClassInfo(field: PropertiesField | NestedContentField): ClassInfo {
  if (field.parent)
    return getPropertySourceClassInfo(field.parent);

  if (field.isPropertiesField())
    return field.properties[0].property.classInfo;
  return field.pathToPrimaryClass[field.pathToPrimaryClass.length - 1].targetClassInfo;
}

function createPresentationInstanceFilterConditionGroup(descriptor: Descriptor, group: PropertyFilterRuleGroup): PresentationInstanceFilter | undefined {
  const conditions = new Array<PresentationInstanceFilter>();
  for (const rule of group.rules) {
    const condition = createPresentationInstanceFilter(descriptor, rule);
    if (!condition)
      return undefined;
    conditions.push(condition);
  }

  if (conditions.length === 0)
    return undefined;

  if (conditions.length === 1)
    return conditions[0];

  return {
    operator: group.operator,
    conditions,
  };
}

function createPresentationInstanceFilterCondition(descriptor: Descriptor, condition: PropertyFilterRule): PresentationInstanceFilterCondition | undefined {
  const field = findField(descriptor, getInstanceFilterFieldName(condition.property));
  if (!field || !field.isPropertiesField())
    return undefined;
  if (condition.value && condition.value.valueFormat !== PropertyValueFormat.Primitive)
    return undefined;
  return {
    operator: condition.operator,
    field,
    value: condition.value,
  };
}

function createPropertyInfos(field: Field): InstanceFilterPropertyInfo[] {
  if (field.isNestedContentField()) {
    return field.nestedFields.flatMap((nestedField) => createPropertyInfos(nestedField));
  }
  // istanbul ignore else
  if (field.isPropertiesField()) {
    return [createPropertyInfoFromPropertiesField(field)];
  }
  // istanbul ignore next
  return [];
}

interface CategoryInfo {
  name?: string;
  label?: string;
}

function getCategoryInfo(category: CategoryDescription, categoryInfo: CategoryInfo): CategoryInfo {
  if (!category.parent)
    return categoryInfo;
  return getCategoryInfo(category.parent,
    {
      name: categoryInfo.name ? `${category.name}/${categoryInfo.name}` : `${category.name}`,
      label: categoryInfo.label ? `${category.label} | ${categoryInfo.label}` : `${category.label}`,
    });
}

function getParentNames(field: Field, name: string): string {
  if (!field.parent)
    return getPrefixedFieldName(name, field.name);
  return getParentNames(field.parent, getPrefixedFieldName(name, field.name));
}

function createPropertyInfoFromPropertiesField(field: PropertiesField): InstanceFilterPropertyInfo {
  const categoryInfo = getCategoryInfo(field.category, { name: undefined, label: undefined });
  const name = field.parent ? getParentNames(field.parent, field.name) : field.name;

  const propertyDescription = createPropertyDescriptionFromFieldInfo({
    name: getCategorizedFieldName(name, categoryInfo.name),
    label: field.label,
    type: field.type,
    editor: field.editor,
    enum: field.properties[0].property.enumerationInfo,
    isReadonly: field.isReadonly,
    renderer: field.renderer,
  });

  return {
    field,
    sourceClassId: getPropertySourceClassInfo(field).id,
    propertyDescription,
    categoryLabel: categoryInfo.label,
    className: field.properties[0].property.classInfo.name,
  };
}

/** @alpha */
export const INSTANCE_FILTER_FIELD_SEPARATOR = "#";
function getCategorizedFieldName(fieldName: string, categoryName?: string) {
  return `${categoryName ?? ""}${INSTANCE_FILTER_FIELD_SEPARATOR}${fieldName}`;
}

function getPrefixedFieldName(str: string, prefix: string) {
  return `${prefix}${FIELD_NAMES_SEPARATOR}${str}`;
}

function convertPresentationInstanceFilterCondition(filter: PresentationInstanceFilterCondition, descriptor: Descriptor) {
  const field = descriptor.getFieldByName(filter.field.name, true);
  if (!field || !field.isPropertiesField())
    return undefined;
  return {
    property: createPropertyInfoFromPropertiesField(field).propertyDescription,
    operator: filter.operator,
    value: filter.value,
  };
}

function convertPresentationInstanceFilterConditionGroup(filter: PresentationInstanceFilterConditionGroup, descriptor: Descriptor) {
  const rules: PropertyFilter[] = [];
  for (const condition of filter.conditions) {
    const rule = convertPresentationFilterToPropertyFilter(descriptor, condition);
    if (!rule)
      return undefined;
    rules.push(rule);
  }
  return {
    operator: filter.operator,
    rules,
  };
}

/** @alpha */
export function convertPresentationFilterToPropertyFilter(descriptor: Descriptor, filter?: PresentationInstanceFilter): PropertyFilter | undefined {
  if (!filter)
    return undefined;
  if (isPresentationInstanceFilterConditionGroup(filter))
    return convertPresentationInstanceFilterConditionGroup(filter, descriptor);
  return convertPresentationInstanceFilterCondition(filter, descriptor);
}
