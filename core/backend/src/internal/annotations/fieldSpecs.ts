/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FieldValue, QuantityFieldFormatOptions } from "@itwin/core-common";
import {
  BasicUnitsProvider, Format, FormatterSpec, FormattingSpecArgs, QuantityError, SyncFormatsProvider, SyncUnitsProvider, UnitSystemKey,
} from "@itwin/core-quantity";
import { FormatSetFormatsProvider, SchemaContext, SchemaFormatsProvider, SchemaItem, SchemaKey } from "@itwin/ecschema-metadata";
import type { FieldFormattingArgs } from "../../annotations/ElementDrivesTextAnnotation";
import type { IModelDb } from "../../IModelDb";

/** A [FieldValue]($common) as the backend resolves it: the primitive value plus, for
 * `"quantity"` and `"coordinate"` types, the KindOfQuantity and persistence unit of the EC
 * property it was read from. These serve as the fallback when the field's own
 * [QuantityFieldFormatOptions]($common) do not resolve.
 * @internal
 */
export interface ResolvedFieldValue extends FieldValue {
  /** EC full name of the property's KindOfQuantity, e.g. `"AecUnits.LENGTH"`, if it has one. */
  kindOfQuantityFullName?: string;
  /** EC full name of the unit the stored magnitude is expressed in, e.g. `"Units.M"`. */
  persistenceUnitFullName?: string;
}

/** The formats an iModel's fields resolve through, as configured by
 * [ElementDrivesTextAnnotation.registerFieldFormatting]($backend) or defaulted from the iModel's
 * schemas. Holds only providers; every [FormatterSpec]($core-quantity) is built on demand by
 * [[lookupFieldSpec]] and discarded after the field is formatted. Building one costs on the order
 * of a microsecond, so nothing is cached.
 * @internal
 */
export interface FieldFormatting {
  /** Unit system used to select a KindOfQuantity's presentation format. */
  readonly unitSystem: UnitSystemKey;
  readonly schemaContext: SchemaContext;
  readonly unitsProvider: SyncUnitsProvider;
  /** The adopted FormatSet layered over the iModel's schema formats, or the schema formats alone. */
  readonly defaultFormats: SyncFormatsProvider;
  /** Per-field FormatSets by id, each falling through to [[defaultFormats]]. */
  readonly formatSets: ReadonlyMap<string, SyncFormatsProvider>;
}

/** Per-iModel [[FieldFormatting]], as configured by the last
 * [ElementDrivesTextAnnotation.registerFieldFormatting]($backend) call, or the schema-only default
 * created the first time one of the iModel's fields was evaluated. Weakly keyed so a closed iModel
 * takes its entry with it.
 */
const fieldFormattings = new WeakMap<IModelDb, FieldFormatting>();

/** Returns the formats `iModel`'s fields resolve through, creating the schema-only default on
 * first use.
 * @internal
 */
export function getFieldFormatting(iModel: IModelDb): FieldFormatting {
  let formatting = fieldFormattings.get(iModel);
  if (!formatting) {
    formatting = createFieldFormatting({ iModel });
    fieldFormattings.set(iModel, formatting);
  }

  return formatting;
}

/** Replaces the formats `iModel`'s fields resolve through.
 * @internal
 */
export function setFieldFormatting(iModel: IModelDb, formatting: FieldFormatting): void {
  fieldFormattings.set(iModel, formatting);
}

/** @internal */
export function createFieldFormatting(args: FieldFormattingArgs): FieldFormatting {
  // An adopted FormatSet declares the unit system it was authored for; honor it unless the
  // caller says otherwise.
  const unitSystem = args.unitSystem ?? args.formatSet?.unitSystem ?? "metric";
  const schemaContext = args.iModel.schemaContext;
  const schemaFormats = new SchemaFormatsProvider(schemaContext, unitSystem);
  // Every per-field FormatSet falls through to this same chain, so a field naming a FormatSet
  // that has no entry for its KindOfQuantity still sees the adopted presentation before the
  // schema's, matching the documented resolution order.
  const defaultFormats = args.formatSet ? new FormatSetFormatsProvider({ formatSet: args.formatSet, fallbackProvider: schemaFormats }) : schemaFormats;
  const formatSets = new Map<string, SyncFormatsProvider>();
  for (const { id, formatSet } of args.formatSets ?? []) {
    formatSets.set(id, new FormatSetFormatsProvider({ formatSet, fallbackProvider: defaultFormats }));
  }

  return { unitSystem, schemaContext, unitsProvider: new BasicUnitsProvider(), defaultFormats, formatSets };
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
 * @internal
 */
export function buildFieldFormatterSpec(args: FormattingSpecArgs, formatsProvider: SyncFormatsProvider, formatting: FieldFormatting): FormatterSpec | undefined {
  const { unitsProvider, schemaContext } = formatting;
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

/** Builds the (KindOfQuantity, persistence unit) pairs a quantity/coordinate FieldValue may
 * format through, in the priority order documented on [[QuantityFieldFormatOptions]].
 *
 * A pair needs both halves, so a property with no [KindOfQuantity]($ecschema-metadata)
 * contributes none. The property-side pair is also withheld when `overridePersistence` names a
 * different unit.
 * @internal
 */
export function collectFieldQuantityPairs(args: {
  overrideName?: string;
  overridePersistence?: string;
  propertyName?: string;
  propertyPersistence?: string;
}): FormattingSpecArgs[] {
  const { overrideName, overridePersistence, propertyName, propertyPersistence } = args;
  const effectiveName = overrideName ?? propertyName;
  const effectivePersistence = overridePersistence ?? propertyPersistence;

  // An override naming the same unit as the property contradicts nothing, so the fallback stands.
  // Neither does an absent or empty override.
  const contradictsProperty =
    overridePersistence !== undefined
    && overridePersistence !== ""
    && overridePersistence !== propertyPersistence;

  const pairs: FormattingSpecArgs[] = [];
  if (effectiveName && effectivePersistence) {
    pairs.push({ name: effectiveName, persistenceUnitName: effectivePersistence });
  }
  if (
    propertyName && propertyPersistence && !contradictsProperty &&
    (propertyName !== effectiveName || propertyPersistence !== effectivePersistence)
  ) {
    pairs.push({ name: propertyName, persistenceUnitName: propertyPersistence });
  }
  return pairs;
}

/** Builds the first [FormatterSpec]($core-quantity) that resolves for `value` among the formats
 * of the FormatSet named by `quantityOptions.formatSet` -- or the adopted FormatSet and schema
 * formats when it names none, or one that was never registered -- along with the pairs that were
 * tried, so the caller can report when none resolved.
 * @internal
 */
export function lookupFieldSpec(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: ResolvedFieldValue,
  formatting: FieldFormatting,
): { spec?: FormatterSpec, candidates: FormattingSpecArgs[] } {
  const candidates = collectFieldQuantityPairs({
    overrideName: quantityOptions?.kindOfQuantity,
    overridePersistence: quantityOptions?.persistenceUnit,
    propertyName: value.kindOfQuantityFullName,
    propertyPersistence: value.persistenceUnitFullName,
  });
  const formatSet = quantityOptions?.formatSet;
  const formats = (formatSet ? formatting.formatSets.get(formatSet) : undefined) ?? formatting.defaultFormats;
  for (const candidate of candidates) {
    const spec = buildFieldFormatterSpec(candidate, formats, formatting);
    if (spec) {
      return { spec, candidates };
    }
  }
  return { candidates };
}
