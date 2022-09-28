/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import { PropertyDescription } from "@itwin/appui-abstract";
import { isPropertyFilterRuleGroup, PropertyFilter, PropertyFilterRule, PropertyFilterRuleGroup } from "@itwin/components-react";
import { CategoryDescription, ClassId, Descriptor, Field, FIELD_NAMES_SEPARATOR } from "@itwin/presentation-common";
import { createPropertyDescriptionFromFieldInfo } from "../common/ContentBuilder";
import { findField } from "../common/Utils";
import { PresentationInstanceFilter, PresentationInstanceFilterCondition, PropertyInfo } from "./Types";

/** @alpha */
export function createInstanceFilterPropertyInfos(descriptor: Descriptor): PropertyInfo[] {
  const rootCategoryName = findRootCategoryName(descriptor.categories);
  return createPropertyInfos(descriptor, { categoryName: rootCategoryName });
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
  return {
    operator: condition.operator,
    field,
    value: condition.value,
  };
}

function findRootCategoryName(categories: CategoryDescription[]) {
  /* istanbul ignore next */
  return categories.find((category) => category.parent === undefined)?.name;
}

interface ParentInfo {
  categoryName?: string;
  name?: string;
  label?: string;
}

function createPropertyInfos(descriptor: Descriptor, parentInfo: ParentInfo): PropertyInfo[] {
  const fields = new Array<PropertyInfo>();

  for (const category of descriptor.categories) {
    if (category.parent?.name !== parentInfo.categoryName)
      continue;

    fields.push(...createPropertyInfos(descriptor, {
      categoryName: category.name,
      name: getPrefixedString(`${category.name}/`, parentInfo.name),
      label: getPrefixedLabel(`[${category.label}]`, parentInfo.label),
    }));
  }

  for (const field of descriptor.fields) {
    const sourceClassIds = getSourceClassIds(field);
    fields.push(...createPropertyInfosFromContentField(field, parentInfo, sourceClassIds, undefined));
  }

  return fields;
}

function createPropertyInfosFromContentField(field: Field, parentInfo: ParentInfo, sourceClassIds?: ClassId[], fieldNamePrefix?: string): PropertyInfo[] {
  if (field.isNestedContentField()) {
    const childPrefix = getPrefixedFieldName(field.name, fieldNamePrefix);
    return field.nestedFields.flatMap((nestedField) => createPropertyInfosFromContentField(nestedField, parentInfo, sourceClassIds, childPrefix));
  }

  if (field.category.name !== parentInfo.categoryName || !field.isPropertiesField())
    return [];

  const fieldName = getPrefixedFieldName(field.name, fieldNamePrefix);
  const propertyDescription = createPropertyDescriptionFromFieldInfo({
    name: getCategorizedFieldName(fieldName, parentInfo.name),
    label: getPrefixedLabel(field.label, parentInfo.label),
    type: field.type,
    editor: field.editor,
    enum: field.properties[0].property.enumerationInfo,
    isReadonly: field.isReadonly,
    renderer: field.renderer,
  });

  return [{
    field,
    sourceClassIds: sourceClassIds ?? [field.properties[0].property.classInfo.id],
    propertyDescription,
  }];
}

function getSourceClassIds(field: Field) {
  if (field.isNestedContentField())
    return field.actualPrimaryClassIds;

  return undefined;
}

function getPrefixedLabel(label: string, prefix?: string) {
  return prefix !== undefined ? `${prefix} ${label}` : label;
}

function getPrefixedString(value: string, prefix?: string) {
  return `${prefix ?? ""}${value}`;
}

/** @alpha */
export const INSTANCE_FILTER_FIELD_SEPARATOR = "#";
function getCategorizedFieldName(fieldName: string, categoryName?: string) {
  return `${categoryName ?? ""}${INSTANCE_FILTER_FIELD_SEPARATOR}${fieldName}`;
}

function getPrefixedFieldName(str: string, prefix?: string) {
  return prefix !== undefined ? `${prefix}${FIELD_NAMES_SEPARATOR}${str}` : str;
}
