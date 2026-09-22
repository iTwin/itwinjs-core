/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import {
  BasicUnitsProvider, Format, FormatterSpec, FormattingSpecArgs, QuantityError, SyncFormatsProvider, SyncUnitsProvider, UnitSystemKey,
} from "@itwin/core-quantity";
import { FormatSet, FormatSetFormatsProvider, SchemaContext, SchemaFormatsProvider, SchemaItem, SchemaKey } from "@itwin/ecschema-metadata";
import { IModelDb } from "../IModelDb";
import { FieldSpecProvider, specKey } from "../internal/annotations/fieldSpecs";

/** Describes a [FormatterSpec]($core-quantity) that a [FieldRun]($common) asked for but which
 * [[FieldFormattingSpecProvider]] could not build, recorded by
 * [[FieldFormattingSpecProvider.misses]].
 * @beta
 */
export interface UnresolvedFieldFormat extends FormattingSpecArgs {
  /** The [QuantityFieldFormatOptions.formatSet]($common) key of the field that missed. */
  formatSet?: string;
}

/** [SchemaFormatsProvider.getFormatSync]($ecschema-metadata) reads only schemas already in the
 * context's cache; it never asks a locater to load one. The backend locater *can* load
 * synchronously, so ask the context for the schema first. That pulls it -- and the `Formats` and
 * `Units` schemas it references -- into the cache. A name whose schema the iModel lacks (a key
 * defined only by a FormatSet, say) is left for the formats provider to resolve or reject.
 */
function ensureSchemaLoaded(context: SchemaContext, fullName: string): void {
  const [schemaName] = SchemaItem.parseFullName(fullName);
  if (!schemaName) {
    return;
  }

  try {
    context.getSchemaSync(new SchemaKey(schemaName));
  } catch {
    // Not a schema this iModel knows.
  }
}

/** Builds the [FormatterSpec]($core-quantity) for one requirement, or `undefined` when the
 * format fails to resolve, the persistence unit is not a bundled BIS unit, the format names a
 * unit that is not, or the two cannot be converted between -- leaving the caller on the same
 * fallback as any other unresolved override.
 *
 * Only a formatter is built, never the matching [ParserSpec]($core-quantity): field evaluation
 * only ever formats.
 */
function buildSpec(
  args: FormattingSpecArgs,
  formatsProvider: SyncFormatsProvider,
  unitsProvider: SyncUnitsProvider,
  schemaContext: SchemaContext,
): FormatterSpec | undefined {
  ensureSchemaLoaded(schemaContext, args.name);
  const formatProps = formatsProvider.getFormatSync(args.name, args.system);
  if (!formatProps) {
    return undefined;
  }

  // BasicUnitsProvider reports an unknown unit as an invalid BadUnit rather than throwing.
  const persistenceUnit = unitsProvider.findUnitByNameSync(args.persistenceUnitName);
  if (!persistenceUnit.isValid) {
    return undefined;
  }

  let formatterSpec: FormatterSpec;
  try {
    const format = Format.createFromJSONSync("fieldFormat", unitsProvider, formatProps);
    formatterSpec = FormatterSpec.createSync("fieldFormat", format, unitsProvider, persistenceUnit);
  } catch (err) {
    // A format naming a unit the bundled provider lacks is an unresolvable requirement, not a bug.
    if (err instanceof QuantityError) {
      return undefined;
    }
    throw err;
  }

  // Reject a format whose units belong to a different phenomenon than the persisted value.
  // SyncUnitsProvider.getConversionSync reports this by returning the identity conversion tagged
  // `error: true`, and its contract requires callers to check that flag before applying the
  // result. FormatterSpec.createSync only logs a warning and keeps the identity conversion, so
  // without this check a length persisted in meters would render through an angle format as
  // "2.5 deg" -- relabelled rather than converted.
  if (formatterSpec.unitConversions.some((conversion) => conversion.conversion.error)) {
    return undefined;
  }

  return formatterSpec;
}

