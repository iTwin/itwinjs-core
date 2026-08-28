/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { FormatterSpec, FormattingSpecArgs } from "@itwin/core-quantity";
import { DateTimeFieldFormatOptions, FieldFormatOptions, FieldPropertyType, QuantityFieldFormatOptions } from "../../annotation/TextField";

/** A FieldPropertyPath must ultimately resolve to one of these primitive types.
 * @internal
 */
export type FieldPrimitiveValue = boolean | number | string | Date | XAndY | XYAndZ | Uint8Array;

/** Resolved value of a field.
 * @internal
 */
export interface FieldValue {
  /** The raw property value, typed by [[type]]. For structured or array properties, this is
   * the primitive scalar the [FieldRun]($common)'s propertyPath ultimately resolved to.
   */
  value: FieldPrimitiveValue;
  /** How [[value]] should be formatted; drives the per-type branch in [[formatFieldValue]].
   * `"quantity"` and `"coordinate"` route through the KoQ / units pipeline on
   * [[formatFieldValueWithSpecProvider]]; the [[formatFieldValue]] fallback stringifies them.
   */
  type: FieldPropertyType;
  /** Property-side [KindOfQuantity]($ecschema-metadata) full name (e.g. `"AecUnits.LENGTH"`),
   * if any. Consulted as the property-side fallback candidate when
   * [[QuantityFieldFormatOptions.kindOfQuantity]] is unset, or when the override's pair has no
   * pre-warmed [FormatterSpec]($core-quantity) — see [[collectFieldQuantityPairs]].
   */
  kindOfQuantityFullName?: string;
  /** Property-side persistence-unit full name (e.g. `"Units.M"`), if derivable from the
   * property's [KindOfQuantity]($ecschema-metadata). Paired with [[kindOfQuantityFullName]]
   * as the property-side candidate; used as the source unit when constructing the winning
   * [FormatterSpec]($core-quantity).
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

/** Raw coordinate fallback rendered as `(x, y[, z])` with no unit labels, used when the
 * (KoQ, persistence unit) pair resolution in `lookupSyncSpec` misses. Core deliberately does not carry a built-in coordinate format —
 * presentation is a [FormatsProvider]($core-quantity) / FormatSet concern; see
 * [[QuantityFieldFormatOptions]] for the priority contract.
 */
function formatPointBasic(v: FieldPrimitiveValue): string | undefined {
  const magnitudes = getCoordinateMagnitudes(v);
  return magnitudes ? `(${magnitudes.join(", ")})` : undefined;
}

/** Formats `value` through the per-type entry in the built-in formatter table (see [[formatters]]),
 * wrapping the result with prefix/suffix/case. Quantity/coordinate values fall through to their
 * raw string representation on this path — use [[formatFieldValueWithSpecProvider]] for the
 * KoQ / units pipeline.
 * @internal
 */
export function formatFieldValue(value: FieldValue, options: FieldFormatOptions | undefined): string | undefined {
  const formatter = formatters[value.type];
  return formatter ? formatter(value.value, options) : undefined;
}

/** Type guard for [[FieldPropertyType]] strings that have a built-in per-type formatter.
 * @internal
 */
export function isKnownFieldPropertyType(type: string): type is FieldPropertyType {
  return type in formatters;
}

/** Builds the ordered list of (KoQ name, persistence unit) pairs — expressed as
 * [FormattingSpecArgs]($core-quantity) — that a quantity/coordinate FieldValue should be
 * formatted through. See [[QuantityFieldFormatOptions]] for the priority contract; a
 * candidate is emitted only when both name and persistence unit are defined, so a coordinate
 * property with no [KindOfQuantity]($ecschema-metadata) contributes no property-side pair.
 *
 * The property-side pair is additionally withheld when `overridePersistence` names a *different*
 * unit than `propertyPersistence`. An explicit persistence-unit override is a claim about what
 * the stored magnitude means, so the property's own unit is not a legal fallback for it —
 * formatting through it would silently render a value off by the conversion factor. Falling back
 * across a `kindOfQuantity`-only override is safe by comparison, since that changes presentation
 * rather than meaning.
 *
 * Shared by the runtime formatter path (`lookupSyncSpec`) and by `collectFieldRequirements` in
 * `core-backend`'s `fields.ts` (via `cross-package.ts`), so pre-warm enumerates exactly the
 * candidates the runtime iterates.
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

  // An override that merely restates the property's unit still permits the fallback: it makes no
  // claim the property side contradicts. An empty string is not a claim either -- `??` above does
  // not treat it as absent, so it is checked for truthiness rather than for `undefined`.
  const contradictsProperty = !!overridePersistence && overridePersistence !== propertyPersistence;

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

/** The `x`, `y` and (when present) `z` components of a coordinate value, or `undefined` if `v` is
 * not one. Shared by both coordinate paths — the raw [[formatPointBasic]] fallback and the
 * spec-driven [[applySpecToFieldValue]] — so the two cannot disagree about what counts as a
 * coordinate or about whether a point carries a `z`.
 */
function getCoordinateMagnitudes(v: FieldPrimitiveValue): number[] | undefined {
  if (typeof v !== "object" || !("x" in v) || !("y" in v)) {
    return undefined;
  }
  const parts = [v.x, v.y];
  const z = "z" in v ? v.z : undefined;
  if (undefined !== z) {
    parts.push(z);
  }
  return parts;
}

/** Renders a quantity or coordinate [[FieldValue]] with `formatMagnitude` and wraps the result
 * with prefix/suffix/case. Coordinates render each component and join them as `(x, y[, z])`.
 *
 * Callers route `formatMagnitude` through [[FieldSpecProvider.formatQuantity]] rather than
 * [FormatterSpec.applyFormatting]($core-quantity) directly so that the provider owns the
 * application of the spec; this function only decides which magnitudes to feed it and how to
 * assemble the result.
 */
function applySpecToFieldValue(
  value: FieldValue,
  options: FieldFormatOptions | undefined,
  formatMagnitude: (magnitude: number) => string,
): string | undefined {
  let formatted: string | undefined;
  if (value.type === "quantity") {
    if (typeof value.value !== "number") {
      return formatFieldValue(value, options);
    }
    formatted = formatMagnitude(value.value);
  } else {
    const magnitudes = getCoordinateMagnitudes(value.value);
    if (!magnitudes) {
      return formatFieldValue(value, options);
    }
    formatted = `(${magnitudes.map((m) => formatMagnitude(m)).join(", ")})`;
  }
  return formatString(formatted, options);
}

/** The provider capability that synchronous field evaluation needs: look up an
 * already-warmed [FormatterSpec]($core-quantity), and format a magnitude through it.
 *
 * Deliberately narrower than [FormattingSpecProvider]($core-quantity), whose
 * [FormattingSpecEntry]($core-quantity) also carries a [ParserSpec]($core-quantity) — nothing on
 * this path parses, so a provider built solely to format fields need not produce one.
 * @internal
 */
export interface FieldSpecProvider {
  /** Returns the pre-warmed spec for `args`, or `undefined` if it was never warmed. */
  getFormatterSpec(args: FormattingSpecArgs): FormatterSpec | undefined;
  /** Applies `formatSpec` to `magnitude`. */
  formatQuantity(magnitude: number, formatSpec: FormatterSpec): string;
}

/** Looks up an already-warmed [FormatterSpec]($core-quantity) for `value` from `provider`,
 * walking the shared [[collectFieldQuantityPairs]] candidates in priority order so that
 * evaluation consults exactly the requirements pre-warm produced.
 *
 * Returns the candidates alongside the spec so the caller can report a genuine shortfall: a
 * miss on the first candidate is not a failure if a later one resolves.
 */
function lookupSyncSpec(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
  provider: FieldSpecProvider,
): { spec?: FormatterSpec, candidates: FormattingSpecArgs[] } {
  const candidates = collectFieldQuantityPairs({
    overrideName: quantityOptions?.kindOfQuantity,
    overridePersistence: quantityOptions?.persistenceUnit,
    propertyName: value.kindOfQuantityFullName,
    propertyPersistence: value.persistenceUnitFullName,
  });
  for (const candidate of candidates) {
    const spec = provider.getFormatterSpec(candidate);
    if (spec) {
      return { spec, candidates };
    }
  }
  return { candidates };
}

/** Formats `"quantity"` and `"coordinate"` values via a caller-supplied [[FieldSpecProvider]]
 * whose [FormatterSpec]($core-quantity)s were resolved ahead of time. This is what keeps field
 * evaluation synchronous on the txn-callback path, which cannot await.
 *
 * Callers routing by [QuantityFieldFormatOptions.formatSet]($common) are expected to select the
 * matching provider before calling this function.
 *
 * Falls back to [[formatFieldValue]] for other [[FieldPropertyType]]s or when no
 * [FormatterSpec]($core-quantity) matches. `onUnresolved` is invoked in that latter case — and
 * only when the value actually had candidates to try — so the caller can record a pre-warm
 * shortfall. A field whose property carries no [KindOfQuantity]($ecschema-metadata) yields no
 * candidates and is therefore not reported: it is unformattable by design, not under-warmed.
 * @internal
 */
export function formatFieldValueWithSpecProvider(
  value: FieldValue,
  options: FieldFormatOptions | undefined,
  provider: FieldSpecProvider,
  onUnresolved?: (candidates: FormattingSpecArgs[]) => void,
): string | undefined {
  if (value.type !== "quantity" && value.type !== "coordinate") {
    return formatFieldValue(value, options);
  }

  const { spec, candidates } = lookupSyncSpec(options?.quantity, value, provider);
  if (!spec) {
    if (candidates.length > 0) {
      onUnresolved?.(candidates);
    }
    return formatFieldValue(value, options);
  }

  return applySpecToFieldValue(value, options, (m) => provider.formatQuantity(m, spec));
}
