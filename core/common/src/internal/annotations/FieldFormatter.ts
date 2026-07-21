/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { Format, FormatProps, FormatsProvider, FormatterSpec, UnitProps, UnitsProvider, UnitSystemKey } from "@itwin/core-quantity";
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
 * (format source, persistence unit, unit system) combinations within a single formatting pass.
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

  const unitSystem = quantityOptions?.unitSystem;

  // 2. Explicit format-set / KoQ override.
  if (quantityOptions?.formatSetKey) {
    const def = await context.formatsProvider.getFormat(quantityOptions.formatSetKey, unitSystem);
    if (def) {
      return { formatProps: def, cacheKeySource: `key:${quantityOptions.formatSetKey}` };
    }
  }

  // 3. Property's own KindOfQuantity.
  if (value.kindOfQuantityFullName) {
    const def = await context.formatsProvider.getFormat(value.kindOfQuantityFullName, unitSystem);
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
  const unitSystemKey = quantityOptions?.unitSystem ?? "";
  const cacheKey = `${source.cacheKeySource}|${persistenceUnitName}|${unitSystemKey}`;

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
 * [FormatterSpec]($core-quantity), falls back to [[formatFieldValue]].
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

  try {
    const spec = await getFormatterSpec(options?.quantity, value, context);
    if (!spec) {
      return formatFieldValue(value, options);
    }

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
  } catch {
    return formatFieldValue(value, options);
  }
}

