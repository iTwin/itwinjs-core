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

/**
 * A data structure to define a hierarchy of [[Field]] objects.
 * @public
 */
export interface FieldHierarchy {
  /** Parent field. */
  field: Field;
  /** Nested fields. */
  childFields: FieldHierarchy[];
}

/**
 * Props for the [[IContentVisitor.startContent]] call.
 * @public
 */
export interface StartContentProps {
  /** Descriptor of the visited content. */
  descriptor: Descriptor;
}

/**
 * Props for the [[IContentVisitor.processFieldHierarchies]] call.
 * @public
 */
export interface ProcessFieldHierarchiesProps {
  /**
   * The root list of fields, which may be mutated by the visitor to change order or the fields,
   * add new fields, etc.
   */
  hierarchies: FieldHierarchy[];
}

/**
 * Props for the [[IContentVisitor.startItem]] call.
 * @public
 */
export interface StartItemProps {
  /** The content item that's about to be visited. */
  item: Item;
}

/**
 * Props for the [[IContentVisitor.startCategory]] call.
 * @public
 */
export interface StartCategoryProps {
  /** The content category that's about to be visited. */
  category: CategoryDescription;
}

/**
 * Props for the [[IContentVisitor.startField]] call.
 * @public
 */
export interface StartFieldProps {
  /** The field that's about to be visited. */
  hierarchy: FieldHierarchy;
}

/**
 * Props for the [[IContentVisitor.startStruct]] call.
 * @public
 */
export interface StartStructProps {
  /** Field that describes the struct. */
  hierarchy: FieldHierarchy;
  /** Type of the struct. */
  valueType: TypeDescription;
  /** Name of the parent field (if there is one). */
  parentFieldName?: string;
  /** Member raw values. */
  rawValues: ValuesMap;
  /** Member display values. */
  displayValues: DisplayValuesMap;
}

/**
 * Props for the [[IContentVisitor.startArray]] call.
 * @public
 */
export interface StartArrayProps {
  /** Field that describes the array. */
  hierarchy: FieldHierarchy;
  /** Type of the array. */
  valueType: TypeDescription;
  /** Name of the parent field (if there is one). */
  parentFieldName?: string;
  /** Item raw values. */
  rawValues: ValuesArray;
  /** Item display values. */
  displayValues: DisplayValuesArray;
}

/**
 * Props for the [[IContentVisitor.processMergedValue]] call.
 * @public
 */
export interface ProcessMergedValueProps {
  /** The field whose values are merged. */
  mergedField: Field;
  /**
   * Generally this matches the [[mergedField]], but there are situations when a nested field is propagated
   * up to display it as if it wasn't nested its parent fields. In those cases, if one of the parent fields
   * is merged, the merged parent is going to be represented by [[mergedField]] and the field we wanted to
   * process is going to be represented by [[requestedField]].
   */
  requestedField: Field;
  /** Name of the parent field (if there is one). */
  parentFieldName?: string;
}

/**
 * Props for the [[IContentVisitor.processPrimitiveValue]] call.
 * @public
 */
export interface ProcessPrimitiveValueProps {
  /** Field whose value is being processed. */
  field: Field;
  /** Type of the value. */
  valueType: TypeDescription;
  /** Name of the parent field (if there is one). */
  parentFieldName?: string;
  /** Raw value. */
  rawValue: Value;
  /** Display value. */
  displayValue: DisplayValue;
}

/**
 * An interface for a visitor that can be passed to the [[traverseContent]] function
 * to be called on each piece of content.
 *
 * The order of calls when using the visitor with [[traverseContent]] or [[traverseContentItem]]:
 *
 * ```
 * startContent
 *   processFieldHierarchies
 *   for each content item:
 *     startItem
 *     for each field in root level:
 *       for each category in field's category stack from root to field's category:
 *         startCategory
 *       startField
 *         valueProcessing:
 *           if item's value for this field is merged:
 *             processMergedValue
 *           else if the field is struct:
 *             startStruct
 *             for each struct member:
 *               recurse into the valueProcessing step
 *             finishStruct
 *           else if the field is array:
 *             startArray
 *             for each array item:
 *               recurse into the valueProcessing step
 *             finishArray
 *           else if the field is primitive:
 *             processPrimitiveValue
 *       finishField
 *     finishItem
 * finishContent
 * ```
 * @public
 */
