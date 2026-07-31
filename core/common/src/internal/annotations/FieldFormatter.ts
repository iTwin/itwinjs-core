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
  /** Full name (e.g. `"AecUnits.LENGTH"`) of the [KindOfQuantity]($ecschema-metadata)
   * associated with the resolved property, if any. Used by the runtime to look up a
   * default [Format]($core-quantity) when [[FieldFormatOptions.quantity]] does not
   * provide one.
   */
  kindOfQuantityFullName?: string;
  /** Full name (e.g. `"Units.M"`) of the persistence unit of the resolved property,
   * if resolvable from its [KindOfQuantity]($ecschema-metadata). Used as the source
   * unit when constructing a [FormatterSpec]($core-quantity).
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

/** Runtime context for [[formatFieldValueAsync]]. Provides the units and formats providers used to
 * resolve a [Format]($core-quantity) for "quantity" and "coordinate" field types, plus an optional
 * cache to avoid rebuilding a [FormatterSpec]($core-quantity) for repeated
 * (format source, persistence unit) combinations within a single formatting pass.
 * @internal
 */
export interface FieldFormatterContext {
  unitsProvider: UnitsProvider;
  formatsProvider: FormatsProvider;
  specCache?: Map<string, FormatterSpec>;
}

// Fallback FormatProps used by coordinate fields whose property has no KindOfQuantity.
// Assumes the value is stored in meters (BIS geometry persistence).
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

// Extracts the persistence unit's full name from an inline FormatProps by inspecting its composite.
function firstCompositeUnitName(formatProps: FormatProps): string | undefined {
  return formatProps.composite?.units?.[0]?.name;
}

// Resolves the FormatProps to use for a field, together with a stable cache key describing its source.
// Returns undefined if no format source is available.
async function resolveFormatSource(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
  context: FieldFormatterContext,
): Promise<{ formatProps: FormatProps, cacheKeySource: string } | undefined> {
  // 1. Inline FormatProps override.
  if (quantityOptions?.format) {
    return { formatProps: quantityOptions.format, cacheKeySource: `inline:${JSON.stringify(quantityOptions.format)}` };
  }

  // 2. Explicit format-set / KoQ override.
  if (quantityOptions?.kindOfQuantity) {
    const def = await context.formatsProvider.getFormat(quantityOptions.kindOfQuantity);
    if (def) {
      return { formatProps: def, cacheKeySource: `key:${quantityOptions.kindOfQuantity}` };
    }
  }

  // 3. Property's own KindOfQuantity.
  if (value.kindOfQuantityFullName) {
    const def = await context.formatsProvider.getFormat(value.kindOfQuantityFullName);
    if (def) {
      return { formatProps: def, cacheKeySource: `koq:${value.kindOfQuantityFullName}` };
    }
  }

  // 4. Coordinate fallback: assume length in meters.
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

/** Async counterpart to [[formatFieldValue]] that formats "quantity" and "coordinate" field values
 * using the standard iTwin.js quantity formatting pipeline.
 *
 * For any other [[FieldPropertyType]], or when a quantity/coordinate field cannot be resolved to a
 * [FormatterSpec]($core-quantity), `onMissingSpec` controls whether the function falls back to
 * [[formatFieldValue]] (default) or throws.
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
      throw missingSpecError(value, options, "no FormatProps could be resolved from the supplied FormatsProvider (the property's KindOfQuantity, the kindOfQuantity override, and the inline format override were all unavailable)");
    }
    return formatFieldValue(value, options);
  }

  try {
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
  } catch (err) {
    if (throwOnMiss) throw err;
    return formatFieldValue(value, options);
  }
}

// Minimal contract used by the synchronous formatting path: a lookup that returns an already-built
// FormatterSpec keyed by (KoQ name, persistence unit name), plus a formatting function.
// Duck-typed against `FormattingSpecProvider` in `@itwin/core-quantity` so this module can stay
// independent of that concrete type.
/** @internal */
export interface FieldFormattingSpecProvider {
  getSpecsByNameAndUnit(args: { name: string; persistenceUnitName: string }): { formatterSpec: FormatterSpec } | undefined;
  formatQuantity(magnitude: number, formatSpec: FormatterSpec): string;
}

/** Controls what happens when a `"quantity"` or `"coordinate"` [FieldRun]($common) cannot be
 * matched to a [FormatterSpec]($core-quantity):
 *
 * - `"fallback"` (default): silently fall back to the raw string representation used by
 *   [[formatFieldValue]].
 * - `"throw"`: throw an [[Error]] describing the missing spec.
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
  // Inline FormatProps overrides bypass the provider entirely; they require async construction.
  // Callers should therefore route inline-format fields through `formatFieldValueAsync` instead.
  if (quantityOptions?.format) {
    return undefined;
  }

  const name = quantityOptions?.kindOfQuantity ?? value.kindOfQuantityFullName;
  const persistenceUnitName = quantityOptions?.persistenceUnit ?? value.persistenceUnitFullName;
  if (!name || !persistenceUnitName) {
    return undefined;
  }

  return provider.getSpecsByNameAndUnit({ name, persistenceUnitName })?.formatterSpec;
}

/** Synchronous counterpart to [[formatFieldValueAsync]] that formats "quantity" and "coordinate"
 * field values via a caller-supplied [[FieldFormattingSpecProvider]] (typically a
 * [FormattingSpecProvider]($core-quantity)). Intended for use on the txn callback path where
 * the async pipeline cannot be awaited but the application has pre-built the required specs.
 *
 * For any other [[FieldPropertyType]], or when a quantity/coordinate field cannot be resolved
 * to a [FormatterSpec]($core-quantity) via `provider`, `onMissingSpec` controls whether the
 * function falls back to [[formatFieldValue]] (default) or throws.
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
      const reason = options?.quantity?.format
        ? "inline FormatProps overrides are not supported on the synchronous formatting path"
        : "the registered FormattingSpecProvider did not supply a spec for this KindOfQuantity / persistence unit";
      throw missingSpecError(value, options, reason);
    }
    return formatFieldValue(value, options);
  }

  let formatted: string | undefined;
  if (value.type === "quantity") {
    if (typeof value.value !== "number") {
      return formatFieldValue(value, options);
    }
    formatted = provider.formatQuantity(value.value, spec);
  } else {
    const magnitudes = getCoordinateMagnitudes(value.value);
    if (!magnitudes) {
      return formatFieldValue(value, options);
    }
    formatted = `(${magnitudes.map((m) => provider.formatQuantity(m, spec)).join(", ")})`;
  }

  return formatString(formatted, options);
}


