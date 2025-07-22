/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ECSqlValueType, FieldRun, RelationshipProps, TextBlock } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { assert, DbResult, Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../../BackendLoggerCategory";
import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { ITextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { Entity } from "../../Entity";
import { AnyClass, EntityClass, PrimitiveArrayProperty, Property, StructArrayProperty, StructProperty } from "@itwin/ecschema-metadata";
import { ECSqlValue } from "../../ECSqlStatement";

export type FieldPrimitiveValue = boolean | number | string | Date | XAndY | XYAndZ | Uint8Array;
type FieldStructValue = { [key: string]: any };
type FieldValue = {
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

export interface FieldPropertyMetadata {
  readonly property: Property;
  // ###TODO probably want to know if it's a JSON property.
}

export interface FieldProperty {
  value: FieldPrimitiveValue;
  metadata: FieldPropertyMetadata;
}

export interface UpdateFieldsContext {
  readonly hostElementId: Id64String;

  getProperty(field: FieldRun): FieldProperty | undefined
}

function getFieldProperty(field: FieldRun, iModel: IModelDb): FieldProperty | undefined {
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

  // ###TODO handle aspects.
  let curValue: FieldValue | undefined = iModel.withPreparedStatement(`SELECT ${propertyName} FROM ${host.schemaName}.${host.className} WHERE ECInstanceId=${host.elementId}`, (stmt) => {
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
        return { primitive: rootValue.getDateTime() };
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
        assert(ecProp!.isStruct());
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

  if (undefined === curValue.primitive) {
    return undefined;
  }

  return {
    value: curValue.primitive,
    metadata: { property: ecProp },
  };
}

export function createUpdateContext(hostElementId: string, iModel: IModelDb, deleted: boolean): UpdateFieldsContext {
  return {
    hostElementId,
    getProperty: deleted ? () => undefined : (field) => getFieldProperty(field, iModel),
  };
}

export function updateField(field: FieldRun, context: UpdateFieldsContext): boolean {
  if (context.hostElementId !== field.propertyHost.elementId) {
    return false;
  }

  let newContent: string | undefined;
  try {
    const prop = context.getProperty(field);
    if (undefined !== prop) {
      // ###TODO formatting etc.
      newContent = prop.value.toString();
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
  for (const paragraph of textBlock.paragraphs) {
    for (const run of paragraph.runs) {
      if (run.type === "field" && updateField(run, context)) {
        ++numUpdated;
      }
    }
  }

  return numUpdated;
}

function isITextAnnotation(obj: any): obj is ITextAnnotation {
  return ["getTextBlocks", "updateTextBlocks"].every((x) => x in obj && typeof obj[x] === "function");
}

export function updateElementFields(props: RelationshipProps, iModel: IModelDb, deleted: boolean): void {
  try {
    const target = iModel.elements.getElement(props.targetId);
    if (isITextAnnotation(target)) {
      const context = createUpdateContext(props.sourceId, iModel, deleted);
      const updatedBlocks = [];
      for (const block of target.getTextBlocks()) {
        if (updateFields(block.textBlock, context)) {
          updatedBlocks.push(block);
        }
      }

      if (updatedBlocks.length > 0) {
        target.updateTextBlocks(updatedBlocks);
      }
    }
  } catch (err) {
    Logger.logException(BackendLoggerCategory.IModelDb, err);
  }
}

