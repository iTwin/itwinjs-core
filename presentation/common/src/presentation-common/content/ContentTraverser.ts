/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import { assert, IDisposable, using } from "@itwin/core-bentley";
import { CategoryDescription } from "./Category";
import { Content } from "./Content";
import { Descriptor } from "./Descriptor";
import { Field, NestedContentField } from "./Fields";
import { Item } from "./Item";
import { PropertyValueFormat, TypeDescription } from "./TypeDescription";
import { DisplayValue, DisplayValuesArray, DisplayValuesMap, NestedContentValue, Value, ValuesArray, ValuesMap } from "./Value";

/** @alpha */
export interface FieldHierarchy {
  field: Field;
  childFields: FieldHierarchy[];
}

/** @alpha */
export interface StartContentProps {
  descriptor: Descriptor;
}

/** @alpha */
export interface ProcessFieldHierarchiesProps {
  hierarchies: FieldHierarchy[];
}

/** @alpha */
export interface StartItemProps {
  item: Item;
}

/** @alpha */
export interface StartCategoryProps {
  category: CategoryDescription;
}

/** @alpha */
export interface StartFieldProps {
  hierarchy: FieldHierarchy;
}

/** @alpha */
export interface StartStructProps {
  hierarchy: FieldHierarchy;
  valueType: TypeDescription;
  namePrefix?: string;
  rawValues: ValuesMap;
  displayValues: DisplayValuesMap;
}

/** @alpha */
export interface StartArrayProps {
  hierarchy: FieldHierarchy;
  valueType: TypeDescription;
  namePrefix?: string;
  rawValues: ValuesArray;
  displayValues: DisplayValuesArray;
}

/** @alpha */
export interface ProcessMergedValueProps {
  mergedField: Field;
  requestedField: Field;
  namePrefix?: string;
}

/** @alpha */
export interface ProcessPrimitiveValueProps {
  field: Field;
  valueType: TypeDescription;
  namePrefix?: string;
  rawValue: Value;
  displayValue: DisplayValue;
}

/** @alpha */
export interface IContentVisitor {
  startContent(props: StartContentProps): boolean;
  finishContent(): void;

  processFieldHierarchies(props: ProcessFieldHierarchiesProps): void;

  startItem(props: StartItemProps): boolean;
  finishItem(): void;

  startCategory(props: StartCategoryProps): boolean;
  finishCategory(): void;

  startField(props: StartFieldProps): boolean;
  finishField(): void;

  startStruct(props: StartStructProps): boolean;
  finishStruct(): void;

  startArray(props: StartArrayProps): boolean;
  finishArray(): void;

  processMergedValue(props: ProcessMergedValueProps): void;
  processPrimitiveValue(props: ProcessPrimitiveValueProps): void;
}

/** @internal */
export function traverseFieldHierarchy(hierarchy: FieldHierarchy, cb: (h: FieldHierarchy) => boolean) {
  if (cb(hierarchy))
    hierarchy.childFields.forEach((childHierarchy) => traverseFieldHierarchy(childHierarchy, cb));
}

/** @alpha */
export function traverseContent(visitor: IContentVisitor, content: Content) {
  if (!visitor.startContent({ descriptor: content.descriptor }))
    return;

  try {
    const fieldHierarchies = createFieldHierarchies(content.descriptor.fields);
    visitor.processFieldHierarchies({ hierarchies: fieldHierarchies });
    content.contentSet.forEach((item) => {
      traverseContentItemFields(visitor, fieldHierarchies, item);
    });
  } finally {
    visitor.finishContent();
  }
}

/** @alpha */
export function traverseContentItem(visitor: IContentVisitor, descriptor: Descriptor, item: Item) {
  if (!visitor.startContent({ descriptor }))
    return;

  try {
    const fieldHierarchies = createFieldHierarchies(descriptor.fields);
    visitor.processFieldHierarchies({ hierarchies: fieldHierarchies });
    traverseContentItemFields(visitor, fieldHierarchies, item);
  } finally {
    visitor.finishContent();
  }
}

