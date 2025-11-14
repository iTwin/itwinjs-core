/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ECSqlValueType, FieldPrimitiveValue, FieldPropertyType, FieldRun, FieldValue, formatFieldValue, RelationshipProps, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { assert, DbResult, expectDefined, Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../../BackendLoggerCategory";
import { isITextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { AnyClass, EntityClass, PrimitiveType, Property, PropertyType, StructArrayProperty } from "@itwin/ecschema-metadata";

interface FieldStructValue { [key: string]: any }

// An intermediate value obtained while evaluating a FieldPropertyPath.
type FieldValueType = {
  primitive: FieldPrimitiveValue;
  struct?: never;
  primitiveArray?: never;
  structArray?: never;
} | {
  primitive?: never;
  struct: FieldStructValue;
  primitiveArray?: never;
  structArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray: FieldPrimitiveValue[];
  structArray?: never;
} | {
  primitive?: never;
  struct?: never;
  primitiveArray?: never;
  structArray: FieldStructValue[];
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
  const where = ` WHERE ${isAspect ? "Element.Id" : "ECInstanceId"}=${host.elementId}`;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  let curValue: FieldValueType | undefined = iModel.withPreparedStatement(`SELECT ${propertyName} FROM ${host.schemaName}.${host.className} ${where}`, (stmt) => {
    if (stmt.step() !== DbResult.BE_SQLITE_ROW) {
      return undefined;
    }

    const rootValue = stmt.getValue(0);
    if (undefined === rootValue || rootValue.isNull) {
      return undefined;
    }

    switch (rootValue.columnInfo.getType()) {
      case ECSqlValueType.Blob:
        return { primitive: rootValue.getBlob() };
      case ECSqlValueType.Boolean:
        return { primitive: rootValue.getBoolean() };
      case ECSqlValueType.DateTime:
        return { primitive: new Date(rootValue.getDateTime()) };
      case ECSqlValueType.Double:
        return { primitive: rootValue.getDouble() };
      case ECSqlValueType.Guid:
        return { primitive: rootValue.getGuid() };
      case ECSqlValueType.Int:
      case ECSqlValueType.Int64:
        return { primitive: rootValue.getInteger() };
      case ECSqlValueType.Point2d:
        return { primitive: rootValue.getXAndY() };
      case ECSqlValueType.Point3d:
        return { primitive: rootValue.getXYAndZ() };
      case ECSqlValueType.String:
        return { primitive: rootValue.getString() };
      case ECSqlValueType.Struct: {
        ecProp = expectDefined(ecProp);
        assert(ecProp.isStruct());
        ecClass = ecProp.structClass;
        return { struct: rootValue.getStruct() };
      }
      case ECSqlValueType.PrimitiveArray: {
        return { primitiveArray: rootValue.getArray() };
      }
      case ECSqlValueType.StructArray: {
        return { structArray: rootValue.getArray() };
      }
      // Unsupported:
      // case ECSqlValueType.Geometry:
      // case ECSqlValueType.Navigation:
      // case ECSqlValueType.Id:
    }

    return undefined;
  });

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

  const propertyType = determineFieldPropertyType(ecProp);
  if(!propertyType) {
    return undefined;
  }

  // The ultimate result must be a primitive value.
  if (undefined === curValue.primitive) {
    return undefined;
  }

  return { value: curValue.primitive, type: propertyType };
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
    Logger.logException(BackendLoggerCategory.IModelDb, err);
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

function doUpdateFields(annotationId: Id64String, sourceId: Id64String | undefined, iModel: IModelDb, deleted: boolean): void {
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
        target.update();
      }
    }
  } catch (err) {
    Logger.logException(BackendLoggerCategory.IModelDb, err);
  }
}

// Invoked by ElementDrivesTextAnnotation to update fields in target element when source element changes or is deleted.
export function updateElementFields(props: RelationshipProps, iModel: IModelDb, deleted: boolean): void {
  doUpdateFields(props.targetId, props.sourceId, iModel, deleted);
}

export function updateAllFields(annotationElementId: Id64String, iModel: IModelDb): void {
  doUpdateFields(annotationElementId, undefined, iModel, false);
}

