/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { Format, FormatProps, FormatsProvider, FormatterSpec, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import { DateTimeFieldFormatOptions, FieldFormatOptions, FieldPropertyType, QuantityFieldFormatOptions } from "../../annotation/TextField";

/** A FieldPropertyPath must ultimately resolve to one of these primitive types.
 * @internal
 */
export type FieldPrimitiveValue = boolean | number | string | Date | XAndY | XYAndZ | Uint8Array;

/** Resolved value of a field.
 * @internal
 */
export interface FieldValue {
  value: FieldPrimitiveValue;
  type: FieldPropertyType;
  /** Full name (e.g. `"AecUnits.LENGTH"`) of the resolved property's
   * [KindOfQuantity]($ecschema-metadata), if any. Used to look up a default
   * [Format]($core-quantity) when [[FieldFormatOptions.quantity]] does not provide one.
   */
  kindOfQuantityFullName?: string;
  /** Full name (e.g. `"Units.M"`) of the persistence unit of the resolved property, if
   * derivable from its [KindOfQuantity]($ecschema-metadata). Used as the source unit when
   * constructing a [FormatterSpec]($core-quantity).
   */
  persistenceUnitFullName?: string;
}

type FieldFormatter = (value: FieldPrimitiveValue, options: FieldFormatOptions | undefined) => string | undefined;

const formatters: { [type: string]: FieldFormatter | undefined } = {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  "string": (v, o) => formatString(v.toString(), o),

  "datetime": (v, o) => formatString(formatDateTime(v, o?.dateTime), o),

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  "quantity": (v, o) => formatString(v.toString(), o),

  "coordinate": (v, o) => formatString(formatPointBasic(v), o),
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  "boolean": (v, o) => formatString(v.toString(), o),
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  "int-enum": (v, o) => formatString(v.toString(), o),
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  "string-enum": (v, o) => formatString(v.toString(), o),
};

function formatString(s: string | undefined, o?: FieldFormatOptions): string | undefined {
  if (undefined === s || !o) {
    return s;
  }

  switch (o.case) {
    case "upper":
      s = s.toUpperCase();
      break;
    case "lower":
      s = s.toLowerCase();
      break;
  }

  if (o.prefix || o.suffix) {
    s = `${o.prefix ?? ""}${s}${o.suffix ?? ""}`;
  }

  return s;
}

function formatDateTime(v: FieldPrimitiveValue, o?: DateTimeFieldFormatOptions): string | undefined {
  if (!(v instanceof Date))
    return undefined;

  if (!isNaN(v.getTime())) {
    if (o?.formatOptions) {
      const locale = o.locale ?? "en-US";
      if (!Intl.DateTimeFormat.supportedLocalesOf([locale], { localeMatcher: "lookup" }).includes(locale)) {
        return undefined;
      }

      const formatter = new Intl.DateTimeFormat(locale, o.formatOptions);
      return formatter.format(v);
    }
    return v.toString();
  }
  return undefined;
}

// ###TODO replace this with actual quantity coordinate formatting.
function formatPointBasic(v: FieldPrimitiveValue): string | undefined {
  if (typeof v === "object" && "x" in v && "y" in v) {
    const parts = [v.x, v.y];
    const z = (v as any).z;
    if (undefined !== z) {
      parts.push(z);
    }

    return `(${parts.join(", ")})`;
  }

  return undefined;
}

/** @internal */
export function formatFieldValue(value: FieldValue, options: FieldFormatOptions | undefined): string | undefined {
  const formatter = formatters[value.type];
  return formatter ? formatter(value.value, options) : undefined;
}

/** @internal */
export function isKnownFieldPropertyType(type: string): type is FieldPropertyType {
  return type in formatters;
}

/** Runtime context for [[formatFieldValueAsync]]. Supplies the units/formats providers used to
 * resolve a [Format]($core-quantity) for `"quantity"` and `"coordinate"` fields.
 * @internal
 */
export interface FieldFormatterContext {
  unitsProvider: UnitsProvider;
  formatsProvider: FormatsProvider;
}

// Fallback FormatProps for coordinate fields whose property has no KindOfQuantity. Assumes the
// value is stored in meters (BIS geometry persistence).
const defaultCoordinateFormatProps: FormatProps = {
  formatTraits: ["keepSingleZero", "showUnitLabel"],
  precision: 4,
  type: "Decimal",
  uomSeparator: " ",
  decimalSeparator: ".",
  composite: {
    units: [{ label: "m", name: "Units.M" }],
  },
};

// Extracts the persistence unit's full name from a FormatProps by inspecting its composite.
function firstCompositeUnitName(formatProps: FormatProps): string | undefined {
  return formatProps.composite?.units?.[0]?.name;
}

// Resolves the FormatProps to use for a field. Returns undefined if no format source is available.
async function resolveFormatSource(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
  context: FieldFormatterContext,
): Promise<FormatProps | undefined> {
  // 1. Explicit format-set / KoQ override.
  if (quantityOptions?.kindOfQuantity) {
    const def = await context.formatsProvider.getFormat(quantityOptions.kindOfQuantity);
    if (def) {
      return def;
    }
  }

  // 2. Property's own KindOfQuantity.
  if (value.kindOfQuantityFullName) {
    const def = await context.formatsProvider.getFormat(value.kindOfQuantityFullName);
    if (def) {
      return def;
    }
  }

  // 3. Coordinate fallback: assume length in meters.
  if (value.type === "coordinate") {
    return defaultCoordinateFormatProps;
  }

  return undefined;
}

async function resolvePersistenceUnit(
  value: FieldValue,
  formatProps: FormatProps,
  context: FieldFormatterContext,
): Promise<UnitProps | undefined> {
  const unitName = value.persistenceUnitFullName ?? firstCompositeUnitName(formatProps);
  if (!unitName) {
    return undefined;
  }

  try {
    return await context.unitsProvider.findUnitByName(unitName);
  } catch {
    return undefined;
  }
}

async function getFormatterSpec(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
  context: FieldFormatterContext,
): Promise<FormatterSpec | undefined> {
  const formatProps = await resolveFormatSource(quantityOptions, value, context);
  if (!formatProps) {
    return undefined;
  }

  const format = await Format.createFromJSON("fieldFormat", context.unitsProvider, formatProps);
  const persistenceUnit = await resolvePersistenceUnit(value, formatProps, context);
  return FormatterSpec.create("fieldFormat", format, context.unitsProvider, persistenceUnit);
}

function getCoordinateMagnitudes(v: FieldPrimitiveValue): number[] | undefined {
  if (typeof v !== "object" || !("x" in v) || !("y" in v)) {
    return undefined;
  }
  const parts = [v.x, v.y];
  const z = (v as any).z;
  if (undefined !== z) {
    parts.push(z);
  }
  return parts;
}

// Applies a pre-resolved FormatterSpec to a quantity or coordinate FieldValue and wraps the
// result with prefix/suffix/case. Shared by both the async and sync spec-based paths.
function applySpecToFieldValue(
  value: FieldValue,
  options: FieldFormatOptions | undefined,
  spec: FormatterSpec,
): string | undefined {
  let formatted: string | undefined;
  if (value.type === "quantity") {
    if (typeof value.value !== "number") {
      return formatFieldValue(value, options);
    }
    formatted = spec.applyFormatting(value.value);
  } else {
    const magnitudes = getCoordinateMagnitudes(value.value);
    if (!magnitudes) {
      return formatFieldValue(value, options);
    }
    formatted = `(${magnitudes.map((m) => spec.applyFormatting(m)).join(", ")})`;
  }
  return formatString(formatted, options);
}

/** Async counterpart to [[formatFieldValue]] that formats `"quantity"` and `"coordinate"`
 * values through the standard iTwin.js quantity formatting pipeline.
 *
 * For other [[FieldPropertyType]]s, or when a quantity/coordinate field cannot be resolved to
 * a [FormatterSpec]($core-quantity), falls back to [[formatFieldValue]].
 * @internal
 */
export async function formatFieldValueAsync(
  value: FieldValue,
  options: FieldFormatOptions | undefined,
  context: FieldFormatterContext,
): Promise<string | undefined> {
  if (value.type !== "quantity" && value.type !== "coordinate") {
    return formatFieldValue(value, options);
  }

  let spec: FormatterSpec | undefined;
  try {
    spec = await getFormatterSpec(options?.quantity, value, context);
  } catch {
    return formatFieldValue(value, options);
  }

  if (!spec) {
    return formatFieldValue(value, options);
  }

  try {
    return applySpecToFieldValue(value, options, spec);
  } catch {
    return formatFieldValue(value, options);
  }
}

// Minimal contract used by the sync formatting path: an already-built FormatterSpec lookup keyed
// by (KoQ name, persistence unit name). Duck-typed against `FormattingSpecProvider` in
// `@itwin/core-quantity` so this module stays independent of it. `FormatterSpec.applyFormatting`
// is used directly to render magnitudes, so no `formatQuantity` method is required.
/** @internal */
export interface FieldFormattingSpecProvider {
  getSpecsByNameAndUnit(args: { name: string; persistenceUnitName: string }): { formatterSpec: FormatterSpec } | undefined;
}

function lookupSyncSpec(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
  provider: FieldFormattingSpecProvider,
): FormatterSpec | undefined {
  const name = quantityOptions?.kindOfQuantity ?? value.kindOfQuantityFullName;
  const persistenceUnitName = quantityOptions?.persistenceUnit ?? value.persistenceUnitFullName;
  if (!name || !persistenceUnitName) {
    return undefined;
  }

  return provider.getSpecsByNameAndUnit({ name, persistenceUnitName })?.formatterSpec;
}

/** Result of [[FieldFormattingSpecResolver.resolve]] describing which registered synchronous
 * provider should handle a given [FieldRun]($common).
 * @internal
 */
export interface ResolvedFieldFormattingSpecProvider {
  provider: FieldFormattingSpecProvider;
}


/** Lookup used by the sync formatting path to pick a registered
 * [FieldFormattingSpecProvider]($common) for a given [FieldRun]($common). Callers (typically
 * the backend) construct one over their process-wide provider registry and hand it to
 * [[formatFieldValueWithSpecResolver]] via [[UpdateFieldsContext]].
 *
 * Implementations return the provider registered under `formatSet`, or `undefined` when
 * `formatSet` is not defined or no registration matches; callers then fall back to the raw
 * string representation.
 * @internal
 */
export interface FieldFormattingSpecResolver {
  resolve(formatSet: string | undefined): ResolvedFieldFormattingSpecProvider | undefined;
}

/** Synchronous counterpart to [[formatFieldValueAsync]] that formats `"quantity"` and
 * `"coordinate"` values via a caller-supplied [[FieldFormattingSpecProvider]] (typically a
 * [FormattingSpecProvider]($core-quantity)). Intended for the txn callback path, where the async
 * pipeline cannot be awaited but the app has pre-built the required specs.
 *
 * For other [[FieldPropertyType]]s, or when a quantity/coordinate field cannot be resolved to a
 * [FormatterSpec]($core-quantity) via `provider`, falls back to [[formatFieldValue]].
 * @internal
 */
export function formatFieldValueWithSpecProvider(
  value: FieldValue,
  options: FieldFormatOptions | undefined,
  provider: FieldFormattingSpecProvider,
): string | undefined {
  if (value.type !== "quantity" && value.type !== "coordinate") {
    return formatFieldValue(value, options);
  }

  const spec = lookupSyncSpec(options?.quantity, value, provider);
  if (!spec) {
    return formatFieldValue(value, options);
  }

  return applySpecToFieldValue(value, options, spec);
}

/** Synchronous formatting entry point that consults a [[FieldFormattingSpecResolver]] to pick
 * which registered provider (keyed by [QuantityFieldFormatOptions.formatSet]($common)) formats
 * `value`, then delegates to [[formatFieldValueWithSpecProvider]] using that provider.
 *
 * If the resolver returns `undefined` (no matching registration for the field's `formatSet`),
 * quantity/coordinate values fall back to the raw string representation from [[formatFieldValue]].
 * @internal
 */
export function formatFieldValueWithSpecResolver(
  value: FieldValue,
  options: FieldFormatOptions | undefined,
  resolver: FieldFormattingSpecResolver,
): string | undefined {
  if (value.type !== "quantity" && value.type !== "coordinate") {
    return formatFieldValue(value, options);
  }

  const resolved = resolver.resolve(options?.quantity?.formatSet);
  if (!resolved) {
    return formatFieldValue(value, options);
  }

  return formatFieldValueWithSpecProvider(value, options, resolved.provider);
}
