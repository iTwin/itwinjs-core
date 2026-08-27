/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { BeUnorderedUiEvent } from "@itwin/core-bentley";
import {
  createUnitsProvider, Format, FormatsProvider, FormatterSpec, FormattingSpecArgs,
  UnitProps,
  UnitsProvider, UnitSystemKey,
} from "@itwin/core-quantity";
import { FormatSet, FormatSetFormatsProvider, SchemaFormatsProvider, SchemaItem, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { FieldSpecProvider } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";
import { specKey } from "../internal/annotations/specKey";

/** Describes a [FormatterSpec]($core-quantity) that a [FieldRun]($common) asked for but which
 * [[FieldFormattingSpecProvider]] had not pre-warmed, recorded by
 * [[FieldFormattingSpecProvider.misses]].
 * @beta
 */
export interface UnresolvedFieldFormat extends FormattingSpecArgs {
  /** The [QuantityFieldFormatOptions.formatSet]($common) key of the field that missed. */
  formatSet?: string;
}

/** Maps the `"alias:UnitName"` form that `meta.KindOfQuantityDef.PersistenceUnit` stores — and
 * the bare `"UnitName"` form — to the `"SchemaName.UnitName"` full name that
 * [FormattingSpecArgs]($core-quantity) expects. The bare form is only registered for the first
 * schema that declares a unit of that name, since it is inherently ambiguous; the aliased form
 * is always unambiguous and is what the metadata actually stores.
 * See `docs/learning/ECSqlReference/MetaQueries.md`.
 */
function readUnitFullNames(iModel: IModelDb): Map<string, string> {
  const map = new Map<string, string>();
  iModel.withQueryReader(
    "SELECT schemaDef.Alias, schemaDef.Name, unitDef.Name FROM meta.UnitDef unitDef JOIN meta.ECSchemaDef schemaDef ON unitDef.Schema.Id = schemaDef.ECInstanceId",
    (reader) => {
      for (const row of reader) {
        const [alias, schemaName, unitName] = [row[0] as string, row[1] as string, row[2] as string];
        const fullName = `${schemaName}.${unitName}`;
        map.set(`${alias}:${unitName}`, fullName);
        if (!map.has(unitName)) {
          map.set(unitName, fullName);
        }
      }
    });

  return map;
}

/** Builds the [FormatterSpec]($core-quantity) for one requirement, or `undefined` when the
 * format fails to resolve, the persistence unit fails to resolve, or the two cannot be converted
 * between. All three must succeed — a format that cannot convert the persisted magnitude is not
 * usable, so the caller falls back as it would for any other unresolved override.
 *
 * Only a formatter is built, never the matching [ParserSpec]($core-quantity): field evaluation
 * only ever formats, so parsing every warmed requirement would spend roughly half the warm-up on
 * a path that does not exist. Applications that need to parse can build one from the same
 * [Format]($core-quantity) themselves.
 */
async function buildSpec(
  args: FormattingSpecArgs,
  formatsProvider: FormatsProvider,
  unitsProvider: UnitsProvider,
): Promise<FormatterSpec | undefined> {
  const formatProps = await formatsProvider.getFormat(args.name, args.system);
  if (!formatProps) {
    return undefined;
  }

  let persistenceUnit: UnitProps | undefined;
  try {
    // The [BasicUnitsProvider]($core-quantity) built in the constructor (via [createUnitsProvider]($core-quantity))
    // reports an unknown unit as an invalid BadUnit rather than throwing, so `isValid` below is
    // what actually rejects. The catch is defensive: nothing in the UnitsProvider contract forbids throwing.
    persistenceUnit = await unitsProvider.findUnitByName(args.persistenceUnitName);
  } catch {
    return undefined;
  }
  if (!persistenceUnit?.isValid) {
    return undefined;
  }

  const format = await Format.createFromJSON("fieldFormat", unitsProvider, formatProps);
  const formatterSpec = await FormatterSpec.create("fieldFormat", format, unitsProvider, persistenceUnit);

  // Reject a format whose units belong to a different phenomenon than the persisted value.
  // UnitsProvider.getConversion reports this by returning the identity conversion tagged
  // `error: true`, and its contract requires callers to check that flag before applying the
  // result. FormatterSpec.getUnitConversions only logs a warning and keeps the identity
  // conversion, so without this check a length persisted in meters would render through an
  // angle format as "2.5 deg" -- relabelled rather than converted.
  if (formatterSpec.unitConversions.some((conversion) => conversion.conversion.error)) {
    return undefined;
  }

  return formatterSpec;
}

/** The pre-warmed specs backing a single FormatSet, or — for the default bucket — the iModel's
 * schema formats alone. Buckets other than the default fall through to it on a miss, so a field
 * naming a FormatSet that lacks an entry for its KindOfQuantity still resolves the schema
 * presentation format rather than dropping to the raw string.
 */
class FieldSpecBucket implements FieldSpecProvider {
  private readonly _specs = new Map<string, FormatterSpec>();

  public constructor(
    private readonly _formatsProvider: FormatsProvider,
    private readonly _fallback: FieldSpecBucket | undefined,
    /** The FormatSet backing this bucket, when it has one. Only consulted to decide whether a
     * requirement is this bucket's own business or the fallback's — see [[warmUp]].
     */
    private readonly _formatSet: FormatSet | undefined = undefined,
  ) { }

  public getFormatterSpec(args: FormattingSpecArgs): FormatterSpec | undefined {
    return this._specs.get(specKey(args)) ?? this._fallback?.getFormatterSpec(args);
  }

  public formatQuantity(magnitude: number, formatSpec: FormatterSpec): string {
    return formatSpec.applyFormatting(magnitude);
  }

  /** Whether this bucket's own FormatSet supplies `name`, applying the same normalization
   * [FormatSetFormatsProvider]($ecschema-metadata) applies before its lookup. A `string` entry
   * counts: it is a reference this set chose to define, even if resolving it ends up
   * delegating.
   *
   * This duplicates `FormatSetFormatsProvider.getFormat`'s normalization because that class
   * exposes no "does this set define the key" query, and its own lookup cannot answer the
   * question -- it consults the fallback provider and resolves string references, both of which
   * would report `true` for keys that are not this set's own business. Should the two ever
   * diverge, this bucket would skip warming a key its FormatSet does define and the field would
   * silently resolve through the fallback bucket instead -- no throw, and nothing on
   * [[FieldFormattingSpecProvider.misses]], because a spec still resolves. `FieldFormat.test.ts`
   * "routes a colon-separated KindOfQuantity name to the FormatSet that defines it in
   * dot-separated form" pins the agreement so CI catches that rather than a user.
   */
  private definesOwnFormat(name: string): boolean {
    if (!this._formatSet) {
      return false;
    }

    const [schemaName, itemName] = SchemaItem.parseFullName(name);
    return undefined !== this._formatSet.formats[schemaName === "" ? itemName : `${schemaName}.${itemName}`];
  }

  /** Resolves and caches every requirement not already cached. Requirements that resolve no
   * format or no persistence unit are skipped, leaving the field on the raw-string fallback.
   *
   * A requirement this bucket's FormatSet does not define is skipped outright. Such a lookup
   * would delegate to the fallback bucket's own formats provider and produce a spec equal to
   * the one the fallback already caches, which [[getFormatterSpec]] finds anyway — so
   * building it here would only duplicate that entry.
   */
  public async warmUp(requirements: FormattingSpecArgs[], unitsProvider: UnitsProvider): Promise<void> {
    for (const args of requirements) {
      if (this._fallback && !this.definesOwnFormat(args.name)) {
        continue;
      }

      const key = specKey(args);
      if (this._specs.has(key)) {
        continue;
      }

      const spec = await buildSpec(args, this._formatsProvider, unitsProvider);
      if (spec) {
        this._specs.set(key, spec);
      }
    }
  }
}

/** Arguments supplied to [FieldFormattingSpecProvider.create]($backend) and to
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
  /** Additional FormatSets addressable per-field, each paired with the id that
   * [FieldRun]($common)s reference via [QuantityFieldFormatOptions.formatSet]($common).
   * Use these to mix presentations within one iModel — imperial callouts on an otherwise metric
   * drawing, say. The id must be unique; a field naming an id absent from this list falls back to
   * [[formatSet]].
   */
  formatSets?: ReadonlyArray<{ id: string, formatSet: FormatSet }>;
  /** Unit system used to pick a KindOfQuantity's presentation format when the schema offers
   * several. Defaults to [[formatSet]]'s own `unitSystem`, or `"metric"` when no FormatSet is
   * adopted.
   */
  unitSystem?: UnitSystemKey;
  /** The specs to pre-build, so that the synchronous evaluation that follows finds each in cache.
   * Required — iTwin.js does not discover requirements on its own. Compose it from
   * [[FieldFormattingSpecProvider.collectSchemaFormattingRequirements]],
   * [ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend) and/or
   * [ElementDrivesTextAnnotation.getFieldFormattingRequirements]($backend). Duplicates are
   * harmless: warming skips anything already cached.
   *
   * Pass an empty array to obtain a provider that formats nothing until
   * [[FieldFormattingSpecProvider.warmUp]] is called.
   */
  requirements: FormattingSpecArgs[];
}

