/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { FieldRun, QueryBinder, RelatedElement, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { FormattingSpecArgs } from "@itwin/core-quantity";
import { ECVersion } from "@itwin/ecschema-metadata";
import { Element } from "../Element";
import { IModelDb } from "../IModelDb";
import { IModelElementCloneContext } from "../IModelElementCloneContext";
import { collectFieldFormattingRequirements, collectFieldRequirements, createUpdateContext, updateAllFields, updateElementFields, updateFields } from "../internal/annotations/fields";
import { _implicitTxn } from "../internal/Symbols";
import { ElementDrivesElement, OnDependencyArg } from "../Relationship";
import { EditTxn } from "../EditTxn";
import { FieldFormattingSpecProvider, FieldFormattingSpecProviderArgs } from "./FieldFormattingSpecProvider";

/** Process-wide registry of pre-warmed [[FieldFormattingSpecProvider]]s, keyed by
 * [IModelDb.key]($backend). Populated by [[ElementDrivesTextAnnotation.registerFieldFormattingProvider]]
 * and consulted by [[ElementDrivesTextAnnotation.evaluateFields]] and the `TxnManager`
 * field-update callbacks.
 *
 * Keyed by iModel so that a provider is reachable for *every* field of that iModel — including
 * fields declaring no [QuantityFieldFormatOptions.formatSet]($common), which resolve against
 * the iModel's schema formats. Never swept automatically: hosts must call
 * [[ElementDrivesTextAnnotation.unregisterFieldFormattingProvider]] on iModel close. Provider
 * lifetime is deliberately the host's to manage — a host may want a provider to outlive a
 * particular [IModelDb]($backend) instance, and iTwin.js cannot know that.
 */
const fieldFormattingProviders = new Map<string, FieldFormattingSpecProvider>();

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
      updateAllFields(annotationElementId, txn, fieldFormattingProviders.get(iModel.key));
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
    updateElementFields(arg.props, arg.indirectEditTxn, false, fieldFormattingProviders.get(arg.indirectEditTxn.iModel.key));
  }

  /** @internal */
  public static override onDeletedDependencyArg(arg: OnDependencyArg): void {
    updateElementFields(arg.props, arg.indirectEditTxn, true, fieldFormattingProviders.get(arg.indirectEditTxn.iModel.key));
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
   * [[FieldFormattingSpecProvider]] registered for `args.iModel` by
   * [[registerFieldFormattingProvider]]. Because that provider resolves its
   * [FormatterSpec]($core-quantity)s ahead of time, this call — and the `TxnManager`
   * field-update callbacks, which cannot await — remain synchronous.
   *
   * A field whose requirement was never pre-warmed, or any field evaluated with no provider
   * registered for the iModel, falls back to its raw string representation. Such shortfalls are
   * recorded in [FieldFormattingSpecProvider.misses]($backend); re-warm and re-evaluate to
   * pick them up.
   *
   * A field whose property cannot be resolved, or whose format throws while being applied, is
   * logged and rendered as [FieldRun.invalidContentIndicator]($common). One bad field does not
   * abandon the rest of the block.
   * @returns the number of fields whose display strings were modified.
   */
  public static evaluateFields(args: EvaluateFieldsArgs): number {
    return updateFields(args.block, createUpdateContext(undefined, args.iModel, false, fieldFormattingProviders.get(args.iModel.key)));
  }

  /** Returns the [FormattingSpecArgs]($core-quantity) needed to format every
   * `"quantity"` and `"coordinate"` [FieldRun]($common) in `args.block` through the standard
   * iTwin.js quantity pipeline, deduplicated. Pass these to
   * [FieldFormattingSpecProvider.warmUp]($backend)
   * before inserting or updating an annotation, so its fields resolve on the next synchronous
   * evaluation rather than falling back to raw strings.
   * Fields whose target property has no [KindOfQuantity]($ecschema-metadata) and no
   * `kindOfQuantity` / `persistenceUnit` override are omitted.
   *
   * @see [[getFieldFormattingRequirements]] for a single [FieldRun]($common).
   * @beta
   */
  public static collectFieldFormattingRequirements(args: EvaluateFieldsArgs): FormattingSpecArgs[] {
    return collectFieldFormattingRequirements(args.block, args.iModel);
  }

  /** Returns the [FormattingSpecArgs]($core-quantity) that formatting `field` may consult —
   * usually one entry, more when the field's `formatOptions.quantity` overrides produce
   * additional candidates, and none when the field's target property carries no
   * [KindOfQuantity]($ecschema-metadata) and the field supplies no override.
   *
   * Use this to accumulate requirements across a set of [FieldRun]($common)s the application
   * has already gathered — for instance while building an annotation, or while walking the
   * result of its own query for annotations in scope. Prefer
   * [[collectFieldFormattingRequirements]] when the unit of work is a whole
   * [TextBlock]($common), since it deduplicates for you.
   *
   * A near-miss does not render unformatted — it lets evaluation resolve a *different*
   * (KindOfQuantity, persistence unit) pair and scale the value by the wrong unit.
   * @beta
   */
  public static getFieldFormattingRequirements(field: FieldRun, iModel: IModelDb): FormattingSpecArgs[] {
    return collectFieldRequirements(field, iModel);
  }

  /** Creates a [[FieldFormattingSpecProvider]] for `args.iModel`, pre-warms it against
   * `requirements`, and registers it so that [[evaluateFields]] and `TxnManager` field-update
   * callbacks can format `"quantity"` and `"coordinate"` [FieldRun]($common)s synchronously.
   *
   * **Call this when the iModel opens**, before any editing code touches it. Evaluation fires
   * from `TxnManager` on source-element edits; a field evaluated with no provider registered
   * persists its raw string and is not revisited until the *next* edit to the same source
   * (registering does not walk existing annotations).
   *
   * `requirements` is mandatory — iTwin.js does not discover them. Build the array with
   * [[collectFieldFormattingRequirements]], [[getFieldFormattingRequirements]], and/or
   * [FieldFormattingSpecProvider.collectSchemaFormattingRequirements]($backend). Anything left
   * unwarmed is recorded in [FieldFormattingSpecProvider.misses]($backend); poll it, then call
   * [FieldFormattingSpecProvider.warmUp]($backend) and re-evaluate.
   *
   * One provider serves all of an iModel's FormatSets: pass the iModel-wide default as
   * `formatSet` and any per-field alternatives as `formatSets`, keyed by the id that
   * [FieldRun]($common)s name via [QuantityFieldFormatOptions.formatSet]($common):
   *
   * ```ts
   * await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
   *   iModel,
   *   formatSet: metricFormatSet,
   *   formatSets: [{ id: imperialFormatSetId, formatSet: imperial }],
   * });
   * ```
   *
   * Each call replaces any prior registration for the same iModel, atomically after its
   * pre-warm completes.
   *
   * To swap FormatSets, call this method again rather than unregistering first — otherwise
   * fields evaluated during the `await` fall back to raw strings.
   *
   * Registrations are process-wide and are **never** released automatically, so pair every call
   * with [[unregisterFieldFormattingProvider]] from an [IModelDb.onBeforeClose]($backend)
   * listener:
   *
   * ```ts
   * iModel.onBeforeClose.addOnce(() => ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(iModel));
   * ```
   *
   * Skipping that has two costs. The provider captures the iModel's
   * [SchemaContext]($ecschema-metadata), so a stale registration pins it — and the closed
   * `IModelDb` behind it — alive for the lifetime of the process. And while [IModelDb.key]($common)
   * is a fresh GUID on each open by default (making a stale entry merely unreachable), a host that
   * supplies its own stable `key` when opening will land on that entry again on reopen and format
   * against a *closed* schema context, which surfaces as a confusing schema error from inside a
   * `TxnManager` callback.
   * @returns the registered provider.
   * @beta
   */
  public static async registerFieldFormattingProvider(
    args: FieldFormattingSpecProviderArgs & {
      /** The specs to pre-build. Required — iTwin.js does not discover requirements on its own.
       * Pass an empty array to register a provider that formats nothing until
       * [FieldFormattingSpecProvider.warmUp]($backend) is called.
       */
      requirements: FormattingSpecArgs[];
    },
  ): Promise<FieldFormattingSpecProvider> {
    const provider = new FieldFormattingSpecProvider(args);
    await provider.warmUp(args.requirements);
    fieldFormattingProviders.set(args.iModel.key, provider);
    return provider;
  }

  /** Removes the registration created by [[registerFieldFormattingProvider]] for `iModel`, if
   * any. Typically called from an [IModelDb.onBeforeClose]($backend) listener.
   *
   * Existing [FieldRun.cachedContent]($common) is unchanged, but the next source-element edit
   * re-runs [[evaluateFields]] with no provider and overwrites `cachedContent` with the raw
   * string — a harder fallback than a *registered* provider with a partial FormatSet, which
   * still resolves each field's [KindOfQuantity]($ecschema-metadata) presentation format from
   * schema (`"2.5 m"` rather than `"2.5"`).
   *
   * To swap FormatSets, call [[registerFieldFormattingProvider]] again rather than
   * unregistering in between.
   * @beta
   */
  public static unregisterFieldFormattingProvider(iModel: IModelDb): void {
    fieldFormattingProviders.delete(iModel.key);
  }

  /** Returns the [[FieldFormattingSpecProvider]] previously registered for `iModel` via
   * [[registerFieldFormattingProvider]], if any.
   * @beta
   */
  public static getFieldFormattingProvider(iModel: IModelDb): FieldFormattingSpecProvider | undefined {
    return fieldFormattingProviders.get(iModel.key);
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