/** The specs backing a single FormatSet, or -- for the default bucket -- the adopted FormatSet
 * layered over the iModel's schema formats. Each spec is built on first request and memoized,
 * including the negative result, so a field that can never resolve is not re-attempted on every
 * evaluation.
 *
 * Buckets other than the default delegate to it any name their own FormatSet does not define:
 * such a name would resolve through the fallback chain to the very spec the default bucket
 * caches, so building it here would only duplicate the entry.
 */
class FieldSpecBucket implements FieldSpecProvider {
  private readonly _specs = new Map<string, FormatterSpec | undefined>();

  public constructor(
    private readonly _formatsProvider: SyncFormatsProvider,
    private readonly _unitsProvider: SyncUnitsProvider,
    private readonly _schemaContext: SchemaContext,
    private readonly _fallback: FieldSpecBucket | undefined,
    private readonly _formatSet: FormatSet | undefined = undefined,
  ) { }

  public getFormatterSpec(args: FormattingSpecArgs): FormatterSpec | undefined {
    if (this._fallback && !this.definesOwnFormat(args.name)) {
      return this._fallback.getFormatterSpec(args);
    }

    const key = specKey(args);
    if (this._specs.has(key)) {
      return this._specs.get(key);
    }

    const spec = buildSpec(args, this._formatsProvider, this._unitsProvider, this._schemaContext);
    this._specs.set(key, spec);
    return spec;
  }

  public formatQuantity(magnitude: number, formatSpec: FormatterSpec): string {
    return formatSpec.applyFormatting(magnitude);
  }

  /** Whether this bucket's own FormatSet supplies `name`, applying the same normalization
   * [FormatSetFormatsProvider]($ecschema-metadata) applies before its lookup. */
  private definesOwnFormat(name: string): boolean {
    if (!this._formatSet) {
      return false;
    }

    const [schemaName, itemName] = SchemaItem.parseFullName(name);
    return undefined !== this._formatSet.formats[schemaName === "" ? itemName : `${schemaName}.${itemName}`];
  }
}

/** Arguments supplied to the [[FieldFormattingSpecProvider]] constructor and to
 * [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend).
 * @beta
 */
export interface FieldFormattingSpecProviderArgs {
  /** The iModel whose annotations this provider formats. Its `schemaContext` supplies the
   * fallback [SchemaFormatsProvider]($ecschema-metadata).
   */
  iModel: IModelDb;
  /** The FormatSet adopted for this iModel. It applies to every [FieldRun]($common) that does
   * not name a different one via [QuantityFieldFormatOptions.formatSet]($common), and takes
   * precedence over the schema's own presentation formats.
   */
  formatSet?: FormatSet;
  /** Additional FormatSets addressable per-field, each paired with the id that
   * [FieldRun]($common)s reference via [QuantityFieldFormatOptions.formatSet]($common).
   * The id must be unique; if two entries share an id the last one wins. A field naming an id
   * absent from this list falls back to [[formatSet]].
   */
  formatSets?: ReadonlyArray<{ id: string, formatSet: FormatSet }>;
  /** Unit system used to pick a KindOfQuantity's presentation format when the schema offers
   * several. Defaults to [[formatSet]]'s own `unitSystem`, or `"metric"` when no FormatSet is
   * adopted.
   */
  unitSystem?: UnitSystemKey;
}

/** A per-[IModelDb]($backend) cache of [FormatterSpec]($core-quantity)s that resolves
 * [FieldRun]($common) quantity formats **synchronously**, so that
 * [ElementDrivesTextAnnotation.evaluateFields]($backend) and the `TxnManager` field-update
 * callbacks -- neither of which can await -- can format quantities. Specs are built on first
 * use from the iModel's schemas and the adopted FormatSets, then memoized.
 *
 * One provider holds every FormatSet an iModel uses, caching each FormatSet's formats separately.
 * Formats resolve in this order:
 *
 *  1. The FormatSet named by the field's [QuantityFieldFormatOptions.formatSet]($common).
 *  2. The FormatSet adopted for the iModel ([[FieldFormattingSpecProviderArgs.formatSet]]).
 *  3. The KindOfQuantity's presentation format for [[FieldFormattingSpecProviderArgs.unitSystem]].
 *  4. `value.toString()`, with the unresolved requirement recorded in [[misses]].
 *
 * Units resolve through the bundled BIS [BasicUnitsProvider]($core-quantity) only. A field whose
 * persistence unit, or whose format's units, are defined solely by the iModel's own schemas
 * falls to step 4.
 *
 * @see [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend) to construct and
 * register one in a single call -- normally when the iModel opens.
 * @see [Quantity formatting for text annotation fields]($docs/learning/backend/TextAnnotationFields.md)
 * @beta
 */
