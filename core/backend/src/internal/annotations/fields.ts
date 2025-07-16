/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FieldPropertyPath, FieldRun, RelationshipProps, TextBlock } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../../BackendLoggerCategory";
import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { ITextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { Entity } from "../../Entity";

export interface GetFieldPropertyValueArgs {
  path: Readonly<FieldPropertyPath>;
  // ###TODO: a description of which aspect hosts the property, if not hosted directly on the element.
}

export type FieldPropertyValue = boolean | number | string | Date | XAndY | XYAndZ;

export interface FieldProperty {
  value: FieldPropertyValue;
  metadata?: any; // ###TODO we'll need to know extended type, KOQ/units, etc.
}

export interface UpdateFieldsContext {
  readonly hostElementId: Id64String;

  getProperty(args: GetFieldPropertyValueArgs): FieldProperty | undefined
}

function getFieldProperty(elementId: Id64String, iModel: IModelDb, path: FieldPropertyPath): FieldProperty | undefined {
  // Empty path => invalid field.
  if (path.properties.length === 0) {
    return undefined;
  }
  
  // Resolve the host. ###TODO handle aspects
  const host: Entity | undefined = iModel.elements.tryGetElement(elementId);
  if (!host) {
    return undefined;
  }

  // Verify the host is of the expected class.
  const hostClass = host.getMetaDataSync();
  if (!hostClass.isSync(path.properties[0].class, path.properties[0].schema)) {
    return undefined;
  }

  // ###TODO
  return undefined;
}

function createUpdateContext(hostElementId: string, iModel: IModelDb, deleted: boolean): UpdateFieldsContext {
  return {
    hostElementId,
    getProperty: deleted ? () => undefined : (args) => getFieldProperty(hostElementId, iModel, args.path),
  };
}

/** @internal exported strictly for tests. */
export function updateField(field: FieldRun, context: UpdateFieldsContext): boolean {
  if (context.hostElementId !== field.propertyHost.elementId) {
    return false;
  }

  let newContent: string | undefined;
  try {
    const prop = context.getProperty({ path: field.propertyPath });
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