class VisitedCategories implements IDisposable {
  private _visitedCategories: CategoryDescription[];
  private _didVisitAllHierarchy: boolean;
  constructor(private _visitor: IContentVisitor, category: CategoryDescription) {
    const stack: CategoryDescription[] = [];
    let curr: CategoryDescription | undefined = category;
    while (curr) {
      stack.push(curr);
      curr = curr.parent;
    }
    stack.reverse();

    this._didVisitAllHierarchy = true;
    this._visitedCategories = [];
    for (curr of stack) {
      if (this._visitor.startCategory({ category: curr })) {
        this._visitedCategories.push(curr);
      } else {
        this._didVisitAllHierarchy = false;
        break;
      }
    }
  }
  public dispose() {
    while (this._visitedCategories.pop())
      this._visitor.finishCategory();
  }
  public get shouldContinue(): boolean { return this._didVisitAllHierarchy; }
}

function traverseContentItemFields(visitor: IContentVisitor, fieldHierarchies: FieldHierarchy[], item: Item) {
  if (!visitor.startItem({ item }))
    return;

  try {
    fieldHierarchies.forEach((fieldHierarchy) => {
      using(new VisitedCategories(visitor, fieldHierarchy.field.category), (res) => {
        if (res.shouldContinue)
          traverseContentItemField(visitor, fieldHierarchy, item);
      });
    });
  } finally {
    visitor.finishItem();
  }
}

function traverseContentItemField(visitor: IContentVisitor, fieldHierarchy: FieldHierarchy, item: Item) {
  if (!visitor.startField({ hierarchy: fieldHierarchy }))
    return;

  try {
    const rootToThisField = createFieldPath(fieldHierarchy.field);
    let namePrefix: string | undefined;
    const pathUpToField = rootToThisField.slice(undefined, -1);
    for (let i = 0; i < pathUpToField.length; ++i) {
      const parentField = pathUpToField[i] as NestedContentField;
      const nextField = rootToThisField[i + 1];

      if (item.isFieldMerged(parentField.name)) {
        visitor.processMergedValue({ requestedField: fieldHierarchy.field, mergedField: parentField, namePrefix });
        return;
      }

      const { emptyNestedItem, convertedItem } = convertNestedContentItemToStructArrayItem(item, parentField, nextField);
      if (emptyNestedItem)
        return;

      item = convertedItem;
      namePrefix = applyOptionalPrefix(parentField.name, namePrefix);
    }

    if (item.isFieldMerged(fieldHierarchy.field.name)) {
      visitor.processMergedValue({ requestedField: fieldHierarchy.field, mergedField: fieldHierarchy.field, namePrefix });
      return;
    }

    if (fieldHierarchy.field.isNestedContentField()) {
      fieldHierarchy = convertNestedContentFieldHierarchyToStructArrayHierarchy(fieldHierarchy, namePrefix);
      const { emptyNestedItem, convertedItem } = convertNestedContentFieldHierarchyItemToStructArrayItem(item, fieldHierarchy);
      if (emptyNestedItem)
        return;
      item = convertedItem;
    } else if (pathUpToField.length > 0) {
      fieldHierarchy = {
        ...fieldHierarchy,
        field: Object.assign(fieldHierarchy.field.clone(), {
          type: {
            valueFormat: PropertyValueFormat.Array,
            typeName: `${fieldHierarchy.field.type.typeName}[]`,
            memberType: fieldHierarchy.field.type,
          },
        }),
      };
    }

    traverseContentItemFieldValue(visitor, fieldHierarchy, item.mergedFieldNames, fieldHierarchy.field.type, namePrefix, item.values[fieldHierarchy.field.name], item.displayValues[fieldHierarchy.field.name]);

  } finally {
    visitor.finishField();
  }
}

function traverseContentItemFieldValue(visitor: IContentVisitor, fieldHierarchy: FieldHierarchy, mergedFieldNames: string[], valueType: TypeDescription, namePrefix: string | undefined, rawValue: Value, displayValue: DisplayValue) {
  if (rawValue !== undefined) {
    if (valueType.valueFormat === PropertyValueFormat.Array) {
      assert(Value.isArray(rawValue));
      assert(DisplayValue.isArray(displayValue));
      return traverseContentItemArrayFieldValue(visitor, fieldHierarchy, mergedFieldNames, valueType, namePrefix, rawValue, displayValue);
    }
    if (valueType.valueFormat === PropertyValueFormat.Struct) {
      assert(Value.isMap(rawValue));
      assert(DisplayValue.isMap(displayValue));
      return traverseContentItemStructFieldValue(visitor, fieldHierarchy, mergedFieldNames, valueType, namePrefix, rawValue, displayValue);
    }
  }
  traverseContentItemPrimitiveFieldValue(visitor, fieldHierarchy, mergedFieldNames, valueType, namePrefix, rawValue, displayValue);
}

