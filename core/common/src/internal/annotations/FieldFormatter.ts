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
 * resolve a [Format]($core-quantity) for `"quantity"` and `"coordinate"` fields, plus an optional
 * cache to avoid rebuilding a [FormatterSpec]($core-quantity) for repeated (format source,
 * persistence unit) pairs within a single pass.
 * @internal
 */
export interface FieldFormatterContext {
  unitsProvider: UnitsProvider;
  formatsProvider: FormatsProvider;
  specCache?: Map<string, FormatterSpec>;
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

// Resolves the FormatProps to use for a field and a stable cache key describing its source.
// Returns undefined if no format source is available.
async function resolveFormatSource(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
  context: FieldFormatterContext,
): Promise<{ formatProps: FormatProps, cacheKeySource: string } | undefined> {
  // 1. Explicit format-set / KoQ override.
  if (quantityOptions?.kindOfQuantity) {
    const def = await context.formatsProvider.getFormat(quantityOptions.kindOfQuantity);
    if (def) {
      return { formatProps: def, cacheKeySource: `key:${quantityOptions.kindOfQuantity}` };
    }
  }

  // 2. Property's own KindOfQuantity.
  if (value.kindOfQuantityFullName) {
    const def = await context.formatsProvider.getFormat(value.kindOfQuantityFullName);
    if (def) {
      return { formatProps: def, cacheKeySource: `koq:${value.kindOfQuantityFullName}` };
    }
  }

  // 3. Coordinate fallback: assume length in meters.
  if (value.type === "coordinate") {
    return { formatProps: defaultCoordinateFormatProps, cacheKeySource: "default:coordinate" };
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
  const source = await resolveFormatSource(quantityOptions, value, context);
  if (!source) {
    return undefined;
  }

  const persistenceUnitName = value.persistenceUnitFullName ?? firstCompositeUnitName(source.formatProps) ?? "";
  const cacheKey = `${source.cacheKeySource}|${persistenceUnitName}`;

  const cached = context.specCache?.get(cacheKey);
  if (cached) {
    return cached;
  }

  const format = await Format.createFromJSON("fieldFormat", context.unitsProvider, source.formatProps);
  const persistenceUnit = await resolvePersistenceUnit(value, source.formatProps, context);
  const spec = await FormatterSpec.create("fieldFormat", format, context.unitsProvider, persistenceUnit);
  context.specCache?.set(cacheKey, spec);
  return spec;
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
  onMissingSpec: FieldMissingSpecBehavior,
): string | undefined {
  let formatted: string | undefined;
  if (value.type === "quantity") {
    if (typeof value.value !== "number") {
      if (onMissingSpec === "throw") {
        throw missingSpecError(value, options, `expected a numeric quantity value, got ${typeof value.value}`);
      }
      return formatFieldValue(value, options);
    }
    formatted = spec.applyFormatting(value.value);
  } else {
    const magnitudes = getCoordinateMagnitudes(value.value);
    if (!magnitudes) {
      if (onMissingSpec === "throw") {
        throw missingSpecError(value, options, "coordinate value is missing x/y magnitudes");
      }
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
 * a [FormatterSpec]($core-quantity), `onMissingSpec` controls whether the function falls back
 * to [[formatFieldValue]] (default) or throws.
 * @internal
 */
export async function formatFieldValueAsync(
  value: FieldValue,
  options: FieldFormatOptions | undefined,
  context: FieldFormatterContext,
  onMissingSpec: FieldMissingSpecBehavior = "fallback",
): Promise<string | undefined> {
  if (value.type !== "quantity" && value.type !== "coordinate") {
    return formatFieldValue(value, options);
  }

  const throwOnMiss = onMissingSpec === "throw";

  let spec: FormatterSpec | undefined;
  try {
    spec = await getFormatterSpec(options?.quantity, value, context);
  } catch (err) {
    if (throwOnMiss) throw err;
    return formatFieldValue(value, options);
  }

  if (!spec) {
    if (throwOnMiss) {
      throw missingSpecError(value, options, "no FormatProps could be resolved from the supplied FormatsProvider (the property's KindOfQuantity and the kindOfQuantity override were both unavailable)");
    }
    return formatFieldValue(value, options);
  }

  try {
    return applySpecToFieldValue(value, options, spec, onMissingSpec);
  } catch (err) {
    if (throwOnMiss) throw err;
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

/** Behavior when a `"quantity"` or `"coordinate"` [FieldRun]($common) cannot be matched to a
 * [FormatterSpec]($core-quantity):
 *  - `"fallback"` (default): silently use the raw string representation from [[formatFieldValue]].
 *  - `"throw"`: throw an [[Error]] describing the missing spec.
 * @internal
 */
export type FieldMissingSpecBehavior = "fallback" | "throw";

function missingSpecError(value: FieldValue, options: FieldFormatOptions | undefined, reason: string): Error {
  const koq = options?.quantity?.kindOfQuantity ?? value.kindOfQuantityFullName ?? "<unknown>";
  const unit = options?.quantity?.persistenceUnit ?? value.persistenceUnitFullName ?? "<unknown>";
  return new Error(`No FormatterSpec available for field (type=${value.type}, koq=${koq}, persistenceUnit=${unit}): ${reason}`);
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
  onMissingSpec?: FieldMissingSpecBehavior;
}

/** Cascading lookup used by the sync formatting path to pick a registered
 * [FieldFormattingSpecProvider]($common) for a given [FieldRun]($common). Callers (typically
 * the backend) construct one over their per-iModel provider registry and hand it to
 * [[formatFieldValueWithSpecResolver]] via [[UpdateFieldsContext]].
 *
 * Implementations encapsulate the cascading behavior:
 *  1. If `formatSet` is defined, return the provider registered under it.
 *  2. Otherwise (or if `formatSet` has no match), return the iModel-level default registration.
 *  3. Return `undefined` when no registration matches; callers then fall back to the raw string
 *     representation.
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
 * [FormatterSpec]($core-quantity) via `provider`, `onMissingSpec` controls whether the function
 * falls back to [[formatFieldValue]] (default) or throws.
 * @internal
 */
export function formatFieldValueWithSpecProvider(
  value: FieldValue,
  options: FieldFormatOptions | undefined,
  provider: FieldFormattingSpecProvider,
  onMissingSpec: FieldMissingSpecBehavior = "fallback",
): string | undefined {
  if (value.type !== "quantity" && value.type !== "coordinate") {
    return formatFieldValue(value, options);
  }

  const spec = lookupSyncSpec(options?.quantity, value, provider);
  if (!spec) {
    if (onMissingSpec === "throw") {
      throw missingSpecError(value, options, "the registered FormattingSpecProvider did not supply a spec for this KindOfQuantity / persistence unit");
    }
    return formatFieldValue(value, options);
  }

  return applySpecToFieldValue(value, options, spec, onMissingSpec);
}

/** Synchronous formatting entry point that consults a [[FieldFormattingSpecResolver]] to pick
 * which registered provider (keyed by [QuantityFieldFormatOptions.formatSet]($common)) formats
 * `value`, then delegates to [[formatFieldValueWithSpecProvider]] using that provider and its
 * `onMissingSpec` policy.
 *
 * If the resolver returns `undefined` (no matching registration and no iModel-level default),
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

  return formatFieldValueWithSpecProvider(value, options, resolved.provider, resolved.onMissingSpec);
}