/** A per-[IModelDb]($backend) cache of [FormatterSpec]($core-quantity)s that resolves
 * [FieldRun]($common) quantity formats **synchronously**, built ahead of time by [[warmUp]].
 *
 * One provider holds **every** FormatSet an iModel uses, not one per FormatSet: the adopted
 * [[FieldFormattingSpecProviderArgs.formatSet]] plus any number of additional
 * [[FieldFormattingSpecProviderArgs.formatSets]] keyed by a unique id. Each is
 * warmed into its own bucket, and an individual [FieldRun]($common) selects one by naming its id
 * in [QuantityFieldFormatOptions.formatSet]($common).
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
 * Note that steps 1–3 are resolved during [[warmUp]], not at lookup time: a requirement that was
 * never warmed falls straight to step 4, even though its KindOfQuantity would have resolved a
 * schema format had it been warmed. This is why registration pre-warms by default.
 *
 * Units resolve through the bundled BIS units first, falling back to the iModel's schema units
 * for schema-defined custom units.
 *
 * @see [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend) to construct,
 * warm, and register one in a single call — normally when the iModel opens.
 * @beta
 */
export class FieldFormattingSpecProvider {
  /** Raised after each [[warmUp]] completes. */
  public readonly onFormattingReady = new BeUnorderedUiEvent<void>();
  /** The unit system used to select presentation formats from the iModel's schemas. */
  public readonly unitSystem: UnitSystemKey;

