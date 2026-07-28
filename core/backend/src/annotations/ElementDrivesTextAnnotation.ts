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
import { collectFieldFormattingRequirements, createFieldFormatterContext, createUpdateContext, getFieldFormattingProviderForIModel, getFieldFormattingRegistrationForIModel, setFieldFormattingProviderForIModel, updateAllFields, updateElementFields, updateFields, updateFieldsAsync } from "../internal/annotations/fields";
import { _implicitTxn } from "../internal/Symbols";
import { ElementDrivesElement, OnDependencyArg } from "../Relationship";
import { EditTxn } from "../EditTxn";

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

/** Application-supplied [FormatsProvider]($core-quantity) and [UnitsProvider]($core-quantity)
 * used to format `"quantity"` and `"coordinate"` [FieldRun]($common)s. Either provider may be
 * omitted; any provider not supplied is defaulted to a schema-backed implementation
 * derived from [[EvaluateFieldsArgs.iModel]]'s schema context.
 *
 * This is the injection point that a host that owns a
 * [FormattingSpecProvider]($core-quantity) backed by an adopted FormatSet) uses to route
 * FieldRun formatting through its own provider.
 * @beta
 */
export interface FieldFormattingProviders {
  /** Provider used to resolve a [FormatProps]($core-quantity) by KindOfQuantity name. */
  formatsProvider?: FormatsProvider;
  /** Provider used to resolve [UnitProps]($core-quantity) (e.g. the persistence unit of a value). */
  unitsProvider?: UnitsProvider;
  /** Controls what happens when a `"quantity"` or `"coordinate"` [FieldRun]($common) cannot
   * be matched to a [FormatterSpec]($core-quantity). Defaults to `"fallback"` (silently use
   * the raw string representation). When set to `"throw"`, the formatting call rejects with
   * an [[Error]] describing the missing spec.
   */
  onMissingSpec?: "fallback" | "throw";
}

/** Arguments supplied to [[ElementDrivesTextAnnotation.evaluateFieldsAsync]].
 * @beta
 */
export interface EvaluateFieldsAsyncArgs extends EvaluateFieldsArgs {
  /** Optional application-supplied formats/units providers used to format `"quantity"` and
   * `"coordinate"` [FieldRun]($common)s. When omitted, a schema-backed default is built from
   * [[iModel]].
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
      updateAllFields(annotationElementId, txn);
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
    updateElementFields(arg.props, arg.indirectEditTxn, false);
  }

  /** @internal */
  public static override onDeletedDependencyArg(arg: OnDependencyArg): void {
    updateElementFields(arg.props, arg.indirectEditTxn, true);
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
   * If a synchronous [FormattingSpecProvider]($core-quantity) has been registered for `args.iModel`
   * via [[setFieldFormattingProvider]], `"quantity"` and `"coordinate"` fields are formatted
   * through that provider using pre-built [FormatterSpec]($core-quantity)s. Otherwise those field
   * types are rendered as their raw string representation (as in prior versions).
   * @returns the number of fields whose display strings were modified.
   * @throws Error if evaluation of any field fails.
   */
  public static evaluateFields(args: EvaluateFieldsArgs): number {
    const registration = getFieldFormattingRegistrationForIModel(args.iModel);
    return updateFields(args.block, createUpdateContext(undefined, args.iModel, false, registration?.provider, registration?.onMissingSpec))
  }

  /** Async counterpart to [[evaluateFields]] that formats "quantity" and "coordinate" [FieldRun]($common)s
   * through the standard iTwin.js quantity formatting pipeline. Non-quantity field types are
   * formatted identically to [[evaluateFields]].
   *
   * By default the [FormatsProvider]($core-quantity) and [UnitsProvider]($core-quantity) used
   * during formatting are derived from `args.iModel`'s schema context. To route formatting through
   * an application-owned provider (e.g. a FormatSet-backed
   * [FormattingSpecProvider]($core-quantity)), supply [[EvaluateFieldsAsyncArgs.formatting]].
   * @returns the number of fields whose display strings were modified.
   * @beta
   */
  public static async evaluateFieldsAsync(args: EvaluateFieldsAsyncArgs): Promise<number> {
    const context = createUpdateContext(undefined, args.iModel, false, undefined, args.formatting?.onMissingSpec);
    const formatter = createFieldFormatterContext(args.iModel, args.formatting);
    return updateFieldsAsync(args.block, context, formatter);
  }

  /** Walks the [FieldRun]($common)s in a [TextBlock]($common) and returns a deduplicated
   * collection of the [FormattingSpecArgs]($core-quantity) their "quantity" and "coordinate"
   * values require in order to be formatted through the standard iTwin.js quantity pipeline.
   *
   * Intended to be consumed by an application-supplied [FormattingSpecProvider]($core-quantity)
   * so it can pre-build the [FormatterSpec]($core-quantity)s referenced by the annotation
   * before the annotation is inserted, updated, or re-evaluated. Fields that carry an inline
   * [QuantityFieldFormatOptions.format]($common) override, or whose target property has no
   * [KindOfQuantity]($ecschema-metadata) (and no `formatSetKey` / `persistenceUnit` override),
   * are omitted because they do not require a provider lookup.
   * @beta
   */
  public static collectFieldFormattingRequirements(args: EvaluateFieldsArgs): FormattingSpecArgs[] {
    return collectFieldFormattingRequirements(args.block, args.iModel);
  }

  /** Registers a synchronous [FormattingSpecProvider]($core-quantity) for `iModel`. When
   * registered, [[evaluateFields]] and the `TxnManager`-driven field-update callback path
   * (triggered when a source element referenced by a [FieldRun]($common) is modified) will
   * format `"quantity"` and `"coordinate"` fields through the provider using pre-built
   * [FormatterSpec]($core-quantity)s.
   *
   * The provider is expected to have been pre-warmed with the requirements returned by
   * [[collectFieldFormattingRequirements]] for every annotation that may be formatted through
   * this iModel; if a required spec has not been prepared, formatting falls back to the raw
   * string representation used prior to this feature (or throws if `options.onMissingSpec`
   * is `"throw"`).
   *
   * Pass `undefined` as `provider` to unregister a previously-registered provider. The
   * registration is held in a [WeakMap]() keyed by `iModel`, so it does not have to be
   * cleared explicitly when the iModel is closed.
   * @beta
   */
  public static setFieldFormattingProvider(
    iModel: IModelDb,
    provider: FormattingSpecProvider | undefined,
    options?: { onMissingSpec?: "fallback" | "throw" },
  ): void {
    setFieldFormattingProviderForIModel(iModel, provider, options);
  }

  /** Returns the [FormattingSpecProvider]($core-quantity) previously registered for `iModel`
   * via [[setFieldFormattingProvider]], if any.
   * @beta
   */
  public static getFieldFormattingProvider(iModel: IModelDb): FormattingSpecProvider | undefined {
    return getFieldFormattingProviderForIModel(iModel) as FormattingSpecProvider | undefined;
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
