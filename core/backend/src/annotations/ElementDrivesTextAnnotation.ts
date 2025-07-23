/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { RelationshipProps, TextBlock } from "@itwin/core-common";
import { ElementDrivesElement } from "../Relationship";
import { IModelDb } from "../IModelDb";
import { Element } from "../Element";
import { updateElementFields } from "../internal/annotations/fields";
import { DbResult, Id64String } from "@itwin/core-bentley";

export interface TextBlockAndId {
  readonly textBlock: TextBlock;
  readonly id: unknown;
}

/** Interface implemented by [[GeometricElement]] subclasses whose schemas declare them to implement the mix-in `BisCore:ITextAnnotation`.
 * @beta
 */
export interface ITextAnnotation {
  getTextBlocks(): Iterable<TextBlockAndId>;
  updateTextBlocks(textBlocks: TextBlockAndId[]): void;
}

export function isITextAnnotation(obj: any): obj is ITextAnnotation {
  return ["getTextBlocks", "updateTextBlocks"].every((x) => x in obj && typeof obj[x] === "function");
}

export class ElementDrivesTextAnnotation extends ElementDrivesElement {
  public static override get className(): string { return "ElementDrivesTextAnnotation"; }
  
  public static override onRootChanged(props: RelationshipProps, iModel: IModelDb): void {
    updateElementFields(props, iModel, false);
  }

  public static override onDeletedDependency(props: RelationshipProps, iModel: IModelDb): void {
    updateElementFields(props, iModel, true);
  }

  public static updateFieldDependencies(annotationElementId: Id64String, iModel: IModelDb): void {
    const annotationElement = iModel.elements.tryGetElement<Element>(annotationElementId);
    if (!annotationElement || !isITextAnnotation(annotationElement)) {
      return;
    }

    const sourceToRelationship = new Map<Id64String, Id64String | null>();
    const blocks = annotationElement.getTextBlocks();
    for (const block of blocks) {
      for (const paragraph of block.textBlock.paragraphs) {
        for (const run of paragraph.runs) {
          if (run.type === "field") {
            sourceToRelationship.set(run.propertyHost.elementId, null);
          }
        }
      }
    }

    const staleRelationships = new Set<Id64String>();
    annotationElement.iModel.withPreparedStatement(`SELECT ECInstanceId, SourceECInstanceId FROM BisCore.ElementDrivesTextAnnotation WHERE TargetECInstanceId=${annotationElement.id}`, (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const relationshipId = stmt.getValue(0).getId();
        const sourceId = stmt.getValue(1).getId();
        if (sourceToRelationship.has(sourceId)) {
          sourceToRelationship.set(sourceId, relationshipId);
        } else {
          staleRelationships.add(relationshipId);
        }
      }
    });

    for (const [sourceId, relationshipId] of sourceToRelationship) {
      if (relationshipId === null) {
        ElementDrivesTextAnnotation.create(annotationElement.iModel, sourceId, annotationElement.id).insert();
      }
    }

    for (const relationshipId of staleRelationships) {
      const props = annotationElement.iModel.relationships.getInstanceProps("BisCore.ElementDrivesTextAnnotation", relationshipId);
      annotationElement.iModel.relationships.deleteInstance(props);
    }
  }
}
