/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { FieldPropertyPath, FieldRun, RelationshipProps, TextBlock } from "@itwin/core-common";
import { ElementDrivesElement } from "../Relationship";
import { IModelDb } from "../IModelDb";
import { Id64String, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { XAndY, XYAndZ } from "@itwin/core-geometry";

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

/** Interface implemented by [[GeometricElement]] subclasses whose schemas declare them to implement the mix-in `BisCore:ITextAnnotation`.
 * @beta
 */
export interface ITextAnnotation {
  updateFields(context: UpdateFieldsContext): void;
}

function createUpdateContext(hostElementId: string, _iModel: IModelDb, deleted: boolean): UpdateFieldsContext {
  if (deleted) {
    return {
      hostElementId,
      getProperty: () => undefined,
    };
  }

  // ###TODO
  return {
    hostElementId,
    getProperty: () => undefined,
  };
}

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

function updateElementFields(props: RelationshipProps, iModel: IModelDb, deleted: boolean): void {
  try {
    const target = iModel.elements.getElement(props.targetId);
    if ("updateFields" in target && "function" === typeof target.updateFields) {
      const context = createUpdateContext(props.sourceId, iModel, deleted);
      target.updateFields(context);
    }
  } catch (err) {
    Logger.logException(BackendLoggerCategory.IModelDb, err);
  }
}

export class ElementDrivesTextAnnotation extends ElementDrivesElement {
  public static override get className(): string { return "ElementDrivesTextAnnotation"; }
  
  public static override onRootChanged(props: RelationshipProps, iModel: IModelDb): void {
    updateElementFields(props, iModel, false);
  }

  public static override onDeletedDependency(props: RelationshipProps, iModel: IModelDb): void {
    updateElementFields(props, iModel, true);
  }
}