export class FieldFormattingSpecProvider {
  /** The unit system used to select presentation formats from the iModel's schemas. */
  public readonly unitSystem: UnitSystemKey;

  private readonly _default: FieldSpecBucket;
  private readonly _buckets = new Map<string, FieldSpecBucket>();
  private readonly _misses = new Map<string, UnresolvedFieldFormat>();

  public constructor(args: FieldFormattingSpecProviderArgs) {
    // An adopted FormatSet declares the unit system it was authored for; honor it unless the
    // caller says otherwise.
    this.unitSystem = args.unitSystem ?? args.formatSet?.unitSystem ?? "metric";

    const schemaContext = args.iModel.schemaContext;
    const unitsProvider = new BasicUnitsProvider();
    const schemaFormats = new SchemaFormatsProvider(schemaContext, this.unitSystem);
    // The adopted FormatSet (if any) layered over the iModel's own presentation formats. Every
    // per-field FormatSet falls through to this same chain, so a field naming a FormatSet that
    // has no entry for its KindOfQuantity still sees the adopted presentation before the
    // schema's, matching the documented resolution order.
    const defaultFormats = args.formatSet ? new FormatSetFormatsProvider({ formatSet: args.formatSet, fallbackProvider: schemaFormats }) : schemaFormats;
    this._default = new FieldSpecBucket(defaultFormats, unitsProvider, schemaContext, undefined);
    for (const { id, formatSet } of args.formatSets ?? []) {
      const formats = new FormatSetFormatsProvider({ formatSet, fallbackProvider: defaultFormats });
      this._buckets.set(id, new FieldSpecBucket(formats, unitsProvider, schemaContext, this._default, formatSet));
    }
  }

  /** Requirements that evaluation asked for but could not build a spec for -- a persistence unit
   * or format unit outside the bundled BIS set, a KindOfQuantity with no presentation format, or a
   * format whose units belong to a different phenomenon than the persisted value. Such fields fall
   * back to `value.toString()`.
   *
   * Misses accumulate rather than raising an event, because they are recorded from inside
   * synchronous `TxnManager` callbacks where re-entrant work is unsafe.
   */
  public get misses(): UnresolvedFieldFormat[] {
    return [...this._misses.values()];
  }

  /** Discards the accumulated [[misses]]. */
  public clearMisses(): void {
    this._misses.clear();
  }

  /** Records requirements that evaluation asked for but could not resolve. Called only when a
   * field resolved *none* of its candidates.
   * @internal
   */
  public recordMisses(candidates: FormattingSpecArgs[], formatSet: string | undefined): void {
    for (const args of candidates) {
      const key = `${formatSet ?? ""}|${specKey(args)}`;
      if (!this._misses.has(key)) {
        this._misses.set(key, { ...args, formatSet });
      }
    }
  }

  /** Returns the formats to use for fields declaring `formatSet`. Fields with no `formatSet`, or
   * naming one this provider wasn't given, resolve against the adopted FormatSet and the iModel's
   * schema formats.
   * @internal
   */
  public getProviderFor(formatSet: string | undefined): FieldSpecProvider {
    return (formatSet ? this._buckets.get(formatSet) : undefined) ?? this._default;
  }

  /** Resolves a spec among the iModel's schema formats and the adopted
   * [[FieldFormattingSpecProviderArgs.formatSet]], building and caching it on first request.
   * Fields naming a different FormatSet resolve against that FormatSet's own formats instead.
   */
  public getFormatterSpec(args: FormattingSpecArgs): FormatterSpec | undefined {
    return this._default.getFormatterSpec(args);
  }

  /** Applies `formatSpec` to `magnitude`. */
  public formatQuantity(magnitude: number, formatSpec: FormatterSpec): string {
    return this._default.formatQuantity(magnitude, formatSpec);
  }
}
