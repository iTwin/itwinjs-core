/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ECSqlValueType, FieldRun, RelationshipProps, TextBlock } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { DbResult, Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../../BackendLoggerCategory";
import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { ITextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { Entity } from "../../Entity";
import { EntityClass, PrimitiveArrayProperty, Property } from "@itwin/ecschema-metadata";
import { ECSqlValue } from "../../ECSqlStatement";

export type FieldPrimitiveValue = boolean | number | string | Date | XAndY | XYAndZ | Uint8Array;
type FieldStructValue = { [key: string]: any };
type FieldArrayValue = FieldPrimitiveValue[] | FieldStructValue[];
type FieldValue = {
  primitive: FieldPrimitiveValue;
  struct?: never;
  array?: never;
} | {
  primitive?: never;
  struct: FieldStructValue;
  array?: never;
} | {
  primitive?: never;
  struct?: never;
  array: FieldArrayValue;
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
  let ecClass = iModel.schemaContext.getSchemaItemSync(host.schemaName, host.className);
  if (!EntityClass.isEntityClass(ecClass)) {
    return undefined;
  }

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
        // ###TODO look up struct ECClass
        return { struct: rootValue.getStruct() };
      }
      case ECSqlValueType.PrimitiveArray: {
        return { array: rootValue.getArray() };
      }
      case ECSqlValueType.StructArray: {
        // ###TODO look up struct ECClass
        return { array: rootValue.getArray() };
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
        if (undefined === curValue.array || !ecProp.isArray()) {
          return undefined;
        }

        const index: number = accessor < 0 ? (curValue.array.length + accessor) : accessor;
        const item: FieldPrimitiveValue | FieldStructValue = curValue.array[index];
        if (undefined === item) {
          return undefined;
        } else if (ecProp instanceof PrimitiveArrayProperty) {
          curValue = { primitive: item as FieldPrimitiveValue };
        } else {
          // ###TODO look up struct ECClass
          return undefined;
        }
      } else {
        if (undefined === curValue.struct || !ecProp.isStruct()) {
          return undefined;
        }

        const item = curValue.struct[accessor];
        if (undefined === item) {
          return undefined;
        }

        // ###TODO look up the property in the struct by name, determine if it's primitive.
        // If it isn't, look up struct ECClass
      }
      
      if (curValue === undefined) {
        return undefined;
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

