/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FieldPrimitiveValue, FieldPropertyType, FieldRun, FieldValue, formatFieldValue, QueryBinder, QueryRowFormat, RelationshipProps, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { assert, expectDefined, Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../../BackendLoggerCategory";
import { isITextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { AnyClass, EntityClass, PrimitiveType, Property, PropertyType, StructArrayProperty } from "@itwin/ecschema-metadata";
import { reshapePropertyValue } from "../ECSqlInstanceReshaper";
import type { EditTxn } from "../../EditTxn";
interface FieldStructValue { [key: string]: any }

// An intermediate value obtained while evaluating a FieldPropertyPath.
type FieldValueType = {
  primitive: FieldPrimitiveValue;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson?: never;
  deserializedArray?: never;
} | {
  primitive?: never;
  struct: FieldStructValue;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson?: never;
  deserializedArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray: FieldPrimitiveValue[];
  structArray?: never;
  deserializedJson?: never;
  deserializedArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray: FieldStructValue[];
  deserializedJson?: never;
  deserializedArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson: FieldStructValue;
  deserializedArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
  deserializedJson?: never;
  deserializedArray: FieldStructValue[];
}

export interface UpdateFieldsContext {
  readonly hostElementId: Id64String | undefined;

  getProperty(field: FieldRun): FieldValue | undefined
}

// Resolve the raw primitive value of the property that a field points to.
function getFieldPropertyValue(field: FieldRun, iModel: IModelDb): FieldValue | undefined {
  const host = field.propertyHost;
  const schemaItem = iModel.schemaContext.getSchemaItemSync(host.schemaName, host.className);
  if (!EntityClass.isEntityClass(schemaItem)) {
    return undefined;
  }

  let ecClass: AnyClass = schemaItem;
  const { propertyName, accessors } = field.propertyPath;
  let ecProp = ecClass.getPropertySync(propertyName);
  if (!ecProp) {
    return undefined;
  }

  const isAspect = ecClass.isSync("ElementAspect", "BisCore");
  const where = ` WHERE ${isAspect ? "Element.Id" : "ECInstanceId"}=:elementId`;
  // `propertyName` may itself be a struct/array/point/navigation property, so its value can't be
  // decomposed into scalar sub-columns ahead of time. Query using the non-deprecated
  // UseECSqlPropertyNames format and reshape the value into the legacy UseJsPropertyNames shape using
  // ECSchema metadata (see ECSqlInstanceReshaper for why a naive, non-schema-aware rename isn't safe here).
  let curValue: FieldValueType | undefined = iModel.withQueryReader(`SELECT ${propertyName} FROM ${host.schemaName}.${host.className} ${where}`, (reader): FieldValueType | undefined => {
    if (!reader.step()) {
      return undefined;
    }

    const rawRootValue = reader.current[0];
    if (undefined === rawRootValue) {
      return undefined;
    }

    ecProp = expectDefined(ecProp);
    const rootValue = reshapePropertyValue(rawRootValue, ecProp, iModel);
    if (ecProp.isArray()) {
      return ecProp.isStruct() ? { structArray: rootValue } : { primitiveArray: rootValue };
    }

    if (ecProp.isStruct()) {
      ecClass = ecProp.structClass;
      return { struct: rootValue };
    }

    if (ecProp.isPrimitive()) {
      if (ecProp.primitiveType === PrimitiveType.DateTime) {
        return { primitive: new Date(rootValue) };
      }

      // If the property is a string that holds serialized JSON and the field
      // wants to index into it, parse and treat it as a deserialized object/array.
      // Only deserialize when accessors are present; otherwise, keep the raw string
      // so the field can display the value directly.
      if (ecProp.primitiveType === PrimitiveType.String && typeof rootValue === "string" && accessors && accessors.length > 0) {
        const deserialized = tryDeserializeJson(rootValue);
        if (deserialized) {
          return deserialized;
        }
      }

      return {
        primitive: rootValue,
      };
    }

    return undefined;
  }, new QueryBinder().bindId("elementId", host.elementId), { rowFormat: QueryRowFormat.UseECSqlPropertyNames });

  if (undefined === curValue) {
    return undefined;
  }

  if (accessors) {
    for (const accessor of accessors) {
      if (undefined !== curValue.primitive) {
        // Can't index into a primitive.
        return undefined;
      }

      if (typeof accessor === "number") {
        // Deserialized JSON array: index without consulting the EC schema.
        if (curValue.deserializedArray) {
          const arr = curValue.deserializedArray;
          const idx = accessor < 0 ? arr.length + accessor : accessor;
          const value: any = arr[idx];
          if (undefined === value) {
            return undefined;
          }
          curValue = classifyDeserializedValue(value);
          continue;
        }

        const array: FieldPrimitiveValue[] | FieldStructValue[] | undefined = curValue.primitiveArray ?? curValue.structArray;
        if (!array) {
          return undefined;
        }

        const index: number = accessor < 0 ? (array.length + accessor) : accessor;
        const item: FieldPrimitiveValue | FieldStructValue = array[index];
        if (undefined === item) {
          return undefined;
        } else if (curValue.primitiveArray) {
          curValue = { primitive: curValue.primitiveArray[index] };
        } else {
          assert(undefined !== curValue.structArray);
          assert(ecProp instanceof StructArrayProperty);

          ecClass = ecProp.structClass;
          curValue = { struct: curValue.structArray[index] };
        }
      } else {
        // Deserialized JSON object: index without consulting the EC schema.
        if (curValue.deserializedJson) {
          const value: any = curValue.deserializedJson[accessor];
          if (undefined === value) {
            return undefined;
          }
          curValue = classifyDeserializedValue(value);
          continue;
        }

        if (undefined === curValue.struct) {
          return undefined;
        }

        const item: any = curValue.struct[accessor];
        if (undefined === item) {
          return undefined;
        }

        ecProp = ecClass.getPropertySync(accessor);
        if (!ecProp) {
          return undefined;
        }

        if (ecProp.isArray()) {
          curValue = ecProp.isStruct() ? { structArray: item } : { primitiveArray: item };
        } else if (ecProp.isStruct()) {
          ecClass = ecProp.structClass;
          curValue = { struct: item };
        } else if (ecProp.isPrimitive()) {
          curValue = { primitive: item };
        } else {
          return undefined;
        }
      }
    }
  }

  const propertyType = curValue.primitive !== undefined && !ecProp.isPrimitive()
    ? undefined
    : (isJsonLeafPrimitive(curValue.primitive) && ecProp.isPrimitive() && ecProp.primitiveType === PrimitiveType.String && accessors && accessors.length > 0
      ? inferJsonPrimitiveType(curValue.primitive)
      : determineFieldPropertyType(ecProp));
  if (!propertyType) {
    return undefined;
  }

  // The ultimate result must be a primitive value.
  if (undefined === curValue.primitive) {
    return undefined;
  }

  return { value: curValue.primitive, type: propertyType };
}

function isJsonLeafPrimitive(value: FieldPrimitiveValue | undefined): boolean {
  const t = typeof value;
  return t === "string" || t === "number" || t === "boolean";
}

function inferJsonPrimitiveType(value: FieldPrimitiveValue | undefined): FieldPropertyType | undefined {
  switch (typeof value) {
    case "boolean": return "boolean";
    case "number": return "quantity";
    case "string": return "string";
    default: return undefined;
  }
}

function tryDeserializeJson(raw: string): FieldValueType | undefined {
  const trimmed = raw.trimStart();
  const firstChar = trimmed.charAt(0);
  if (firstChar !== "{" && firstChar !== "[") {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === "object") {
      return classifyDeserializedValue(parsed);
    }
  } catch {
    // Not valid JSON; fall through and treat as a normal string.
  }
  return undefined;
}

function classifyDeserializedValue(value: any): FieldValueType {
  if (Array.isArray(value)) {
    return { deserializedArray: value };
  }
  if (value !== null && typeof value === "object") {
    return { deserializedJson: value };
  }
  return { primitive: value };
}

function determineFieldPropertyType(prop: Property): FieldPropertyType | undefined {
  if (prop.isEnumeration()) {
    switch (prop.propertyType) {
      case PropertyType.Integer_Enumeration:
        return "int-enum";
      case PropertyType.String_Enumeration:
        return "string-enum";
      default:
        return undefined;
    }
  }

  if (prop.isPrimitive()) {
    switch (prop.primitiveType) {
      case PrimitiveType.Boolean:
        return "boolean";
      case PrimitiveType.String:
        return prop.extendedTypeName === "DateTime" ? "datetime" : "string";
      case PrimitiveType.DateTime:
        return "datetime";
      case PrimitiveType.Double:
      case PrimitiveType.Long:
        return "quantity";
      case PrimitiveType.Point2d:
      case PrimitiveType.Point3d:
        return "coordinate";
      case PrimitiveType.Binary:
        return prop.extendedTypeName === "BeGuid" ? "string" : undefined;
      case PrimitiveType.Integer:
      case PrimitiveType.Long:
        return "string";
      default:
        return undefined;
    }
  }

  return undefined;
}

export function createUpdateContext(hostElementId: string | undefined, iModel: IModelDb, deleted: boolean): UpdateFieldsContext {
  return {
    hostElementId,
    getProperty: deleted ? () => undefined : (field) => getFieldPropertyValue(field, iModel),
  };
}

// Recompute the display value of a single field, return false if it couldn't be evaluated.
export function updateField(field: FieldRun, context: UpdateFieldsContext): boolean {
  if (context.hostElementId && context.hostElementId !== field.propertyHost.elementId) {
    return false;
  }

  let newContent: string | undefined;
  try {
    const propValue = context.getProperty(field);
    if (undefined !== propValue) {
      newContent = formatFieldValue(propValue, field.formatOptions);
    }
  } catch (err) {
    Logger.logError(BackendLoggerCategory.IModelDb, err);
  }

  newContent = newContent ?? FieldRun.invalidContentIndicator;
  if (newContent === field.cachedContent) {
    return false;
  }

  field.setCachedContent(newContent);
  return true;
}

// Re-evaluates the display strings for all fields that target the element specified by `context` and returns the number
// of fields whose display strings changed as a result.
export function updateFields(textBlock: TextBlock, context: UpdateFieldsContext): number {
  let numUpdated = 0;
  for (const { child } of traverseTextBlockComponent(textBlock)) {
    if (child.type === "field" && updateField(child, context)) {
      ++numUpdated;
    }
  }

  return numUpdated;
}

function doUpdateFields(txn: EditTxn, annotationId: Id64String, sourceId: Id64String | undefined, deleted: boolean): void {
  const iModel = txn.iModel;
  try {
    const target = iModel.elements.getElement(annotationId);
    if (isITextAnnotation(target)) {
      const context = createUpdateContext(sourceId, iModel, deleted);
      const updatedBlocks = [];
      for (const block of target.getTextBlocks()) {
        if (updateFields(block.textBlock, context)) {
          updatedBlocks.push(block);
        }
      }

      if (updatedBlocks.length > 0) {
        target.updateTextBlocks(updatedBlocks);
        target.update(txn);
      }
    }
  } catch (err) {
    Logger.logError(BackendLoggerCategory.IModelDb, err);
  }
}

// Invoked by ElementDrivesTextAnnotation to update fields in target element when source element changes or is deleted.
export function updateElementFields(props: RelationshipProps, txn: EditTxn, deleted: boolean): void {
  doUpdateFields(txn, props.targetId, props.sourceId, deleted);
}

export function updateAllFields(annotationElementId: Id64String, txn: EditTxn): void {
  doUpdateFields(txn, annotationElementId, undefined, false);
}