function traverseContentItemArrayFieldValue(visitor: IContentVisitor, fieldHierarchy: FieldHierarchy, mergedFieldNames: string[], valueType: TypeDescription, namePrefix: string | undefined, rawValues: ValuesArray, displayValues: DisplayValuesArray) {
  assert(rawValues.length === displayValues.length);
  assert(valueType.valueFormat === PropertyValueFormat.Array);
  if (!visitor.startArray({ hierarchy: fieldHierarchy, valueType, namePrefix, rawValues, displayValues }))
    return;

  try {
    const itemType = valueType.memberType;
    rawValues.forEach((_, i) => {
      traverseContentItemFieldValue(visitor, fieldHierarchy, mergedFieldNames, itemType, namePrefix, rawValues[i], displayValues[i]);
    });
  } finally {
    visitor.finishArray();
  }
}

function traverseContentItemStructFieldValue(visitor: IContentVisitor, fieldHierarchy: FieldHierarchy, mergedFieldNames: string[], valueType: TypeDescription, namePrefix: string | undefined, rawValues: ValuesMap, displayValues: DisplayValuesMap) {
  assert(valueType.valueFormat === PropertyValueFormat.Struct);
  if (!visitor.startStruct({ hierarchy: fieldHierarchy, valueType, namePrefix, rawValues, displayValues }))
    return;

  try {
    if (fieldHierarchy.field.isNestedContentField())
      namePrefix = applyOptionalPrefix(fieldHierarchy.field.name, namePrefix);

    valueType.members.forEach((memberDescription) => {
      let memberField = fieldHierarchy.childFields.find((f) => f.field.name === memberDescription.name);
      if (!memberField) {
        // Not finding a member field means we're traversing an ECStruct. We still need to carry member information, so we
        // create a fake field to represent the member
        memberField = {
          field: new Field(fieldHierarchy.field.category, memberDescription.name, memberDescription.label, memberDescription.type, fieldHierarchy.field.isReadonly, 0),
          childFields: [],
        };
      }
      traverseContentItemFieldValue(visitor, memberField, mergedFieldNames, memberDescription.type, namePrefix, rawValues[memberDescription.name], displayValues[memberDescription.name]);
    });
  } finally {
    visitor.finishStruct();
  }
}

function traverseContentItemPrimitiveFieldValue(visitor: IContentVisitor, fieldHierarchy: FieldHierarchy, mergedFieldNames: string[], valueType: TypeDescription, namePrefix: string | undefined, rawValue: Value, displayValue: DisplayValue) {
  if (-1 !== mergedFieldNames.indexOf(fieldHierarchy.field.name)) {
    visitor.processMergedValue({ mergedField: fieldHierarchy.field, requestedField: fieldHierarchy.field, namePrefix });
    return;
  }

  visitor.processPrimitiveValue({ field: fieldHierarchy.field, valueType, namePrefix, rawValue, displayValue });
}

/**
  * `ignoreCategories` parameter enables adding all of the `nestedFields` to parent field's `childFields`
  *  without considering categories.
  *  @internal
 */
export function createFieldHierarchies(fields: Field[], ignoreCategories?: Boolean) {
  const hierarchies = new Array<FieldHierarchy>();
  const visitField = (category: CategoryDescription, field: Field, parentField: Field | undefined): FieldHierarchy | undefined => {
    let childFields: FieldHierarchy[] = [];
    if (field.isNestedContentField()) {
      // visit all nested fields
      childFields = visitFields(field.nestedFields, field);
      if (0 === childFields.length)
        return undefined;
    }
    const fieldHierarchy = { field, childFields };
    if (category === parentField?.category || ignoreCategories && parentField) {
      // if categories of this field and its parent field match - return the field hierarchy without
      // including it as a top level field
      return fieldHierarchy;
    }
    addFieldHierarchy(hierarchies, fieldHierarchy);
    return undefined;
  };
  const visitFields = (visitedFields: Field[], parentField: NestedContentField | undefined) => {
    const includedFields: FieldHierarchy[] = [];
    visitedFields.forEach((field) => {
      const visitedField = visitField(field.category, field, parentField);
      if (visitedField)
        includedFields.push(visitedField);
    });
    return includedFields;
  };
  visitFields(fields, undefined);
  return hierarchies;
}