  private readonly _unitsProvider: UnitsProvider;
  private readonly _default: FieldSpecBucket;
  private readonly _buckets = new Map<string, FieldSpecBucket>();
  private readonly _misses = new Map<string, UnresolvedFieldFormat>();

  private constructor(args: FieldFormattingSpecProviderArgs) {
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
      this._buckets.set(id, new FieldSpecBucket(new FormatSetFormatsProvider({ formatSet, fallbackProvider: defaultFormats }), this._default, formatSet));
    }
  }

  /** Creates a provider and pre-warms it with [[FieldFormattingSpecProviderArgs.requirements]],
   * so the returned provider is ready for synchronous evaluation.
   *
   * This is the only way to obtain a `FieldFormattingSpecProvider`: the constructor is private
   * because a provider is only useful once warmed, and warming is asynchronous. Requirements
   * discovered later — a block authored after open, or anything surfacing in [[misses]] — are
   * added incrementally with [[warmUp]].
   *
   * @note Applications registering the provider for an iModel should call
   * [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend) instead, which
   * creates, warms and registers in one step.
   * @beta
   */
  public static async create(args: FieldFormattingSpecProviderArgs): Promise<FieldFormattingSpecProvider> {
    const provider = new FieldFormattingSpecProvider(args);
    await provider.warmUp(args.requirements);
    return provider;
  }

  /** Enumerates one [FormattingSpecArgs]($core-quantity) per [KindOfQuantity]($ecschema-metadata)
   * declared by `iModel`'s schemas whose persistence unit resolves — a schema-derived starting
   * set to pass to [[warmUp]] or to
   * [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend).
   *
   * Two metadata queries, bounded by the schemas rather than by the data, so it is safe to call
   * on open. The trade is that it warms every declared KindOfQuantity, referenced or not.
   *
   * This is intended for the iModel level. Use
   * [ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend) or
   * [ElementDrivesTextAnnotation.getFieldFormattingRequirements]($backend) to gather requirements
   * for [FieldRun]($common)s with overrides.
   * @beta
   */
  public static collectSchemaFormattingRequirements(iModel: IModelDb): FormattingSpecArgs[] {
    const units = readUnitFullNames(iModel);
    const requirements: FormattingSpecArgs[] = [];
    iModel.withQueryReader(
      "SELECT s.Name, koq.Name, koq.PersistenceUnit FROM meta.KindOfQuantityDef koq JOIN meta.ECSchemaDef s ON koq.Schema.Id = s.ECInstanceId",
      (reader) => {
        for (const row of reader) {
          const persistenceUnitName = units.get(row[2] as string);
          if (persistenceUnitName) {
            requirements.push({ name: `${row[0] as string}.${row[1] as string}`, persistenceUnitName });
          }
        }
      });

    return requirements;
  }

  /** Requirements that were requested during evaluation but had no pre-warmed spec — typically
   * a [FieldRun]($common) added, or re-targeted at a different property, after the last
   * [[warmUp]]. Such fields fall back to their raw string representation.
   *
   * Misses accumulate rather than raising an event, because they are recorded from inside
   * synchronous `TxnManager` callbacks where re-entrant work is unsafe. Poll this after an edit,
   * then [[warmUp]] with the missing requirements and re-evaluate the affected annotations.
   *
   * Because iTwin.js never discovers requirements on its own, this is the primary signal that an
   * application's chosen requirement set was incomplete — an expected part of an incremental
   * workflow, not necessarily a mistake.
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
  public recordMisses(candidates: FormattingSpecArgs[], formatSet: string | undefined): void {
    for (const args of candidates) {
      const key = `${formatSet ?? ""}|${specKey(args)}`;
      if (!this._misses.has(key)) {
        this._misses.set(key, { ...args, formatSet });
      }
    }
  }

  /** Returns the bucket that formats fields declaring `formatSet`. Fields with no `formatSet`, or
   * naming one this provider wasn't given, resolve against the iModel's schema formats.
   * @internal
   */
  public getProviderFor(formatSet: string | undefined): FieldSpecProvider {
    return (formatSet ? this._buckets.get(formatSet) : undefined) ?? this._default;
  }

  /** Looks up a spec in the schema-backed default bucket. Fields routed to a FormatSet are
   * resolved through [[getProviderFor]] instead.
   */
  public getFormatterSpec(args: FormattingSpecArgs): FormatterSpec | undefined {
    return this._default.getFormatterSpec(args);
  }

  /** Applies `formatSpec` to `magnitude`. */
  public formatQuantity(magnitude: number, formatSpec: FormatterSpec): string {
    return this._default.formatQuantity(magnitude, formatSpec);
  }

  /** Resolves and caches the [FormatterSpec]($core-quantity)s needed to format `requirements`,
   * so that later synchronous evaluation is a cache hit.
   *
   * Each FormatSet bucket is warmed only with the requirements its own FormatSet defines.
   * Anything else it would have resolved by falling through to the default bucket, which
   * [[getFormatterSpec]] does at lookup time anyway, so warming it per bucket would just
   * duplicate the default's entry. Requirements already cached are skipped, making repeated
   * calls cheap.
   *
   * @param requirements the specs to pre-build. Accumulate them with
   * [ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend),
   * [ElementDrivesTextAnnotation.getFieldFormattingRequirements]($backend) and/or
   * [[collectSchemaFormattingRequirements]]. There is no
   * default: this provider never discovers requirements by walking the iModel.
   */
  public async warmUp(requirements: FormattingSpecArgs[]): Promise<void> {
    // Warm the default bucket first so the cache is populated in resolution order. Ordering is not
    // load-bearing: no bucket reads another's cache while warming.
    for (const bucket of [this._default, ...this._buckets.values()]) {
      await bucket.warmUp(requirements, this._unitsProvider);
    }

    this.onFormattingReady.raiseEvent();
  }
}
