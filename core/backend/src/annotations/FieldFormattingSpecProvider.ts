/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { BeUnorderedUiEvent, Id64String } from "@itwin/core-bentley";
import {
  createUnitsProvider, Format, FormatsProvider, FormatterSpec, FormattingSpecArgs, FormattingSpecEntry, FormattingSpecProvider, ParserSpec,
  UnitsProvider, UnitSystemKey,
} from "@itwin/core-quantity";
import { FormatSet, FormatSetFormatsProvider, SchemaFormatsProvider, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { IModelDb } from "../IModelDb";
import { collectIModelFieldFormattingRequirements } from "../internal/annotations/fields";

/** Describes a [FormatterSpec]($core-quantity) that a [FieldRun]($common) asked for but which
 * [[FieldFormattingSpecProvider]] had not pre-warmed, recorded by
 * [[FieldFormattingSpecProvider.misses]].
 * @beta
 */
export interface UnresolvedFieldFormat extends FormattingSpecArgs {
  /** The [QuantityFieldFormatOptions.formatSet]($common) of the field that missed, if it declared one. */
  formatSet?: Id64String;
}

/** Identifies one cached spec. `system` participates because a [FormattingSpecArgs]($core-quantity)
 * may request a unit system other than the provider's default.
 */
function specKey(args: FormattingSpecArgs): string {
  return `${args.name}|${args.persistenceUnitName}|${args.system ?? ""}`;
}

/** Builds the [FormatterSpec]($core-quantity) / [ParserSpec]($core-quantity) pair for one
 * requirement, or `undefined` when either the format or the persistence unit fails to resolve.
 * Both must succeed — a format with no resolvable persistence unit cannot convert.
 */
async function buildSpecEntry(
  args: FormattingSpecArgs,
  formatsProvider: FormatsProvider,
  unitsProvider: UnitsProvider,
): Promise<FormattingSpecEntry | undefined> {
  const formatProps = await formatsProvider.getFormat(args.name, args.system);
  if (!formatProps) {
    return undefined;
  }

  let persistenceUnit;
  try {
    persistenceUnit = await unitsProvider.findUnitByName(args.persistenceUnitName);
  } catch {
    return undefined;
  }
  if (!persistenceUnit?.isValid) {
    return undefined;
  }

  const format = await Format.createFromJSON("fieldFormat", unitsProvider, formatProps);
  return {
    formatterSpec: await FormatterSpec.create("fieldFormat", format, unitsProvider, persistenceUnit),
    parserSpec: await ParserSpec.create(format, unitsProvider, persistenceUnit),
  };
}

/** The pre-warmed specs backing a single FormatSet, or — for the default bucket — the iModel's
 * schema formats alone. Buckets other than the default fall through to it on a miss, so a field
 * naming a FormatSet that lacks an entry for its KindOfQuantity still resolves the schema
 * presentation format rather than dropping to the raw string.
 */
class FieldSpecBucket implements FormattingSpecProvider {
  public readonly onFormattingReady = new BeUnorderedUiEvent<void>();
  private readonly _specs = new Map<string, FormattingSpecEntry>();

  public constructor(
    private readonly _formatsProvider: FormatsProvider,
    private readonly _fallback: FieldSpecBucket | undefined,
  ) { }

  public getSpecsByNameAndUnit(args: FormattingSpecArgs): FormattingSpecEntry | undefined {
    return this._specs.get(specKey(args)) ?? this._fallback?.getSpecsByNameAndUnit(args);
  }

  public formatQuantity(magnitude: number, formatSpec: FormatterSpec): string {
    return formatSpec.applyFormatting(magnitude);
  }

  /** Resolves and caches every requirement not already cached. Requirements that resolve no
   * format or no persistence unit are skipped, leaving the field on the raw-string fallback.
   */
  public async warmUp(requirements: Iterable<FormattingSpecArgs>, unitsProvider: UnitsProvider): Promise<void> {
    for (const args of requirements) {
      const key = specKey(args);
      if (this._specs.has(key)) {
        continue;
      }

      const entry = await buildSpecEntry(args, this._formatsProvider, unitsProvider);
      if (entry) {
        this._specs.set(key, entry);
      }
    }

    this.onFormattingReady.raiseEvent();
  }
}

/** Arguments supplied to the [[FieldFormattingSpecProvider]] constructor and to
 * [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend).
 * @beta
 */
export interface FieldFormattingSpecProviderArgs {
  /** The iModel whose annotations this provider formats. Its `schemaContext` supplies the
   * fallback [SchemaFormatsProvider]($ecschema-metadata) and [SchemaUnitProvider]($ecschema-metadata).
   */
  iModel: IModelDb;
  /** The FormatSet adopted for this iModel. It applies to every [FieldRun]($common) that does
   * not name a different one via [QuantityFieldFormatOptions.formatSet]($common), and takes
   * precedence over the schema's own presentation formats.
   */
  formatSet?: FormatSet;
  /** Additional FormatSets addressable per-field, each paired with the [Id64String]($bentley)
   * that [FieldRun]($common)s reference via [QuantityFieldFormatOptions.formatSet]($common).
   * Use these to mix presentations within one iModel — imperial callouts on an otherwise metric
   * drawing, say. A field naming an id absent from this list falls back to [[formatSet]].
   */
  formatSets?: ReadonlyArray<{ id: Id64String, formatSet: FormatSet }>;
  /** Unit system used to pick a KindOfQuantity's presentation format when the schema offers
   * several. Defaults to [[formatSet]]'s own `unitSystem`, or `"metric"` when no FormatSet is
   * adopted.
   */
  unitSystem?: UnitSystemKey;
}

/** A per-[IModelDb]($backend) [FormattingSpecProvider]($core-quantity) that resolves
 * [FieldRun]($common) quantity formats **synchronously** from a cache built ahead of time by
 * [[warmUp]].
 *
 * This is what lets the synchronous field-evaluation path — [ElementDrivesTextAnnotation.evaluateFields]($backend)
 * and the `TxnManager` field-update callbacks, neither of which can await — produce the same
 * output that asynchronous formatting would. All asynchronous work (resolving formats, units,
 * and building [FormatterSpec]($core-quantity)s) happens once during [[warmUp]]; evaluation
 * afterwards is a map lookup.
 *
 * Formats resolve in this order:
 *
 *  1. The FormatSet named by the field's [QuantityFieldFormatOptions.formatSet]($common), if
 *     that id was supplied at construction.
 *  2. The FormatSet adopted for the iModel ([[FieldFormattingSpecProviderArgs.formatSet]]).
 *  3. The iModel's [SchemaFormatsProvider]($ecschema-metadata), i.e. the KindOfQuantity's own
 *     presentation format for [[FieldFormattingSpecProviderArgs.unitSystem]].
 *  4. The raw string representation, with the shortfall recorded in [[misses]].
 *
 * Units resolve through the bundled BIS units first, falling back to the iModel's schema units
 * for schema-defined custom units.
 *
 * @see [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend) to construct,
 * warm, and register one in a single call.
 * @beta
 */
export class FieldFormattingSpecProvider implements FormattingSpecProvider {
  /** Raised after each [[warmUp]] completes. */
  public readonly onFormattingReady = new BeUnorderedUiEvent<void>();
  /** The unit system used to select presentation formats from the iModel's schemas. */
  public readonly unitSystem: UnitSystemKey;

  private readonly _iModel: IModelDb;
  private readonly _unitsProvider: UnitsProvider;
  private readonly _default: FieldSpecBucket;
  private readonly _buckets = new Map<Id64String, FieldSpecBucket>();
  private readonly _misses = new Map<string, UnresolvedFieldFormat>();

  public constructor(args: FieldFormattingSpecProviderArgs) {
    this._iModel = args.iModel;
    // An adopted FormatSet declares the unit system it was authored for; honor it unless the
    // caller says otherwise.
    this.unitSystem = args.unitSystem ?? args.formatSet?.unitSystem ?? "metric";

    // Bundled BIS units answer first; the iModel's schemas are consulted only for units the
    // bundled set doesn't define.
    this._unitsProvider = createUnitsProvider({
      primary: new SchemaUnitProvider(args.iModel.schemaContext),
      bisUnitsPolicy: "preferBundled",
    });

    const schemaFormats = new SchemaFormatsProvider(args.iModel.schemaContext, this.unitSystem);
    // The adopted FormatSet (if any) layered over the iModel's own presentation formats. Every
    // per-field FormatSet falls through to this same chain, so a field naming a FormatSet that
    // has no entry for its KindOfQuantity still sees the adopted presentation before the
    // schema's, matching the documented resolution order.
    const defaultFormats = args.formatSet ? new FormatSetFormatsProvider({ formatSet: args.formatSet, fallbackProvider: schemaFormats }) : schemaFormats;
    this._default = new FieldSpecBucket(defaultFormats, undefined);
    for (const { id, formatSet } of args.formatSets ?? []) {
      this._buckets.set(id, new FieldSpecBucket(new FormatSetFormatsProvider({ formatSet, fallbackProvider: defaultFormats }), this._default));
    }
  }

  /** Requirements that were requested during evaluation but had no pre-warmed spec — typically
   * a [FieldRun]($common) added, or re-targeted at a different property, after the last
   * [[warmUp]]. Such fields fall back to their raw string representation.
   *
   * Misses accumulate rather than raising an event, because they are recorded from inside
   * synchronous `TxnManager` callbacks where re-entrant work is unsafe. Poll this after an edit,
   * then [[warmUp]] with the missing requirements and re-evaluate the affected annotations.
   */
  public get misses(): UnresolvedFieldFormat[] {
    return [...this._misses.values()];
  }

  /** Discards the accumulated [[misses]]. */
  public clearMisses(): void {
    this._misses.clear();
  }

  /** Records requirements that evaluation asked for but found no pre-warmed spec for. Called
   * only when a field resolved *none* of its candidates, so a miss here is always actionable.
   * @internal
   */
  public recordMisses(candidates: Iterable<FormattingSpecArgs>, formatSet: Id64String | undefined): void {
    for (const args of candidates) {
      const key = `${formatSet ?? ""}|${specKey(args)}`;
      if (!this._misses.has(key)) {
        this._misses.set(key, { ...args, formatSet });
      }
    }
  }

  /** Returns the [FormattingSpecProvider]($core-quantity) that formats fields declaring
   * `formatSet`. Fields with no `formatSet`, or naming one this provider wasn't given, resolve
   * against the iModel's schema formats.
   * @internal
   */
  public getProviderFor(formatSet: Id64String | undefined): FormattingSpecProvider {
    return (formatSet ? this._buckets.get(formatSet) : undefined) ?? this._default;
  }

  /** Looks up a spec in the schema-backed default bucket. Fields routed to a FormatSet are
   * resolved through [[getProviderFor]] instead.
   */
  public getSpecsByNameAndUnit(args: FormattingSpecArgs): FormattingSpecEntry | undefined {
    return this._default.getSpecsByNameAndUnit(args);
  }

  /** Applies `formatSpec` to `magnitude`. */
  public formatQuantity(magnitude: number, formatSpec: FormatterSpec): string {
    return this._default.formatQuantity(magnitude, formatSpec);
  }

  /** Resolves and caches the [FormatterSpec]($core-quantity)s needed to format `requirements`,
   * so that later synchronous evaluation is a cache hit.
   *
   * Every bucket is warmed with every requirement, since any field may name any FormatSet.
   * Requirements already cached are skipped, making repeated calls cheap.
   *
   * @param requirements the specs to pre-build. Defaults to
   * [ElementDrivesTextAnnotation.collectIModelFieldFormattingRequirements]($backend) over
   * [[FieldFormattingSpecProviderArgs.iModel]] — every requirement of every dependency-tracked
   * annotation currently in the iModel.
   */
  public async warmUp(requirements?: Iterable<FormattingSpecArgs>): Promise<void> {
    const reqs = Array.from(requirements ?? collectIModelFieldFormattingRequirements(this._iModel));

    for (const bucket of [this._default, ...this._buckets.values()]) {
      await bucket.warmUp(reqs, this._unitsProvider);
    }

    this.onFormattingReady.raiseEvent();
  }
}
