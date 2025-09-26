/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { ElementProps, RelatedElement, RelationshipProps, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { ElementDrivesElement } from "../Relationship";
import { IModelDb } from "../IModelDb";
import { Element } from "../Element";
import { updateElementFields } from "../internal/annotations/fields";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { ECVersion } from "@itwin/ecschema-metadata";
import { IModelElementCloneContext } from "../IModelElementCloneContext";

/** Describes one of potentially many [TextBlock]($common)s hosted by an [[ITextAnnotation]].
 * For example, a [[TextAnnotation2d]] hosts only a single text block, but an element representing a table may
 * host one text block for each cell in the table, in which case it might use the combination of row and column
 * as the [[id]] for each text block.
 * @beta
 */
export interface TextBlockAndId {
  /** The text block. */
  readonly textBlock: TextBlock;
  /** An opaque identifier that allows the [[ITextAnnotation]] to discern which of its hosted text blocks is being referred to. */
  readonly id: unknown;
}

// ElementDrivesTextAnnotation was introduced in this version of BisCore - iModels with earlier versions cannot support field dependencies.
const minBisCoreVersion = new ECVersion(1, 0, 22);

/** Interface implemented by [[GeometricElement]] subclasses whose schemas declare them to implement the mix-in `BisCore:ITextAnnotation`.
 * Such elements may host any number of [TextBlock]($common)s. `ITextAnnotation` provides a uniform way to interact with text regardless of
 * the type of element to which it belongs.
 * @beta
 */
export interface ITextAnnotation {
  /** The default [[AnnotationTextStyle]] used by the text annotation. */
  defaultTextStyle?: TextAnnotationUsesTextStyleByDefault;
  /** Obtain a collection of all of the [TextBlock]($common)s hosted by this element. */
  getTextBlocks(): Iterable<TextBlockAndId>;
  /** Update the element in-memory to replace the contents of the specified [TextBlock]($common)s. */
  updateTextBlocks(textBlocks: TextBlockAndId[]): void;
}

/** Returns `true` if the specified `element` implements [[ITextAnnotation]].
 * @beta
 */
export function isITextAnnotation(element: Element): element is ITextAnnotation & Element {
  return ["getTextBlocks", "updateTextBlocks"].every((x) => x in element && typeof (element as any)[x] === "function");
}

/** A relationship in which the source element hosts one or more properties that are displayed by a target [[ITextAnnotation]] element.
 * This relationship is used to automatically update the [FieldRun]($common)s contained in the target element when the source element is modified.
 * An [[ITextAnnotation]] element should invoke [[updateFieldDependencies]] from its [[Element.onInserted]] and [[Element.onUpdated]] functions to
 * establish or update the relationships required for the [FieldRun]($common)s it contains.
 * @note This relationship was introduced in version 01.00.22 of the BisCore schema. [FieldRun]($common)s created in iModels that have not been upgraded to
 * that version or newer will not automatically update. Use [[isSupportedForIModel]] to check.
 * @beta
 */
export class ElementDrivesTextAnnotation extends ElementDrivesElement {
  public static override get className(): string { return "ElementDrivesTextAnnotation"; }

  /** @internal */
  public static override onRootChanged(props: RelationshipProps, iModel: IModelDb): void {
    updateElementFields(props, iModel, false);
  }

  /** @internal */
  public static override onDeletedDependency(props: RelationshipProps, iModel: IModelDb): void {
    updateElementFields(props, iModel, true);
  }

  /** Returns true if `iModel` contains a version of the BisCore schema new enough to support this relationship.
   * If not, the schema should be updated before inserting any [FieldRun]($common)s, or those runs will not
   * update when the source element changes.
   */
  public static isSupportedForIModel(iModel: IModelDb): boolean {
    const bisCoreVersion = iModel.querySchemaVersionNumbers("BisCore");
    return undefined !== bisCoreVersion && bisCoreVersion.compare(minBisCoreVersion) >= 0;
  }

  /** Examines all of the [FieldRun]($common)s within the specified [[ITextAnnotation]] and ensures that the appropriate
   * `ElementDrivesTextAnnotation` relationships exist between the fields' source elements and this target element.
   * It also deletes any stale relationships left over from fields that were deleted or whose source elements changed.
   */
  public static updateFieldDependencies(annotationElementId: Id64String, iModel: IModelDb): void {
    if (!ElementDrivesTextAnnotation.isSupportedForIModel(iModel)) {
      return;
    }

    const annotationElement = iModel.elements.tryGetElement<Element>(annotationElementId);
    if (!annotationElement || !isITextAnnotation(annotationElement)) {
      return;
    }

    // The native layer will allow us to insert relationships to invalid or non-existent source elements...errors will arise later. Prevent it.
    function isValidSourceId(id: Id64String): boolean {
      if (!Id64.isValidId64(id)) {
        return false;
      }

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      return iModel.withPreparedStatement("SELECT CodeValue FROM BisCore.Element WHERE ECInstanceId=?", (stmt) => {
        stmt.bindId(1, id);
        return DbResult.BE_SQLITE_ROW === stmt.step();
      });
    }

    const sourceToRelationship = new Map<Id64String, Id64String | null>();
    const blocks = annotationElement.getTextBlocks();

    for (const block of blocks) {
      for (const { child } of traverseTextBlockComponent(block.textBlock)) {
        if (child.type === "field" && isValidSourceId(child.propertyHost.elementId)) {
          sourceToRelationship.set(child.propertyHost.elementId, null);
        }
      }
    }

    const staleRelationships = new Set<Id64String>();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
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

  public static remapFields(clone: ITextAnnotation, context: IModelElementCloneContext): void {
    const updatedBlocks = [];
    for (const block of clone.getTextBlocks()) {
      let anyUpdated = false;
      for (const { child } of traverseTextBlockComponent(block.textBlock)) {
        if (child.type === "field") {
          const remappedId = context.findTargetElementId(child.propertyHost.elementId);
          if (context.isBetweenIModels || !Id64.isInvalid(remappedId)) {
            child.propertyHost.elementId = context.findTargetElementId(child.propertyHost.elementId);
            anyUpdated = true;
          }
        }
      }

      if (anyUpdated) {
        updatedBlocks.push(block);
      }
    }

    if (updatedBlocks.length > 0) {
      clone.updateTextBlocks(updatedBlocks);
    }
  }
}

/** Relationship indicating that the [[AnnotationTextStyle]] is being used as the default style for the [[ITextAnnotation]].
 * @beta
 */
export class TextAnnotationUsesTextStyleByDefault extends RelatedElement {
  public static classFullName = "BisCore:TextAnnotationUsesTextStyleByDefault";
  public constructor(annotationTextStyleId: Id64String, relClassName: string = TextAnnotationUsesTextStyleByDefault.classFullName) {
    super({ id: annotationTextStyleId, relClassName });
  }
}