export interface IContentVisitor {
  /**
   * Called before starting [[Content]] processing. This is a good place to initialize various caches and prepare
   * for parsing content.
   *
   * Processing is skipped if the function returns `false` and [[finishContent]] is not called in that case.
   */
  startContent(props: StartContentProps): boolean;
  /** Called after processing of [[Content]] is complete. */
  finishContent(): void;

  /** Called to post-process field hierarchies after they're extracted from [[Descriptor]] in processed [[Content]]. */
  processFieldHierarchies(props: ProcessFieldHierarchiesProps): void;

  /**
   * Called before starting each [[Item]] processing. This is a good place to initialize for a new content item, e.g.
   * set up a new row in table.
   *
   * Processing is skipped if the function returns `false` and [[finishItem]] is not called in that case.
   */
  startItem(props: StartItemProps): boolean;
  /**
   * Called after processing of [[Item]] is complete. May be used to do any kind of post-processing after all
   * values for one content item have been processed.
   */
  finishItem(): void;

  /**
   * Called before processing a content item field ([[startField]] call) for each category in the field's
   * category stack, starting from the root and finishing with the field's category.
   *
   * Processing is skipped if the function returns `false` and [[finishCategory]] is not called in that case.
   */
  startCategory(props: StartCategoryProps): boolean;
  /** Called after processing of field is complete for every category in the field's category stack. */
  finishCategory(): void;

  /**
   * Called before starting [[Field]] processing for each individual [[Item]]. This is a good callback
   * to skip a field if it doesn't need to be handled.
   *
   * Processing is skipped if the function returns `false` and [[finishField]] is not called in that case.
   */
  startField(props: StartFieldProps): boolean;
  /** Called after processing of [[Field]] for individual [[Item]] is complete. */
  finishField(): void;

  /**
   * Called before processing a struct value. This is a good callback to skip handling the value or set up
   * for struct member values handling.
   *
   * Processing is skipped if the function returns `false` and [[finishStruct]] is not called in that case.
   */
  startStruct(props: StartStructProps): boolean;
  /** Called after processing of struct value is complete. */
  finishStruct(): void;

  /**
   * Called before processing an array value. This is a good callback to skip handling the value or set up
   * for array items handling.
   *
   * Processing is skipped if the function returns `false` and [[finishArray]] is not called in that case.
   */
  startArray(props: StartArrayProps): boolean;
  /** Called after processing of array value is complete. */
  finishArray(): void;

  /** Called to process a [merged value]($docs/presentation/content/Terminology.md#value-merging). */
  processMergedValue(props: ProcessMergedValueProps): void;
  /** Called to process a primitive value. */
  processPrimitiveValue(props: ProcessPrimitiveValueProps): void;
}

/**
 * An utility for traversing field hierarchy. Stops traversal as soon as `cb` returns `false`.
 * @public
 */
export function traverseFieldHierarchy(hierarchy: FieldHierarchy, cb: (h: FieldHierarchy) => boolean) {
  if (cb(hierarchy)) {
    hierarchy.childFields.forEach((childHierarchy) => traverseFieldHierarchy(childHierarchy, cb));
  }
}

/**
 * An utility to traverse content using provided visitor. Provides means to parse content into different formats,
 * for different components.
 * @public
 */
