/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { BeEvent, Id64, Id64String } from "@itwin/core-bentley";
import { QueryBinder, RelatedElement, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { ECVersion } from "@itwin/ecschema-metadata";
import { Element } from "../Element";
import { IModelDb } from "../IModelDb";
import { IModelElementCloneContext } from "../IModelElementCloneContext";
import { createUpdateContext, updateAllFields, updateElementFields, updateFields } from "../internal/annotations/fields";
import { _implicitTxn } from "../internal/Symbols";
import { ElementDrivesElement, OnDependencyArg } from "../Relationship";
import { EditTxn } from "../EditTxn";
import { FieldFormattingSpecProvider, FieldFormattingSpecProviderArgs } from "./FieldFormattingSpecProvider";

/** The [[FieldFormattingSpecProvider]] serving each open [[IModelDb]], and whether an application
 * installed it via [[ElementDrivesTextAnnotation.registerFieldFormattingProvider]] or it is the
 * schema-only default created the first time one of the iModel's fields was evaluated. Weakly
 * keyed so a closed iModel takes its provider with it.
 */
const fieldFormattingProviders = new WeakMap<IModelDb, { provider: FieldFormattingSpecProvider, registered: boolean }>();

/** Returns the provider for `iModel`, creating the schema-only default on first use. */
function getOrCreateFieldFormattingProvider(iModel: IModelDb): FieldFormattingSpecProvider {
  let entry = fieldFormattingProviders.get(iModel);
  if (!entry) {
    entry = { provider: new FieldFormattingSpecProvider({ iModel }), registered: false };
    fieldFormattingProviders.set(iModel, entry);
  }

  return entry.provider;
}

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

/** Arguments supplied to [[ElementDrivesTextAnnotation.evaluateFields]].
 * @beta
 */
export interface EvaluateFieldsArgs {
  /** The text block whose fields are to be evaluated. */
  block: TextBlock;
  /** The iModel containing the elements supplying the display strings for the fields in [[block]]. */
  iModel: IModelDb;
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

  private static updateFieldDependenciesImpl(txn: EditTxn, annotationElementId: Id64String): void {
    const iModel = txn.iModel;
    const annotationElement = iModel.elements.tryGetElement<Element>(annotationElementId);
    if (!annotationElement || !isITextAnnotation(annotationElement)) {
      return;
    }

    // The native layer will allow us to insert relationships to invalid or non-existent source elements...errors will arise later. Prevent it.
    function isValidSourceId(id: Id64String): boolean {
      if (!Id64.isValidId64(id)) {
        return false;
      }

      return iModel.withQueryReader("SELECT CodeValue FROM BisCore.Element WHERE ECInstanceId=?", (reader): boolean => {
        return reader.step();
      }, new QueryBinder().bindId(1, id));
    }

    const sourceToRelationship = new Map<Id64String, Id64String | null>();
    const blocks = annotationElement.getTextBlocks();

    let haveFields = false;
    for (const block of blocks) {
      for (const { child } of traverseTextBlockComponent(block.textBlock)) {
        if (child.type === "field") {
          haveFields = true;
          if (isValidSourceId(child.propertyHost.elementId)) {
            sourceToRelationship.set(child.propertyHost.elementId, null);
          }
        }
      }
    }

    if (haveFields) {
      iModel.requireMinimumSchemaVersion("BisCore", minBisCoreVersion, "Text fields");
      updateAllFields(annotationElementId, txn, getOrCreateFieldFormattingProvider(iModel));
    }

    const staleRelationships = new Set<Id64String>();
    if (this.isSupportedForIModel(iModel)) {
      annotationElement.iModel.withQueryReader(
        "SELECT ECInstanceId, SourceECInstanceId FROM BisCore.ElementDrivesTextAnnotation WHERE TargetECInstanceId=:targetId",
        (reader) => {
          for (const row of reader) {
            const relationshipId: Id64String = row[0];
            const sourceId: Id64String = row[1];
            if (sourceToRelationship.has(sourceId)) {
              sourceToRelationship.set(sourceId, relationshipId);
            } else {
              staleRelationships.add(relationshipId);
            }
          }
        },
        new QueryBinder().bindId("targetId", annotationElement.id),
      );
    }

    for (const [sourceId, relationshipId] of sourceToRelationship) {
      if (relationshipId === null) {
        txn.insertRelationship(ElementDrivesTextAnnotation.create(annotationElement.iModel, sourceId, annotationElement.id).toJSON());
      }
    }

    if (staleRelationships.size > 0) {
      const staleRelationshipProps = Array.from(staleRelationships).map((relationshipId) =>
        annotationElement.iModel.relationships.getInstanceProps("BisCore.ElementDrivesTextAnnotation", relationshipId)
      );
      txn.deleteRelationships(staleRelationshipProps);
    }
  }

  /** @internal */
  public static override onRootChangedArg(arg: OnDependencyArg): void {
    updateElementFields(arg.props, arg.indirectEditTxn, false, getOrCreateFieldFormattingProvider(arg.indirectEditTxn.iModel));
  }

  /** @internal */
  public static override onDeletedDependencyArg(arg: OnDependencyArg): void {
    updateElementFields(arg.props, arg.indirectEditTxn, true, getOrCreateFieldFormattingProvider(arg.indirectEditTxn.iModel));
  }

  /** Returns true if `iModel` contains a version of the BisCore schema new enough to support this relationship.
   * If not, the schema should be updated before inserting any [FieldRun]($common)s, or those runs will not
   * update when the source element changes.
   */
  public static isSupportedForIModel(iModel: IModelDb): boolean {
    return iModel.meetsMinimumSchemaVersion("BisCore", minBisCoreVersion);
  }

  /** Ensures the `ElementDrivesTextAnnotation` relationships for the [FieldRun]($common)s in the specified annotation are up to date.
   * @deprecated in 5.9.0 - will not be removed until after 2027-05-04. Use ElementDrivesTextAnnotation.updateFieldDependencies(txn, ...) instead.
   */
  public static updateFieldDependencies(annotationElementId: Id64String, iModel: IModelDb): void;

  /** Examines all of the [FieldRun]($common)s within the specified [[ITextAnnotation]] and ensures that the appropriate
   * `ElementDrivesTextAnnotation` relationships exist between the fields' source elements and this target element.
   * It also deletes any stale relationships left over from fields that were deleted or whose source elements changed.
   */
  public static updateFieldDependencies(txn: EditTxn, annotationElementId: Id64String): void;
  public static updateFieldDependencies(arg1: EditTxn | Id64String, arg2: Id64String | IModelDb): void {
    if (arg1 instanceof EditTxn) {
      this.updateFieldDependenciesImpl(arg1, arg2 as Id64String);
      return;
    }

    this.updateFieldDependenciesImpl((arg2 as IModelDb)[_implicitTxn], arg1);
  }

  /** Recompute the display strings of all [FieldRun]($common)s in a [TextBlock]($common).
   *
   * `"quantity"` and `"coordinate"` fields are formatted through the
   * [[FieldFormattingSpecProvider]] for `args.iModel` -- the one installed by
   * [[registerFieldFormattingProvider]], or otherwise a default that presents each
   * KindOfQuantity using the format its schema declares.
   *
   * A field whose format cannot be resolved falls back to `value.toString()` and is recorded in
   * [FieldFormattingSpecProvider.misses]($backend). A field whose property cannot be resolved,
   * or whose format throws, is logged and rendered as
   * [FieldRun.invalidContentIndicator]($common); one bad field does not abandon the rest of the
   * block.
   * @returns the number of fields whose display strings were modified.
   */
  public static evaluateFields(args: EvaluateFieldsArgs): number {
    return updateFields(args.block, createUpdateContext(undefined, args.iModel, false, getOrCreateFieldFormattingProvider(args.iModel)));
  }

  /** Configures how `"quantity"` and `"coordinate"` [FieldRun]($common)s in `args.iModel` are
   * formatted by [[evaluateFields]] and by `TxnManager` field-update callbacks.
   *
   * Calling this is optional. An iModel with no registration formats every field using the
   * presentation format its schema declares for the KindOfQuantity, in the metric unit system.
   * Register to layer application [FormatSet]($ecschema-metadata)s over those schema defaults,
   * or to select a different unit system.
   *
   * One provider serves all of an iModel's FormatSets: pass the iModel-wide default as
   * `formatSet` and any per-field alternatives as `formatSets`, keyed by the id that
   * [FieldRun]($common)s name via [QuantityFieldFormatOptions.formatSet]($common):
   *
   * ```ts
   * ElementDrivesTextAnnotation.registerFieldFormattingProvider({
   *   iModel,
   *   formatSet: metricFormatSet,
   *   formatSets: [{ id: imperialFormatSetId, formatSet: imperial }],
   * });
   * ```
   *
   * Each call replaces any prior registration for the same iModel. Registering does not
   * re-evaluate existing annotations; listen to [[onFieldFormattingProviderChanged]] to do so.
   * The registration lives as long as the `IModelDb` object and is released with it.
   * @returns the registered provider.
   * @beta
   */
  public static registerFieldFormattingProvider(args: FieldFormattingSpecProviderArgs): FieldFormattingSpecProvider {
    const provider = new FieldFormattingSpecProvider(args);
    fieldFormattingProviders.set(args.iModel, { provider, registered: true });
    this.onFieldFormattingProviderChanged.raiseEvent({ iModel: args.iModel, provider });
    return provider;
  }

  /** Raised after [[registerFieldFormattingProvider]] installs a provider for an iModel, or
   * [[unregisterFieldFormattingProvider]] reverts one to the schema default. Because every
   * [FormatterSpec]($core-quantity) is built on demand, this is the only moment at which the
   * formatting an iModel's fields receive can change; applications that cache formatted output,
   * or that want to re-evaluate existing annotations against a newly adopted FormatSet, should
   * listen here.
   * @beta
   */
  public static readonly onFieldFormattingProviderChanged = new BeEvent<(args: { iModel: IModelDb, provider: FieldFormattingSpecProvider }) => void>();

  /** Discards the registration created by [[registerFieldFormattingProvider]] for `iModel`, if
   * any, so that its fields once again format through the schema-declared defaults. Does
   * nothing when no registration exists.
   *
   * Existing [FieldRun.cachedContent]($common) is unchanged until the next evaluation. To swap
   * FormatSets, call [[registerFieldFormattingProvider]] again rather than unregistering in
   * between.
   * @beta
   */
  public static unregisterFieldFormattingProvider(iModel: IModelDb): void {
    if (fieldFormattingProviders.get(iModel)?.registered) {
      fieldFormattingProviders.delete(iModel);
      this.onFieldFormattingProviderChanged.raiseEvent({ iModel, provider: getOrCreateFieldFormattingProvider(iModel) });
    }
  }

  /** Returns the [[FieldFormattingSpecProvider]] serving `iModel`: the one installed by
   * [[registerFieldFormattingProvider]], or otherwise the schema-only default, created on first
   * request. Useful for inspecting [FieldFormattingSpecProvider.misses]($backend).
   * @beta
   */
  public static getFieldFormattingProvider(iModel: IModelDb): FieldFormattingSpecProvider {
    return getOrCreateFieldFormattingProvider(iModel);
  }

  /** When copying an [[ITextAnnotation]] from one iModel into another, remaps the element Ids in any [FieldPropertyHost]($common) within the cloned element
   * so that they refer to elements in the `context`'s target iModel, and sets any Ids that cannot be remapped to [Id64.invalid]($bentley).
   * Implementations of `ITextAnnotation` should invoke this function from their implementations of [[Element.onCloned]].
   */
  public static remapFields(clone: ITextAnnotation, context: IModelElementCloneContext): void {
    if (!context.isBetweenIModels) {
      return;
    }

    const updatedBlocks = [];
    for (const block of clone.getTextBlocks()) {
      let anyUpdated = false;
      for (const { child } of traverseTextBlockComponent(block.textBlock)) {
        if (child.type === "field") {
          child.propertyHost.elementId = context.findTargetElementId(child.propertyHost.elementId);
          anyUpdated = true;
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
