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

// A single (KindOfQuantity name, persistence unit name) pair that `getFormatterSpec` will try
// to resolve into a FormatterSpec. Each candidate may either supply a KoQ name to look up via
// the FormatsProvider, or an inline FormatProps (used for the coordinate default fallback).
interface FormatterSpecCandidate {
  name?: string;
  formatProps?: FormatProps;
  persistenceUnitName: string;
}

// Enumerates the candidates the formatter should try, in order of preference:
//   1. The effective override pair: `formatOptions.quantity.{kindOfQuantity, persistenceUnit}`
//      per-dimension, falling back to the property's own KoQ + persistence unit when the
//      corresponding override is unset.
//   2. The property-side pair on its own, if it differs from #1. This is the "the override
//      didn't resolve; fall back to what's on the EC value" path — it lets callers pin a
//      preferred FormatSet KoQ without losing rendering when that FormatSet isn't loaded.
//   3. For coordinate fields, a built-in meters fallback so BIS geometry always renders.
function collectFormatterSpecCandidates(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
): FormatterSpecCandidate[] {
  const propertyName = value.kindOfQuantityFullName;
  const propertyPersistence = value.persistenceUnitFullName;
  const effectiveName = quantityOptions?.kindOfQuantity ?? propertyName;
  const effectivePersistence = quantityOptions?.persistenceUnit ?? propertyPersistence;

  const candidates: FormatterSpecCandidate[] = [];
  if (effectiveName && effectivePersistence) {
    candidates.push({ name: effectiveName, persistenceUnitName: effectivePersistence });
  }
  if (
    propertyName && propertyPersistence &&
    (propertyName !== effectiveName || propertyPersistence !== effectivePersistence)
  ) {
    candidates.push({ name: propertyName, persistenceUnitName: propertyPersistence });
  }
  if (value.type === "coordinate") {
    candidates.push({ formatProps: defaultCoordinateFormatProps, persistenceUnitName: "Units.M" });
  }
  return candidates;
}

async function getFormatterSpec(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
  context: FieldFormatterContext,
): Promise<FormatterSpec | undefined> {
  for (const candidate of collectFormatterSpecCandidates(quantityOptions, value)) {
    const formatProps = candidate.formatProps
      ?? (candidate.name ? await context.formatsProvider.getFormat(candidate.name) : undefined);
    if (!formatProps) {
      continue;
    }

    let persistenceUnit: UnitProps | undefined;
    try {
      persistenceUnit = await context.unitsProvider.findUnitByName(candidate.persistenceUnitName);
    } catch {
      // Try the next candidate.
    }
    if (!persistenceUnit) {
      continue;
    }

    const format = await Format.createFromJSON("fieldFormat", context.unitsProvider, formatProps);
    return FormatterSpec.create("fieldFormat", format, context.unitsProvider, persistenceUnit);
  }
  return undefined;
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

// Looks up an already-warmed FormatterSpec for `value` from `provider`. Tries the effective
// override pair first (per-dimension `override ?? property`), then the property-side pair when
// it differs — matching the async path so a missing FormatSet entry falls back cleanly to the
// property's own KoQ instead of dropping to raw output.
function lookupSyncSpec(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
  provider: FieldFormattingSpecProvider,
): FormatterSpec | undefined {
  const propertyName = value.kindOfQuantityFullName;
  const propertyPersistence = value.persistenceUnitFullName;
  const effectiveName = quantityOptions?.kindOfQuantity ?? propertyName;
  const effectivePersistence = quantityOptions?.persistenceUnit ?? propertyPersistence;

  if (effectiveName && effectivePersistence) {
    const spec = provider.getSpecsByNameAndUnit({
      name: effectiveName,
      persistenceUnitName: effectivePersistence,
    })?.formatterSpec;
    if (spec) {
      return spec;
    }
  }
  if (
    propertyName && propertyPersistence &&
    (propertyName !== effectiveName || propertyPersistence !== effectivePersistence)
  ) {
    const spec = provider.getSpecsByNameAndUnit({
      name: propertyName,
      persistenceUnitName: propertyPersistence,
    })?.formatterSpec;
    if (spec) {
      return spec;
    }
  }
  return undefined;
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
