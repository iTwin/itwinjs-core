/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { FieldFormattingSpecResolver, QueryBinder, RelatedElement, ResolvedFieldFormattingSpecProvider, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
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
// provider (e.g. a FormatSet-backed `FormattingSpecProvider`). Entries are keyed by FormatSet
// [Id64String](); the `DEFAULT_FORMAT_SET_KEY` sentinel holds the default used when a field has
// no `formatSet` or no matching registration.
interface RegisteredFieldFormattingProvider {
  provider: FormattingSpecProvider;
  onMissingSpec?: "fallback" | "throw";
}
const DEFAULT_FORMAT_SET_KEY = "__default__";
const fieldFormattingProviders = new Map<string, RegisteredFieldFormattingProvider>();

function keyForFormatSet(formatSet: Id64String | undefined): string {
  return formatSet ?? DEFAULT_FORMAT_SET_KEY;
}

/** Builds a resolver implementing the cascading lookup on
 * [QuantityFieldFormatOptions.formatSet]($common): the field's `formatSet` registration first,
 * then the default. Returns `undefined` when no providers are registered.
 */
function createFieldFormattingSpecResolver(): FieldFormattingSpecResolver | undefined {
  if (fieldFormattingProviders.size === 0) {
    return undefined;
  }
  return {
    resolve(formatSet: string | undefined): ResolvedFieldFormattingSpecProvider | undefined {
      if (formatSet) {
        const specific = fieldFormattingProviders.get(formatSet);
        if (specific) {
          return { provider: specific.provider, onMissingSpec: specific.onMissingSpec };
        }
      }
      const fallback = fieldFormattingProviders.get(DEFAULT_FORMAT_SET_KEY);
      return fallback ? { provider: fallback.provider, onMissingSpec: fallback.onMissingSpec } : undefined;
    },
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

/** Application-supplied providers used to format `"quantity"` and `"coordinate"` [FieldRun]($common)s.
 * Any omitted provider defaults to a schema-backed implementation derived from
 * [[EvaluateFieldsArgs.iModel]]'s schema context. Hosts that own a
 * [FormattingSpecProvider]($core-quantity) backed by an adopted FormatSet supply it here to route
 * FieldRun formatting through their own provider.
 * @beta
 */
export interface FieldFormattingProviders {
  /** Resolves a [FormatProps]($core-quantity) by KindOfQuantity name. */
  formatsProvider?: FormatsProvider;
  /** Resolves [UnitProps]($core-quantity) (e.g. a value's persistence unit). */
  unitsProvider?: UnitsProvider;
  /** Behavior when a `"quantity"` or `"coordinate"` [FieldRun]($common) has no matching
   * [FormatterSpec]($core-quantity). `"fallback"` (default) renders the raw string; `"throw"`
   * rejects with an [[Error]] describing the missing spec.
   *
   * Applies only to [[ElementDrivesTextAnnotation.evaluateFieldsAsync]]. The synchronous
   * [[ElementDrivesTextAnnotation.evaluateFields]] and `TxnManager` callback paths use the
   * `onMissingSpec` supplied at [[ElementDrivesTextAnnotation.registerFieldFormattingProvider]];
   * with no provider registered, they always fall back.
   */
  onMissingSpec?: "fallback" | "throw";
}

/** Arguments supplied to [[ElementDrivesTextAnnotation.evaluateFieldsAsync]].
 * @beta
 */
export interface EvaluateFieldsAsyncArgs extends EvaluateFieldsArgs {
  /** Providers used to format `"quantity"` and `"coordinate"` [FieldRun]($common)s. When
   * omitted, a schema-backed default is built from [[iModel]].
   */
  formatting?: FieldFormattingProviders;
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
      updateAllFields(annotationElementId, txn, createFieldFormattingSpecResolver());
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
    updateElementFields(arg.props, arg.indirectEditTxn, false, createFieldFormattingSpecResolver());
  }

  /** @internal */
  public static override onDeletedDependencyArg(arg: OnDependencyArg): void {
    updateElementFields(arg.props, arg.indirectEditTxn, true, createFieldFormattingSpecResolver());
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
   * [[registerFieldFormattingProvider]], each `"quantity"` or `"coordinate"` field is routed
   * using the cascading lookup on [QuantityFieldFormatOptions.formatSet]($common):
   *   1. The field's `formatSet` registration.
   *   2. The default registration (registered with no `formatSet`).
   *   3. Raw string representation.
   * @returns the number of fields whose display strings were modified.
   * @throws Error if evaluation of any field fails.
   */
  public static evaluateFields(args: EvaluateFieldsArgs): number {
    const resolver = createFieldFormattingSpecResolver();
    return updateFields(args.block, createUpdateContext(undefined, args.iModel, false, resolver))
  }

  /** Async counterpart to [[evaluateFields]] that formats `"quantity"` and `"coordinate"`
   * [FieldRun]($common)s through the standard iTwin.js quantity pipeline. Non-quantity fields
   * are formatted identically to [[evaluateFields]].
   *
   * By default the [FormatsProvider]($core-quantity) and [UnitsProvider]($core-quantity) are
   * derived from `args.iModel`'s schema context. Supply [[EvaluateFieldsAsyncArgs.formatting]]
   * to route formatting through an application-owned provider (e.g. a FormatSet-backed
   * [FormattingSpecProvider]($core-quantity)).
   *
   * For each `"quantity"` or `"coordinate"` field the format is resolved in this priority
   * order (see [QuantityFieldFormatOptions]($common) for the full contract):
   *   1. [QuantityFieldFormatOptions.kindOfQuantity]($common) — looked up via the active [FormatsProvider]($core-quantity).
   *   2. The property's own [KindOfQuantity]($ecschema-metadata).
   *   3. For `"coordinate"` only, a built-in default backed by `Units.LENGTH`.
   *
   * If none yields a usable format, the raw value is rendered via `toString()` (or an error is
   * thrown when [FieldFormattingProviders.onMissingSpec]($backend) is `"throw"`).
   * @returns the number of fields whose display strings were modified.
   * @beta
   */
  public static async evaluateFieldsAsync(args: EvaluateFieldsAsyncArgs): Promise<number> {
    const context = createUpdateContext(undefined, args.iModel, false, undefined, args.formatting?.onMissingSpec);
    const formatter = createFieldFormatterContext(args.iModel, args.formatting);
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

  /** Registers a synchronous [FormattingSpecProvider]($core-quantity), optionally scoped to a
   * specific FormatSet element. Once registered, [[evaluateFields]] and the `TxnManager`-driven
   * field-update callback path format `"quantity"` and `"coordinate"` fields via the cascading
   * lookup on [QuantityFieldFormatOptions.formatSet]($common):
   *   1. The field's `formatSet` registration.
   *   2. The default registration (registered with no `formatSet`).
   *   3. Raw string representation.
   *
   * Providers should be pre-warmed with the results of [[collectFieldFormattingRequirements]].
   * Missing specs fall back to the raw string (or throw when the selected registration's
   * `onMissingSpec` is `"throw"`).
   *
   * Each registration replaces any prior one for the same `formatSet`. Registrations are
   * process-wide; use [[unregisterFieldFormattingProvider]] to remove one.
   *
   * TODO: Maybe this is unnecessary if we store the FormatSets in the iModel and look them up on demand.
   *
   * @beta
   */
  public static registerFieldFormattingProvider(
    args: {
      /** [Id64String]($bentley) of the FormatSet element whose fields route to `provider`. Omit
       * to register the default.
       */
      formatSet?: Id64String;
      /** Provider associated with `formatSet` (or the default when omitted). */
      provider: FormattingSpecProvider;
      /** Behavior when this provider has no spec for a given field.
       *   - `"fallback"` (default) renders the raw string;
       *   - `"throw"` propagates the failure.
       *
       * On the `TxnManager` driven callback path, a `"throw"` error is caught and logged via
       * [Logger]($bentley) rather than aborting the transaction; for hard failure, call
       * [[evaluateFields]] or [[evaluateFieldsAsync]] directly.
       */
      onMissingSpec?: "fallback" | "throw";
    },
  ): void {
    fieldFormattingProviders.set(keyForFormatSet(args.formatSet), { provider: args.provider, onMissingSpec: args.onMissingSpec });
  }

  /** Removes a registration previously created by [[registerFieldFormattingProvider]]. Pass
   * `formatSet` to remove a specific FormatSet-scoped registration; omit to remove the default.
   * @beta
   */
  public static unregisterFieldFormattingProvider(formatSet?: Id64String): void {
    fieldFormattingProviders.delete(keyForFormatSet(formatSet));
  }

  /** Returns the [FormattingSpecProvider]($core-quantity) previously registered under
   * `formatSet` via [[registerFieldFormattingProvider]], if any. Pass `formatSet` for a
   * specific FormatSet-scoped registration; omit for the default.
   * @beta
   */
  public static getFieldFormattingProvider(formatSet?: Id64String): FormattingSpecProvider | undefined {
    return fieldFormattingProviders.get(keyForFormatSet(formatSet))?.provider;
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
