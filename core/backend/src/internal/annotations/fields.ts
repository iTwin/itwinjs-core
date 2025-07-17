/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FieldRun, RelationshipProps, TextBlock } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../../BackendLoggerCategory";
import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { ITextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { Entity } from "../../Entity";

export type FieldPropertyValue = boolean | number | string | Date | XAndY | XYAndZ;

export interface FieldProperty {
  value: FieldPropertyValue;
  metadata?: any; // ###TODO we'll need to know extended type, KOQ/units, etc.
}

export interface UpdateFieldsContext {
  readonly hostElementId: Id64String;

  getProperty(field: FieldRun): FieldProperty | undefined
}

function getFieldProperty(field: FieldRun, iModel: IModelDb): FieldProperty | undefined {
  const { propertyName, accessors } = field.propertyPath;

  if (!propertyName) {
    return undefined;
  }

  const hostEntity: Entity | undefined = iModel.elements.tryGetElement(field.propertyHost.elementId);
  if (!hostEntity) {
    return undefined;
  }

  const hostClass = hostEntity.getMetaDataSync();
  if (!hostClass.isSync(field.propertyHost.className, field.propertyHost.schemaName)) {
    return undefined;
  }

  let obj: any = (hostEntity as any)[propertyName];
  if (accessors) {
    for (const accessor of accessors) {
      if (typeof accessor === "number") {
        if (!Array.isArray(obj)) {
          return undefined;
        }

        const index = accessor < 0 ? (obj.length + accessor) : accessor;
        obj = obj[index];
      } else {
        if (typeof obj !== "object") {
          return undefined;
        }

        obj = obj?.accessor;
      }
      
      if (obj === undefined) {
        return undefined;
      }
    }
  }

  return { value: obj };
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