function findRelatedFields(rootFields: FieldHierarchy[], hierarchy: FieldHierarchy) {
  // build a list of parent fields in hierarchy
  const fields: Field[] = [];
  let currField: Field | undefined = hierarchy.field;
  while (currField) {
    fields.push(currField);
    currField = currField.parent;
  }

  for (let rootIndex = 0; rootIndex < rootFields.length; ++rootIndex) {
    const rootFieldHierarchy = rootFields[rootIndex];
    if (rootFieldHierarchy.field.category !== hierarchy.field.category) {
      // only interested in fields with the same category
      continue;
    }

    let first = true;
    currField = rootFieldHierarchy.field;
    while (currField) {
      const index = fields.findIndex((f) => f.name === currField!.name);
      if (-1 !== index) {
        return {
          existing: {
            field: currField,
            hierarchy: first ? rootFieldHierarchy : undefined,
            index: rootIndex,
          },
          matchingField: fields[index]!,
        };
      }
      currField = currField.parent;
      first = false;
    }
  }

  return undefined;
}

function buildParentHierarchy(hierarchy: FieldHierarchy, parentField: Field) {
  // note: parentField is found by walking up the parentship relationship
  // from hierarchy.field, so we expect to always find it here
  while (hierarchy.field !== parentField) {
    const hierarchyParent = hierarchy.field.parent;
    assert(hierarchyParent !== undefined);
    hierarchy = { field: hierarchyParent, childFields: [hierarchy] };
  }
  return hierarchy;
}

function mergeHierarchies(lhs: FieldHierarchy, rhs: FieldHierarchy) {
  assert(lhs.field.name === rhs.field.name);
  const result: FieldHierarchy = {
    field: lhs.field.clone(),
    childFields: [...lhs.childFields],
  };
  rhs.childFields.forEach((rhsChildHierarchy) => {
    const indexInResult = result.childFields.findIndex((resultHierarchy) => resultHierarchy.field.name === rhsChildHierarchy.field.name);
    if (indexInResult !== -1)
      result.childFields[indexInResult] = mergeHierarchies(result.childFields[indexInResult], rhsChildHierarchy);
    else
      result.childFields.push(rhsChildHierarchy);
  });
  return result;
}

/** @alpha */
export function addFieldHierarchy(rootHierarchies: FieldHierarchy[], hierarchy: FieldHierarchy): void {
  const match = findRelatedFields(rootHierarchies, hierarchy);
  if (!match) {
    rootHierarchies.push(hierarchy);
    return;
  }

  const targetHierarchy = rootHierarchies[match.existing.index];
  const existingHierarchy = match.existing.hierarchy ?? buildParentHierarchy(targetHierarchy, match.existing.field);
  const insertHierarchy = buildParentHierarchy(hierarchy, match.matchingField);
  const mergedHierarchy = mergeHierarchies(existingHierarchy, insertHierarchy);
  mergedHierarchy.field.category = hierarchy.field.category;
  rootHierarchies[match.existing.index] = mergedHierarchy;
}

function createFieldPath(field: Field): Field[] {
  const path = [field];
  let currField = field;
  while (currField.parent) {
    currField = currField.parent;
    path.push(currField);
  }
  path.reverse();
  return path;
}

/** @internal */
export const FIELD_NAMES_SEPARATOR = "$";
/** @internal */
export function applyOptionalPrefix(str: string, prefix?: string) {
  return prefix ? `${prefix}${FIELD_NAMES_SEPARATOR}${str}` : str;
}

interface NestedItemConversionResult {
  emptyNestedItem: boolean;
  convertedItem: Item;
}

