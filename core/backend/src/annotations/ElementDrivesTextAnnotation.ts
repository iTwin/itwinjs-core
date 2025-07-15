/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { RelationshipProps, UpdateFieldsContext } from "@itwin/core-common";
import { ElementDrivesElement } from "../Relationship";
import { IModelDb } from "../IModelDb";
import { Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "../BackendLoggerCategory";

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

function updateFields(props: RelationshipProps, iModel: IModelDb, deleted: boolean): void {
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
    updateFields(props, iModel, false);
  }

  public static override onDeletedDependency(props: RelationshipProps, iModel: IModelDb): void {
    updateFields(props, iModel, true);
  }
}
