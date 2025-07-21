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
import { EntityClass, Property } from "@itwin/ecschema-metadata";
import { ECSqlValue } from "../../ECSqlStatement";

export type FieldPrimitiveValue = boolean | number | string | Date | XAndY | XYAndZ | Uint8Array;

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
  const rootValue: ECSqlValue | undefined = iModel.withPreparedStatement(`SELECT ${propertyName} FROM ${host.schemaName}:${host.className} WHERE ECInstanceId=${host.elementId}`, (stmt) => {
    if (stmt.step() === DbResult.BE_SQLITE_ROW) {
      return stmt.getValue(0);
    }

    return undefined;
  });

  if (undefined === rootValue || rootValue.isNull) {
    return undefined;
  }

  let curValue;
  switch (rootValue.columnInfo.getType()) {
    // Unsupported:
    // case ECSqlValueType.Geometry:
    // case ECSqlValueType.Navigation:
    // case ECSqlValueType.Id:
    case ECSqlValueType.Blob:
      curValue = rootValue.getBlob();
      break;
    case ECSqlValueType.Boolean:
      curValue = rootValue.getBoolean();
      break;
    case ECSqlValueType.DateTime:
      curValue = rootValue.getDateTime();
      break;
    case ECSqlValueType.Double:
      curValue = rootValue.getDouble();
      break;
    case ECSqlValueType.Guid:
      curValue = rootValue.getGuid();
      break;
    case ECSqlValueType.Int:
    case ECSqlValueType.Int64:
      curValue = rootValue.getInteger();
      break;
    case ECSqlValueType.Point2d:
      curValue = rootValue.getXAndY();
      break;
    case ECSqlValueType.Point3d:
      curValue = rootValue.getXYAndZ();
      break;
    case ECSqlValueType.String:
      curValue = rootValue.getString();
      break;
    case ECSqlValueType.Struct: {
      // ###TODO look up struct ECClass
      curValue = rootValue.getStruct();
      break;
    }
    case ECSqlValueType.PrimitiveArray: {
      curValue = rootValue.getArray();
      break;
    }
    case ECSqlValueType.StructArray: {
      // ###TODO look up struct ECClass
      curValue = rootValue.getArray();
      break;
    }
  }

  if (undefined === curValue) {
    return undefined;
  }

  if (accessors) {
    for (const accessor of accessors) {
      if (typeof accessor === "number") {
        if (!Array.isArray(curValue)) {
          return undefined;
        }

        const index: number = accessor < 0 ? (curValue.length + accessor) : accessor;
        curValue = curValue[index];
      } else {
        // ###TODO return undefined if curValue is a primitive type - it may be an object like Point2d or Point3d.
        if (typeof curValue !== "object") {
          return undefined;
        }

        curValue = curValue?.[accessor];
      }
      
      if (curValue === undefined) {
        return undefined;
      }
    }
  }

  // ###TODO return undefined if obj is not a primitive type
  return {
    value: curValue,
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