function convertNestedContentItemToStructArrayItem(item: Readonly<Item>, field: Field, nextField: Field): NestedItemConversionResult {
  const value = item.values[field.name] ?? [];
  assert(Value.isNestedContent(value));
  if (value.length === 0)
    return { emptyNestedItem: true, convertedItem: item };

  const nextFieldValues: { raw: ValuesArray, display: DisplayValuesArray } = { raw: [], display: [] };
  value.forEach((ncv) => {
    const nextRawValue = ncv.values[nextField.name];
    const nextDisplayValue = ncv.displayValues[nextField.name];
    if (nextField.isNestedContentField()) {
      if (nextRawValue) {
        assert(Value.isNestedContent(nextRawValue));
        nextFieldValues.raw.push(...nextRawValue);
      }
    } else {
      nextFieldValues.raw.push(nextRawValue);
      nextFieldValues.display.push(nextDisplayValue);
    }
  });
  const convertedItem = new Item(item.primaryKeys, item.label, item.imageId, item.classInfo, { [nextField.name]: nextFieldValues.raw }, { [nextField.name]: nextFieldValues.display }, item.mergedFieldNames, item.extendedData);
  return { emptyNestedItem: false, convertedItem };
}

function convertNestedContentFieldHierarchyToStructArrayHierarchy(fieldHierarchy: FieldHierarchy, namePrefix: string | undefined) {
  const fieldName = fieldHierarchy.field.name;
  const convertedChildFieldHierarchies = fieldHierarchy.childFields.map((child) => {
    if (child.field.isNestedContentField())
      return convertNestedContentFieldHierarchyToStructArrayHierarchy(child, applyOptionalPrefix(fieldName, namePrefix));
    return child;
  });
  const convertedFieldHierarchy: FieldHierarchy = {
    field: Object.assign(fieldHierarchy.field.clone(), {
      type: {
        valueFormat: PropertyValueFormat.Array,
        typeName: `${fieldHierarchy.field.type.typeName}[]`,
        memberType: {
          valueFormat: PropertyValueFormat.Struct,
          typeName: fieldHierarchy.field.type.typeName,
          members: convertedChildFieldHierarchies.map((member) => ({
            name: member.field.name,
            label: member.field.label,
            type: member.field.type,
          })),
        },
      } as TypeDescription,
    }),
    childFields: convertedChildFieldHierarchies,
  };
  return convertedFieldHierarchy;
}

function convertNestedContentValuesToStructArrayValuesRecursive(fieldHierarchy: FieldHierarchy, ncvs: ReadonlyArray<NestedContentValue>) {
  const result: { raw: ValuesArray, display: DisplayValuesArray, mergedFieldNames: string[] } = { raw: [], display: [], mergedFieldNames: [] };
  ncvs.forEach((ncv) => {
    const values: ValuesMap = { ...ncv.values };
    const displayValues: DisplayValuesMap = { ...ncv.displayValues };
    const mergedFieldNames: string[] = [...ncv.mergedFieldNames];
    fieldHierarchy.childFields.forEach((childFieldHierarchy) => {
      const childFieldName = childFieldHierarchy.field.name;
      if (-1 !== ncv.mergedFieldNames.indexOf(childFieldName)) {
        return;
      }
      if (childFieldHierarchy.field.isNestedContentField()) {
        const value = values[childFieldName];
        assert(Value.isNestedContent(value));
        const convertedValues = convertNestedContentValuesToStructArrayValuesRecursive(childFieldHierarchy, value);
        values[childFieldName] = convertedValues.raw;
        displayValues[childFieldName] = convertedValues.display;
        mergedFieldNames.push(...convertedValues.mergedFieldNames);
      }
    });
    result.raw.push(values);
    result.display.push(displayValues);
    result.mergedFieldNames.push(...mergedFieldNames);
  });
  return result;
}

function convertNestedContentFieldHierarchyItemToStructArrayItem(item: Readonly<Item>, fieldHierarchy: FieldHierarchy): NestedItemConversionResult {
  const fieldName = fieldHierarchy.field.name;
  const rawValue = item.values[fieldName];
  assert(Value.isNestedContent(rawValue));
  if (rawValue.length === 0)
    return { emptyNestedItem: true, convertedItem: item };

  const converted = convertNestedContentValuesToStructArrayValuesRecursive(fieldHierarchy, rawValue);
  const convertedItem = new Item(item.primaryKeys, item.label, item.imageId, item.classInfo, { [fieldName]: converted.raw }, { [fieldName]: converted.display }, converted.mergedFieldNames, item.extendedData);
  return { emptyNestedItem: false, convertedItem };
}
