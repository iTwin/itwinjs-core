/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { QueryBinder, RelatedElement, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { FormattingSpecArgs, FormattingSpecProvider, UnitSystemKey } from "@itwin/core-quantity";
import { ECVersion, FormatSet, FormatSetFormatsProvider, SchemaFormatsProvider } from "@itwin/ecschema-metadata";
import { Element } from "../Element";
import { IModelDb } from "../IModelDb";
import { IModelElementCloneContext } from "../IModelElementCloneContext";
import { collectFieldFormattingRequirements, createUpdateContext, updateAllFields, updateElementFields, updateFields } from "../internal/annotations/fields";
import { _implicitTxn } from "../internal/Symbols";
import { ElementDrivesElement, OnDependencyArg } from "../Relationship";
import { EditTxn } from "../EditTxn";
import { createFieldFormattingSpecProvider, FieldFormattingSpecProvider } from "./FieldFormattingSpecProvider";

/** Process-wide registry of pre-warmed [FormattingSpecProvider]($core-quantity)s keyed by
 * FormatSet [Id64String]($bentley). Populated by [[registerFieldFormattingProvider]] and
 * consulted when recomputing [FieldRun.cachedContent]($common).
 *
 * Not scoped to any [IModelDb]($backend) and never swept automatically — hosts must call
 * [[unregisterFieldFormattingProvider]] on iModel close to avoid a later iModel picking up a
 * stale provider under the same FormatSet id.
 */
const fieldFormattingProviders = new Map<Id64String, FormattingSpecProvider>();

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

/** Arguments supplied to [[ElementDrivesTextAnnotation.prepareFieldFormatting]].
 * @beta
 */
export interface PrepareFieldFormattingArgs extends EvaluateFieldsArgs {
  /** [Id64String]($bentley) of the FormatSet element under which the prepared provider is
   * registered. Only [FieldRun]($common)s whose
   * [QuantityFieldFormatOptions.formatSet]($common) equals this id format through it.
   */
  formatSet: Id64String;
  /** The FormatSet definition whose formats take precedence over the KindOfQuantity
   * presentation formats defined in [[iModel]]'s schemas. Names the FormatSet does not define
   * fall back to those schema formats. When omitted, formats resolve from the schemas alone.
   *
   * Ignored when a provider is already registered under [[formatSet]] — call
   * [[ElementDrivesTextAnnotation.unregisterFieldFormattingProvider]] first to adopt a
   * different FormatSet.
   */
  formatSetDefinition?: FormatSet;
  /** Unit system used when resolving formats from [[iModel]]'s schemas. Defaults to
   * [[formatSetDefinition]]'s `unitSystem`, or `"metric"` when neither is supplied.
   */
  unitSystem?: UnitSystemKey;
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
      updateAllFields(annotationElementId, txn, fieldFormattingProviders);
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
    updateElementFields(arg.props, arg.indirectEditTxn, false, fieldFormattingProviders);
  }

  /** @internal */
  public static override onDeletedDependencyArg(arg: OnDependencyArg): void {
    updateElementFields(arg.props, arg.indirectEditTxn, true, fieldFormattingProviders);
  }

  /** Returns true if `iModel` contains a version of the BisCore schema new enough to support this relationship.
   * If not, the schema should be updated before inserting any [FieldRun]($common)s, or those runs will not
   * update when the source element changes.
   */
  public static isSupportedForIModel(iModel: IModelDb): boolean {
    return iModel.meetsMinimumSchemaVersion("BisCore", minBisCoreVersion);
  }

  /** Examines all of the [FieldRun]($common)s within the specified [[ITextAnnotation]] and ensures that the appropriate
   * `ElementDrivesTextAnnotation` relationships exist between the fields' source elements and this target element.
   * It also deletes any stale relationships left over from fields that were deleted or whose source elements changed.
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

  /** Recompute the display strings of all [FieldRun]($common)s in a [TextBlock]($common)
   * synchronously. `"quantity"` and `"coordinate"` fields resolve in order: a
   * [FormattingSpecProvider]($core-quantity) registered under their `formatSet` (see
   * [[prepareFieldFormatting]] and [[registerFieldFormattingProvider]]), then the presentation
   * format of the target property's [KindOfQuantity]($ecschema-metadata) as defined in
   * `args.iModel`'s schemas, then the raw string representation.
   * @returns the number of fields whose display strings were modified.
   * @throws Error if evaluation of any field fails.
   */
  public static evaluateFields(args: EvaluateFieldsArgs): number {
    return updateFields(args.block, createUpdateContext(undefined, args.iModel, false, fieldFormattingProviders))
  }

  /** Returns the deduplicated [FormattingSpecArgs]($core-quantity) needed to format every
   * `"quantity"` and `"coordinate"` [FieldRun]($common) in `args.block` through the standard
   * iTwin.js quantity pipeline. Intended for an application-supplied
   * [FormattingSpecProvider]($core-quantity) to pre-build the [FormatterSpec]($core-quantity)s
   * before the annotation is inserted, updated, or re-evaluated. Fields whose target property
   * has no [KindOfQuantity]($ecschema-metadata) and no `kindOfQuantity` / `persistenceUnit`
   * override are omitted.
   * @beta
   */
  public static collectFieldFormattingRequirements(args: EvaluateFieldsArgs): FormattingSpecArgs[] {
    return collectFieldFormattingRequirements(args.block, args.iModel);
  }

  /** Prepares synchronous quantity formatting for the [FieldRun]($common)s in `args.block`.
   *
   * [FormatterSpec]($core-quantity) construction is asynchronous, but the `TxnManager`-driven
   * field-update callbacks that recompute [FieldRun.cachedContent]($common) are synchronous.
   * This method bridges the two: it discovers what `args.block` needs (see
   * [[collectFieldFormattingRequirements]]), builds those specs asynchronously, and registers
   * the resulting [[FieldFormattingSpecProvider]] under `args.formatSet` so the synchronous
   * path can serve them.
   *
   * Call it before inserting or updating the annotation that hosts `args.block`. Repeated calls
   * reuse and extend the provider already registered under `args.formatSet`, so it is safe — and
   * expected — to call once per insert or update as new fields appear.
   *
   * Fields whose specs were not prepared are not errors: they fall through to the iModel's
   * KindOfQuantity presentation format, and then to their raw string representation.
   *
   * Registrations are **process-wide**; see [[registerFieldFormattingProvider]] for the
   * lifetime contract and the canonical [IModelDb.onBeforeClose]($backend) cleanup pattern.
   * @returns the provider registered under `args.formatSet`.
   * @beta
   */
  public static async prepareFieldFormatting(args: PrepareFieldFormattingArgs): Promise<FieldFormattingSpecProvider> {
    const existing = fieldFormattingProviders.get(args.formatSet);
    if (existing instanceof FieldFormattingSpecProvider) {
      await existing.warmForBlock(args.block);
      return existing;
    }

    const unitSystem = args.unitSystem ?? args.formatSetDefinition?.unitSystem ?? "metric";
    const schemaFormats = new SchemaFormatsProvider(args.iModel.schemaContext, unitSystem);
    const formatsProvider = args.formatSetDefinition
      ? new FormatSetFormatsProvider({ formatSet: args.formatSetDefinition, fallbackProvider: schemaFormats })
      : schemaFormats;

    const provider = createFieldFormattingSpecProvider({ iModel: args.iModel, formatsProvider, unitSystem });
    await provider.warmForBlock(args.block);
    this.registerFieldFormattingProvider({ formatSet: args.formatSet, provider });
    return provider;
  }

  /** Registers a synchronous [FormattingSpecProvider]($core-quantity) under `formatSet`. Once
   * registered, [[evaluateFields]] and the `TxnManager`-driven field-update callback path
   * format `"quantity"` and `"coordinate"` [FieldRun]($common)s whose
   * [QuantityFieldFormatOptions.formatSet]($common) equals `formatSet` through this provider.
   * Fields with no matching registration — and fields whose spec the provider does not have —
   * fall back to the presentation format of their property's
   * [KindOfQuantity]($ecschema-metadata), and then to the raw string. Providers should be
   * pre-warmed with [[collectFieldFormattingRequirements]]. Each registration replaces any
   * prior one for the same `formatSet`.
   *
   * Most applications should call [[prepareFieldFormatting]] instead, which builds, warms, and
   * registers a [[FieldFormattingSpecProvider]] in one step.
   *
   * Registrations are **process-wide** and not scoped to any [IModelDb]($backend), so two
   * iModels carrying the same FormatSet [Id64String]($bentley) will share whichever provider
   * was registered most recently. Hosts must register on iModel open and call
   * [[unregisterFieldFormattingProvider]] on iModel close; see that method for the effect on
   * previously-persisted [FieldRun.cachedContent]($common).
   *
   * Canonical pattern:
   * ```ts
   * iModel.onBeforeClose.addOnce(() => {
   *   ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(formatSetId);
   * });
   * ElementDrivesTextAnnotation.registerFieldFormattingProvider({ formatSet: formatSetId, provider });
   * ```
   * @beta
   */
  public static registerFieldFormattingProvider(
    args: {
      /** [Id64String]($bentley) of the FormatSet element whose fields route to `provider`. */
      formatSet: Id64String;
      /** Provider associated with `formatSet`. */
      provider: FormattingSpecProvider;
    },
  ): void {
    fieldFormattingProviders.set(args.formatSet, args.provider);
  }

  /** Removes the registration previously created by [[registerFieldFormattingProvider]] for
   * `formatSet`, if any. Typically called from an [IModelDb.onBeforeClose]($backend) listener
   * paired with the corresponding register call — see [[registerFieldFormattingProvider]] for
   * the lifetime contract.
   *
   * Unregistering does **not** clear or reformat any [FieldRun.cachedContent]($common) already
   * persisted while the provider was registered. However, the next source-element update that
   * fires a `TxnManager` field-update callback re-evaluates the field and — finding no provider
   * — falls back to the presentation format of its property's
   * [KindOfQuantity]($ecschema-metadata), or to the raw string when the property has none.
   * Hosts that need FormatSet-specific output to survive a provider gap should keep the
   * provider registered for the lifetime of the annotations that depend on it.
   * @beta
   */
  public static unregisterFieldFormattingProvider(formatSet: Id64String): void {
    fieldFormattingProviders.delete(formatSet);
  }

  /** Returns the [FormattingSpecProvider]($core-quantity) previously registered under
   * `formatSet` via [[registerFieldFormattingProvider]], if any. See
   * [[registerFieldFormattingProvider]] for the process-wide lifetime contract.
   * @beta
   */
  public static getFieldFormattingProvider(formatSet: Id64String): FormattingSpecProvider | undefined {
    return fieldFormattingProviders.get(formatSet);
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