export function traverseContent(visitor: IContentVisitor, content: Content) {
  if (!visitor.startContent({ descriptor: content.descriptor })) {
    return;
  }

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

/**
 * An utility for calling [[traverseContent]] when there's only one content item.
 * @public
 */
export function traverseContentItem(visitor: IContentVisitor, descriptor: Descriptor, item: Item) {
  traverseContent(visitor, new Content(descriptor, [item]));
}

class VisitedCategories implements IDisposable {
  private _visitedCategories: CategoryDescription[];
  private _didVisitAllHierarchy: boolean;
  constructor(
    private _visitor: IContentVisitor,
    category: CategoryDescription,
  ) {
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
    while (this._visitedCategories.pop()) {
      this._visitor.finishCategory();
    }
  }
  public get shouldContinue(): boolean {
    return this._didVisitAllHierarchy;
  }
}

function traverseContentItemFields(visitor: IContentVisitor, fieldHierarchies: FieldHierarchy[], item: Item) {
  if (!visitor.startItem({ item })) {
    return;
  }

  try {
    fieldHierarchies.forEach((fieldHierarchy) => {
      using(new VisitedCategories(visitor, fieldHierarchy.field.category), (res) => {
        if (res.shouldContinue) {
          traverseContentItemField(visitor, fieldHierarchy, item);
        }
      });
    });
  } finally {
    visitor.finishItem();
  }
}

function traverseContentItemField(visitor: IContentVisitor, fieldHierarchy: FieldHierarchy, item: Item) {
  if (!visitor.startField({ hierarchy: fieldHierarchy })) {
    return;
  }

  try {
    const rootToThisField = createFieldPath(fieldHierarchy.field);
    let parentFieldName: string | undefined;
    const pathUpToField = rootToThisField.slice(undefined, -1);
    for (let i = 0; i < pathUpToField.length; ++i) {
      const parentField = pathUpToField[i] as NestedContentField;
      const nextField = rootToThisField[i + 1];

      if (item.isFieldMerged(parentField.name)) {
        visitor.processMergedValue({ requestedField: fieldHierarchy.field, mergedField: parentField, parentFieldName });
        return;
      }

      const { emptyNestedItem, convertedItem } = convertNestedContentItemToStructArrayItem(item, parentField, nextField);
      if (emptyNestedItem) {
        return;
      }

      item = convertedItem;
      parentFieldName = combineFieldNames(parentField.name, parentFieldName);
    }

    if (item.isFieldMerged(fieldHierarchy.field.name)) {
      visitor.processMergedValue({ requestedField: fieldHierarchy.field, mergedField: fieldHierarchy.field, parentFieldName });
      return;
    }

    if (fieldHierarchy.field.isNestedContentField()) {
      fieldHierarchy = convertNestedContentFieldHierarchyToStructArrayHierarchy(fieldHierarchy, parentFieldName);
      const { emptyNestedItem, convertedItem } = convertNestedContentFieldHierarchyItemToStructArrayItem(item, fieldHierarchy);
      if (emptyNestedItem) {
        return;
      }
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

    traverseContentItemFieldValue(
      visitor,
      fieldHierarchy,
      item.mergedFieldNames,
      fieldHierarchy.field.type,
      parentFieldName,
      item.values[fieldHierarchy.field.name],
      item.displayValues[fieldHierarchy.field.name],
    );
  } finally {
    visitor.finishField();
  }
}

function traverseContentItemFieldValue(
  visitor: IContentVisitor,
  fieldHierarchy: FieldHierarchy,
  mergedFieldNames: string[],
  valueType: TypeDescription,
  parentFieldName: string | undefined,
  rawValue: Value,
  displayValue: DisplayValue,
) {
  if (rawValue !== undefined) {
    if (valueType.valueFormat === PropertyValueFormat.Array) {
      assert(Value.isArray(rawValue));
      assert(DisplayValue.isArray(displayValue));
      return traverseContentItemArrayFieldValue(visitor, fieldHierarchy, mergedFieldNames, valueType, parentFieldName, rawValue, displayValue);
    }
    if (valueType.valueFormat === PropertyValueFormat.Struct) {
      assert(Value.isMap(rawValue));
      assert(DisplayValue.isMap(displayValue));
      return traverseContentItemStructFieldValue(visitor, fieldHierarchy, mergedFieldNames, valueType, parentFieldName, rawValue, displayValue);
    }
  }
  traverseContentItemPrimitiveFieldValue(visitor, fieldHierarchy, mergedFieldNames, valueType, parentFieldName, rawValue, displayValue);
}

function traverseContentItemArrayFieldValue(
  visitor: IContentVisitor,
  fieldHierarchy: FieldHierarchy,
  mergedFieldNames: string[],
  valueType: TypeDescription,
  parentFieldName: string | undefined,
  rawValues: ValuesArray,
  displayValues: DisplayValuesArray,
) {
  assert(rawValues.length === displayValues.length);
  assert(valueType.valueFormat === PropertyValueFormat.Array);
  if (!visitor.startArray({ hierarchy: fieldHierarchy, valueType, parentFieldName, rawValues, displayValues })) {
    return;
  }

  try {
    const itemType = valueType.memberType;
    rawValues.forEach((_, i) => {
      traverseContentItemFieldValue(visitor, fieldHierarchy, mergedFieldNames, itemType, parentFieldName, rawValues[i], displayValues[i]);
    });
  } finally {
    visitor.finishArray();
  }
}

function traverseContentItemStructFieldValue(
  visitor: IContentVisitor,
  fieldHierarchy: FieldHierarchy,
  mergedFieldNames: string[],
  valueType: TypeDescription,
  parentFieldName: string | undefined,
  rawValues: ValuesMap,
  displayValues: DisplayValuesMap,
) {
  assert(valueType.valueFormat === PropertyValueFormat.Struct);
  if (!visitor.startStruct({ hierarchy: fieldHierarchy, valueType, parentFieldName, rawValues, displayValues })) {
    return;
  }

  try {
    if (fieldHierarchy.field.isNestedContentField()) {
      parentFieldName = combineFieldNames(fieldHierarchy.field.name, parentFieldName);
    }

    valueType.members.forEach((memberDescription) => {
      let memberField = fieldHierarchy.childFields.find((f) => f.field.name === memberDescription.name);
      if (!memberField) {
        // Not finding a member field means we're traversing an ECStruct. We still need to carry member information, so we
        // create a fake field to represent the member
        memberField = {
          field: new Field(
            fieldHierarchy.field.category,
            memberDescription.name,
            memberDescription.label,
            memberDescription.type,
            fieldHierarchy.field.isReadonly,
            0,
          ),
          childFields: [],
        };
      }
      traverseContentItemFieldValue(
        visitor,
        memberField,
        mergedFieldNames,
        memberDescription.type,
        parentFieldName,
        rawValues[memberDescription.name],
        displayValues[memberDescription.name],
      );
    });
  } finally {
    visitor.finishStruct();
  }
}

function traverseContentItemPrimitiveFieldValue(
  visitor: IContentVisitor,
  fieldHierarchy: FieldHierarchy,
  mergedFieldNames: string[],
  valueType: TypeDescription,
  parentFieldName: string | undefined,
  rawValue: Value,
  displayValue: DisplayValue,
) {
  if (-1 !== mergedFieldNames.indexOf(fieldHierarchy.field.name)) {
    visitor.processMergedValue({ mergedField: fieldHierarchy.field, requestedField: fieldHierarchy.field, parentFieldName });
    return;
  }

  visitor.processPrimitiveValue({ field: fieldHierarchy.field, valueType, parentFieldName, rawValue, displayValue });
}

/**
 * Parses a list of [[Field]] objects into a list of [[FieldHierarchy]].
 *
 * @param ignoreCategories Enables adding all of the `nestedFields` to parent field's `childFields`
 * without considering categories.
 *
 * @public
 */
export function createFieldHierarchies(fields: Field[], ignoreCategories?: Boolean) {
  const hierarchies = new Array<FieldHierarchy>();
  const visitField = (category: CategoryDescription, field: Field, parentField: Field | undefined): FieldHierarchy | undefined => {
    let childFields: FieldHierarchy[] = [];
    if (field.isNestedContentField()) {
      // visit all nested fields
      childFields = visitFields(field.nestedFields, field);
      if (0 === childFields.length) {
        return undefined;
      }
    }
    const fieldHierarchy = { field, childFields };
    if (category === parentField?.category || (ignoreCategories && parentField)) {
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
      if (visitedField) {
        includedFields.push(visitedField);
      }
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
    if (indexInResult !== -1) {
      result.childFields[indexInResult] = mergeHierarchies(result.childFields[indexInResult], rhsChildHierarchy);
    } else {
      result.childFields.push(rhsChildHierarchy);
    }
  });
  return result;
}

/**
 * Adds a field hierarchy into root field hierarchies list. *
 * @public
 */
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
/**
 * Combines given field names in a way that allows them to be parsed back into a list of individual names using the [[parseCombinedFieldNames]] function.
 * @public
 */
export function combineFieldNames(fieldName: string, parentFieldName?: string) {
  return parentFieldName ? `${parentFieldName}${FIELD_NAMES_SEPARATOR}${fieldName}` : fieldName;
}
/**
 * Parses given combined field names string, constructed using [[combineFieldNames]], into a list of individual field names.
 * @public
 */
export function parseCombinedFieldNames(combinedName: string) {
  return combinedName ? combinedName.split(FIELD_NAMES_SEPARATOR) : [];
}

interface NestedItemConversionResult {
  emptyNestedItem: boolean;
  convertedItem: Item;
}

function convertNestedContentItemToStructArrayItem(item: Readonly<Item>, field: Field, nextField: Field): NestedItemConversionResult {
  const value = item.values[field.name] ?? [];
  assert(Value.isNestedContent(value));
  if (value.length === 0) {
    return { emptyNestedItem: true, convertedItem: item };
  }

  const nextFieldValues: { raw: ValuesArray; display: DisplayValuesArray } = { raw: [], display: [] };
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
  const convertedItem = new Item(
    item.primaryKeys,
    item.label,
    item.imageId, // eslint-disable-line deprecation/deprecation
    item.classInfo,
    { [nextField.name]: nextFieldValues.raw },
    { [nextField.name]: nextFieldValues.display },
    item.mergedFieldNames,
    item.extendedData,
  );
  return { emptyNestedItem: false, convertedItem };
}

function convertNestedContentFieldHierarchyToStructArrayHierarchy(fieldHierarchy: FieldHierarchy, parentFieldName: string | undefined) {
  const fieldName = fieldHierarchy.field.name;
  const convertedChildFieldHierarchies = fieldHierarchy.childFields.map((child) => {
    if (child.field.isNestedContentField()) {
      return convertNestedContentFieldHierarchyToStructArrayHierarchy(child, combineFieldNames(fieldName, parentFieldName));
    }
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
  const result: { raw: ValuesArray; display: DisplayValuesArray; mergedFieldNames: string[] } = { raw: [], display: [], mergedFieldNames: [] };
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
  if (rawValue.length === 0) {
    return { emptyNestedItem: true, convertedItem: item };
  }

  const converted = convertNestedContentValuesToStructArrayValuesRecursive(fieldHierarchy, rawValue);
  const convertedItem = new Item(
    item.primaryKeys,
    item.label,
    item.imageId, // eslint-disable-line deprecation/deprecation
    item.classInfo,
    { [fieldName]: converted.raw },
    { [fieldName]: converted.display },
    converted.mergedFieldNames,
    item.extendedData,
  );
  return { emptyNestedItem: false, convertedItem };
}
