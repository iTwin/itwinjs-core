/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyDescription } from "@itwin/appui-abstract";
import { Filter, FilterCondition, FilterConditionGroup, isFilterConditionGroup } from "@itwin/components-react";
import { CategoryDescription, ClassId, Descriptor, Field, FIELD_NAMES_SEPARATOR } from "@itwin/presentation-common";
import { createPropertyDescriptionFromFieldInfo } from "../common/ContentBuilder";
import { findField } from "../common/Utils";
import { PresentationInstanceFilter, PresentationInstanceFilterCondition, PropertyInfo } from "./Types";

export function createInstanceFilterPropertyInfos(descriptor: Descriptor): PropertyInfo[] {
  const rootCategory = findRootCategory(descriptor.categories);
  return createPropertyInfos(descriptor, {categoryName: rootCategory?.name});
}

export function createPresentationInstanceFilter(descriptor: Descriptor, filter: Filter) {
  if (isFilterConditionGroup(filter))
    return createPresentationInstanceFilterConditionGroup(descriptor, filter);
  return createPresentationInstanceFilterCondition(descriptor, filter);
}

function getInstanceFilterFieldName(property: PropertyDescription) {
  const [_, fieldName] = property.name.split(INSTANCE_FILTER_FIELD_SEPARATOR);
  return fieldName;
}

function createPresentationInstanceFilterConditionGroup(descriptor: Descriptor, group: FilterConditionGroup): PresentationInstanceFilter | undefined {
  if (group.conditions.length === 0)
    return undefined;

  const conditions = new Array<PresentationInstanceFilter>();
  for (const condition of group.conditions) {
    const newCondition = createPresentationInstanceFilter(descriptor, condition);
    if (!newCondition)
      return undefined;
    conditions.push(newCondition);
  }

  if (conditions.length === 1)
    return conditions[0];

  return {
    operator: group.operator,
    conditions,
  };
}

function createPresentationInstanceFilterCondition(descriptor: Descriptor, condition: FilterCondition): PresentationInstanceFilterCondition | undefined {
  const field = findField(descriptor, getInstanceFilterFieldName(condition.property));
  if (!field || !field.isPropertiesField())
    return undefined;
  return {
    operator: condition.operator,
    field,
    value: condition.value,
  };
}

function findRootCategory(categories: CategoryDescription[]) {
  for (const category of categories) {
    if (category.parent === undefined)
      return category;
  }
  return undefined;
}

interface ParentInfo {
  categoryName?: string;
  name?: string;
  label?: string;
}

function createPropertyInfos(descriptor: Descriptor, parentInfo: ParentInfo): PropertyInfo[] {
  const fields = new Array<PropertyInfo>();

  for (const category of descriptor.categories) {
    if (category?.parent?.name !== parentInfo.categoryName)
      continue;

    fields.push(...createPropertyInfos(descriptor, {
      categoryName: category.name,
      name: getPrefixedString(`${category.name}/`, parentInfo?.name),
      label: getPrefixedLabel(`[${category.label}]`, parentInfo?.label),
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

  if (field.category.name !== parentInfo?.categoryName || !field.isPropertiesField())
    return [];

  if (field.type.typeName.toLowerCase() === "navigation")
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
export const INSTANCE_FILTER_FIELD_SEPARATOR="#";
function getCategorizedFieldName(fieldName: string, categoryName?: string) {
  return `${categoryName ?? ""}${INSTANCE_FILTER_FIELD_SEPARATOR}${fieldName}`;
}

function getPrefixedFieldName(str: string, prefix?: string) {
  return prefix !== undefined ? `${prefix}${FIELD_NAMES_SEPARATOR}${str}` : str;
}
