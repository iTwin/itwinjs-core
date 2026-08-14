/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { QueryBinder, RelatedElement, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { FormatsProvider, FormattingSpecArgs, FormattingSpecProvider, UnitsProvider } from "@itwin/core-quantity";
import { ECVersion } from "@itwin/ecschema-metadata";
import { Element } from "../Element";
import { IModelDb } from "../IModelDb";
import { IModelElementCloneContext } from "../IModelElementCloneContext";
import { collectFieldFormattingRequirements, createFieldFormatterContext, createUpdateContext, updateAllFields, updateElementFields, updateFields, updateFieldsAsync } from "../internal/annotations/fields";
import { _implicitTxn } from "../internal/Symbols";
import { ElementDrivesElement, OnDependencyArg } from "../Relationship";
import { EditTxn } from "../EditTxn";

// Process-wide registry of app-supplied sync formatting spec providers. Populated by
// `ElementDrivesTextAnnotation.registerFieldFormattingProvider` and consulted by the sync
// `updateField*` paths so txn callbacks can format quantity/coordinate fields via a pre-warmed
// provider (e.g. a FormatSet-backed `FormattingSpecProvider`). Entries are keyed by the FormatSet
// [Id64String]($bentley) supplied at registration; a field whose
// [QuantityFieldFormatOptions.formatSet]($common) does not match any registration is left to the
// caller's fallback (raw string on the sync path; the iModel's [SchemaFormatsProvider]($ecschema-metadata)
// on the async path — see [[evaluateFieldsAsync]]).
//
// Lifetime is owned by the host: this map is not scoped to any [IModelDb]($backend) and is
// never swept automatically. Hosts that register a provider on iModel open MUST call
// [[unregisterFieldFormattingProvider]] on iModel close (typically via
// [IModelDb.onBeforeClose]($backend)) so that a later iModel carrying the same FormatSet id
// does not silently pick up a stale provider from a previous session.
const fieldFormattingProviders = new Map<Id64String, FormattingSpecProvider>();

/** Builds a lookup that returns the registered [FormattingSpecProvider]($core-quantity) for a
 * field's [QuantityFieldFormatOptions.formatSet]($common). Returns `undefined` when no
 * providers are registered, so callers can short-circuit the whole sync-formatting branch; the
 * inner function returns `undefined` when the field has no `formatSet` or no registration
 * matches (which puts the sync path onto the raw-string fallback).
 */
function createFieldFormattingProviderLookup(): ((formatSet: string | undefined) => FormattingSpecProvider | undefined) | undefined {
  if (fieldFormattingProviders.size === 0) {
    return undefined;
  }
  return (formatSet) => {
    if (!formatSet) {
      return undefined;
    }
    return fieldFormattingProviders.get(formatSet);
  };
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

/** Arguments supplied to [[ElementDrivesTextAnnotation.evaluateFieldsAsync]].
 *
 * When omitted, [[formatsProvider]] and [[unitsProvider]] default to schema-backed
 * implementations derived from [[iModel]]'s schema context. Hosts that own a
 * [FormattingSpecProvider]($core-quantity) backed by an adopted FormatSet supply their own
 * providers here to route FieldRun formatting through them.
 * @beta
 */
export interface EvaluateFieldsAsyncArgs extends EvaluateFieldsArgs {
  /** Resolves a [FormatProps]($core-quantity) by KindOfQuantity name. Defaults to a
   * [SchemaFormatsProvider]($ecschema-metadata) built from [[iModel]].
   */
  formatsProvider?: FormatsProvider;
  /** Resolves [UnitProps]($core-quantity) (e.g. a value's persistence unit). Defaults to a
   * [SchemaUnitProvider]($ecschema-metadata)-backed implementation built from [[iModel]].
   */
  unitsProvider?: UnitsProvider;
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
      updateAllFields(annotationElementId, txn, createFieldFormattingProviderLookup());
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
    updateElementFields(arg.props, arg.indirectEditTxn, false, createFieldFormattingProviderLookup());
  }

  /** @internal */
  public static override onDeletedDependencyArg(arg: OnDependencyArg): void {
    updateElementFields(arg.props, arg.indirectEditTxn, true, createFieldFormattingProviderLookup());
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

  /** Recompute the display strings of all [FieldRun]($common)s in a [TextBlock]($common).
   *
   * If [FormattingSpecProvider]($core-quantity)s have been registered via
   * [[registerFieldFormattingProvider]], each `"quantity"` or `"coordinate"` field whose
   * [QuantityFieldFormatOptions.formatSet]($common) matches a registration is formatted through
   * that provider. Fields whose `formatSet` is unset or does not match any registration are
   * rendered as raw strings; the synchronous path cannot consult the iModel's
   * [SchemaFormatsProvider]($ecschema-metadata) — use [[evaluateFieldsAsync]] for that fallback.
   * @returns the number of fields whose display strings were modified.
   * @throws Error if evaluation of any field fails.
   */
  public static evaluateFields(args: EvaluateFieldsArgs): number {
    const getProvider = createFieldFormattingProviderLookup();
    return updateFields(args.block, createUpdateContext(undefined, args.iModel, false, getProvider))
  }

  /** Async counterpart to [[evaluateFields]] that formats `"quantity"` and `"coordinate"`
   * [FieldRun]($common)s through the standard iTwin.js quantity pipeline. Non-quantity fields
   * are formatted identically to [[evaluateFields]].
   *
   * By default the [FormatsProvider]($core-quantity) and [UnitsProvider]($core-quantity) are
   * derived from `args.iModel`'s schema context (via [SchemaFormatsProvider]($ecschema-metadata)).
   * Supply [[EvaluateFieldsAsyncArgs.formatsProvider]] / [[EvaluateFieldsAsyncArgs.unitsProvider]]
   * to route formatting through an application-owned provider (e.g. a FormatSet-backed
   * [FormattingSpecProvider]($core-quantity)).
   *
   * For each `"quantity"` or `"coordinate"` field the format is resolved in this priority
   * order (see [QuantityFieldFormatOptions]($common) for the full contract):
   *   1. Effective override pair — [QuantityFieldFormatOptions.kindOfQuantity]($common) paired
   *      with [QuantityFieldFormatOptions.persistenceUnit]($common), each independently falling
   *      through to the property side when unset, looked up via the active
   *      [FormatsProvider]($core-quantity).
   *   2. The property-side pair — the property's own [KindOfQuantity]($ecschema-metadata) and
   *      its persistence unit; skipped when identical to the effective pair.
   *
   * If neither pair resolves, the field falls back to its raw representation (`toString()`
   * for `"quantity"`, a `(x, y[, z])` tuple for `"coordinate"`).
   * @returns the number of fields whose display strings were modified.
   * @beta
   */
  public static async evaluateFieldsAsync(args: EvaluateFieldsAsyncArgs): Promise<number> {
    const context = createUpdateContext(undefined, args.iModel, false, undefined);
    const formatter = createFieldFormatterContext(args.iModel, {
      formatsProvider: args.formatsProvider,
      unitsProvider: args.unitsProvider,
    });
    return updateFieldsAsync(args.block, context, formatter);
  }

  /** Walks the [FieldRun]($common)s in a [TextBlock]($common) and returns a deduplicated list
   * of the [FormattingSpecArgs]($core-quantity) their `"quantity"` and `"coordinate"` values
   * need to be formatted through the standard iTwin.js quantity pipeline.
   *
   * Intended for an application-supplied [FormattingSpecProvider]($core-quantity) to pre-build
   * the [FormatterSpec]($core-quantity)s referenced by the annotation before it is inserted,
   * updated, or re-evaluated. Fields whose target property has no [KindOfQuantity]($ecschema-metadata)
   * (and no `kindOfQuantity` / `persistenceUnit` override) are omitted — they need no provider
   * lookup.
   * @beta
   */
  public static collectFieldFormattingRequirements(args: EvaluateFieldsArgs): FormattingSpecArgs[] {
    return collectFieldFormattingRequirements(args.block, args.iModel);
  }

  /** Registers a synchronous [FormattingSpecProvider]($core-quantity) for the FormatSet element
   * identified by `formatSet`. Once registered, [[evaluateFields]] and the `TxnManager`-driven
   * field-update callback path format `"quantity"` and `"coordinate"` [FieldRun]($common)s whose
   * [QuantityFieldFormatOptions.formatSet]($common) equals `formatSet` through this provider.
   *
   * Fields whose `formatSet` is unset or does not match any registration are rendered as raw
   * strings; the synchronous path cannot consult the iModel's [SchemaFormatsProvider]($ecschema-metadata) —
   * use [[evaluateFieldsAsync]] for that fallback.
   *
   * Providers should be pre-warmed with the results of [[collectFieldFormattingRequirements]].
   * Missing specs fall back to the raw string.
   *
   * Each registration replaces any prior one for the same `formatSet`.
   *
   * ### Registration lifetime is caller-owned
   *
   * Registrations are **process-wide** and are not scoped to any [IModelDb]($backend). Two
   * iModels that happen to carry the same FormatSet [Id64String]($bentley) will share whichever
   * provider was registered most recently — nothing associates a registration with the
   * [IModelDb]($backend) the FormatSet came from.
   *
   * Hosts are responsible for registering a provider when the iModel it applies to opens and
   * calling [[unregisterFieldFormattingProvider]] when that iModel closes. Failing to
   * unregister leaves a stale entry in the process-wide registry that a subsequent iModel
   * carrying the same FormatSet id may silently consume.
   *
   * Symmetrically, unregistering (or never registering) a provider that saved-annotation
   * `cachedContent` depends on causes the next source-element update to overwrite the
   * previously-formatted content with the raw string representation — see
   * [[unregisterFieldFormattingProvider]] for details. Hosts that need formatted output to
   * survive across a temporary provider gap should re-register before the next txn commit,
   * or explicitly re-evaluate the affected [TextBlock]($common)s via [[evaluateFieldsAsync]]
   * once a provider is available again.
   *
   * The canonical pattern uses [IModelDb.onBeforeClose]($backend):
   *
   * ```ts
   * iModel.onBeforeClose.addOnce(() => {
   *   ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(formatSetId);
   * });
   * ElementDrivesTextAnnotation.registerFieldFormattingProvider({ formatSet: formatSetId, provider });
   * ```
   *
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
   * `formatSet`, if any.
   *
   * Hosts should call this when the iModel that owns the FormatSet closes (typically from an
   * [IModelDb.onBeforeClose]($backend) listener installed alongside the corresponding
   * [[registerFieldFormattingProvider]] call). See [[registerFieldFormattingProvider]] for the
   * lifetime contract and the canonical pattern.
   *
   * ### Effect on saved `cachedContent`
   *
   * Unregistering does **not** clear or reformat any [FieldRun.cachedContent]($common) that
   * was already persisted while the provider was registered. However, once unregistered, any
   * subsequent source-element update that fires a `TxnManager` field-update callback will
   * re-run [[evaluateFields]] for the affected annotations and, finding no provider for the
   * field's [QuantityFieldFormatOptions.formatSet]($common), will overwrite `cachedContent`
   * with the raw string representation. Previously-formatted output is silently lost on the
   * next update. This is the accepted trade-off for keeping `cachedContent` in sync with the
   * current property value; hosts that need formatted output across a provider gap should
   * either keep the provider registered for the lifetime of the annotations that depend on
   * it, or re-register and explicitly re-evaluate the affected blocks via
   * [[evaluateFieldsAsync]] before the next source-element edit.
   * @beta
   */
  public static unregisterFieldFormattingProvider(formatSet: Id64String): void {
    fieldFormattingProviders.delete(formatSet);
  }

  /** Returns the [FormattingSpecProvider]($core-quantity) previously registered under
   * `formatSet` via [[registerFieldFormattingProvider]], if any.
   *
   * The returned provider is process-wide and not scoped to any [IModelDb]($backend); callers
   * that need a per-iModel guarantee should verify against their own bookkeeping. See
   * [[registerFieldFormattingProvider]] for the lifetime contract.
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
