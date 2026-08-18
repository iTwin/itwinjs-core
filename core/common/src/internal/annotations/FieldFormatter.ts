/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { Format, FormatsProviderSync, FormatterSpec, FormattingSpecArgs, FormattingSpecProvider, UnitProps, UnitsProviderSync } from "@itwin/core-quantity";
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
  /** How [[value]] should be formatted; drives the per-type branch in [[formatFieldValue]] /
   * [[formatFieldValueSync]]. `"quantity"` and `"coordinate"` route through the KoQ / units
   * pipeline on [[formatFieldValueSync]]; the [[formatFieldValue]] fallback stringifies them.
   */
  type: FieldPropertyType;
  /** Property-side [KindOfQuantity]($ecschema-metadata) full name (e.g. `"AecUnits.LENGTH"`),
   * if any. Consulted as the property-side fallback candidate when
   * [[QuantityFieldFormatOptions.kindOfQuantity]] is unset or does not resolve in the active
   * [FormatsProvider]($core-quantity) — see [[collectFieldQuantityPairs]].
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
 * (KoQ, persistence unit) pair resolution in `lookupSyncSpec` /
 * `getFormatterSpecSync` misses. Core deliberately does not carry a built-in coordinate format —
 * presentation is a [FormatsProvider]($core-quantity) / FormatSet concern; see
 * [[QuantityFieldFormatOptions]] for the priority contract.
 */
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

/** Formats `value` through the per-type entry in the built-in formatter table (see [[formatters]]),
 * wrapping the result with prefix/suffix/case. Quantity/coordinate values fall through to their
 * raw string representation on this path — use [[formatFieldValueSync]] for the KoQ / units
 * pipeline.
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

/** Runtime context consumed by [[formatFieldValueSync]] to construct a
 * [FormatterSpec]($core-quantity) on demand for `"quantity"` and `"coordinate"` fields.
 * Both providers must resolve from already-loaded state (e.g. a warmed-up
 * [BasicUnitsProvider]($core-quantity) and a [SchemaFormatsProvider]($ecschema-metadata) over
 * a synchronous schema locater).
 * @internal
 */
export interface FieldFormatterContextSync {
  /** Synchronous resolver for [UnitProps]($core-quantity) and unit conversions. */
  unitsProvider: UnitsProviderSync;
  /** Synchronous resolver of [FormatProps]($core-quantity) by KindOfQuantity full name. */
  formatsProvider: FormatsProviderSync;
}

/** Builds the ordered list of (KoQ name, persistence unit) pairs — expressed as
 * [FormattingSpecArgs]($core-quantity) — that a quantity/coordinate FieldValue should be
 * formatted through. See [[QuantityFieldFormatOptions]] for the priority contract; a
 * candidate is emitted only when both name and persistence unit are defined, so a coordinate
 * property with no [KindOfQuantity]($ecschema-metadata) contributes no property-side pair.
 *
 * Shared by both synchronous spec-resolution paths (`lookupSyncSpec` for pre-warmed specs and
 * `getFormatterSpecSync` for on-demand construction) and by `computeFieldFormattingRequirement`
 * in `core-backend`'s `fields.ts` (via `cross-package.ts`), so pre-warm enumerates the same
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

  const pairs: FormattingSpecArgs[] = [];
  if (effectiveName && effectivePersistence) {
    pairs.push({ name: effectiveName, persistenceUnitName: effectivePersistence });
  }
  if (
    propertyName && propertyPersistence &&
    (propertyName !== effectiveName || propertyPersistence !== effectivePersistence)
  ) {
    pairs.push({ name: propertyName, persistenceUnitName: propertyPersistence });
  }
  return pairs;
}

function collectFormatterSpecCandidates(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
): FormattingSpecArgs[] {
  return collectFieldQuantityPairs({
    overrideName: quantityOptions?.kindOfQuantity,
    overridePersistence: quantityOptions?.persistenceUnit,
    propertyName: value.kindOfQuantityFullName,
    propertyPersistence: value.persistenceUnitFullName,
  });
}

/** Constructs a [FormatterSpec]($core-quantity) on demand from the sync providers.
 * Walks the candidates from [[collectFormatterSpecCandidates]] in priority order and returns
 * the first for which both the format and the persistence unit resolve. A candidate is skipped when the format, persistence unit,
 * or any referenced unit cannot be resolved synchronously (including when the sync units
 * provider is not yet warmed up).
 */
function getFormatterSpecSync(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
  context: FieldFormatterContextSync,
): FormatterSpec | undefined {
  for (const candidate of collectFormatterSpecCandidates(quantityOptions, value)) {
    let formatProps;
    try {
      formatProps = context.formatsProvider.getFormatSync(candidate.name);
    } catch {
      continue;
    }
    if (!formatProps) {
      continue;
    }

    let persistenceUnit: UnitProps | undefined;
    try {
      persistenceUnit = context.unitsProvider.findUnitByNameSync(candidate.persistenceUnitName);
    } catch {
      // Try the next candidate.
    }
    if (!persistenceUnit?.isValid) {
      continue;
    }

    try {
      const format = Format.createFromJSONSync("fieldFormat", context.unitsProvider, formatProps);
      return FormatterSpec.createSync("fieldFormat", format, context.unitsProvider, persistenceUnit);
    } catch {
      // Try the next candidate.
    }
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

/** Applies a pre-resolved [FormatterSpec]($core-quantity) to a quantity or coordinate
 * [[FieldValue]] and wraps the result with prefix/suffix/case. Shared by both spec-resolution
 * paths.
 *
 * `formatMagnitude` renders each scalar. When the spec came from a
 * [FormattingSpecProvider]($core-quantity), the caller passes a closure routing through
 * [FormattingSpecProvider.formatQuantity]($core-quantity) so caller-side hooks (caching,
 * telemetry, per-call KoQ substitution) are honored. A spec constructed on demand has no such
 * provider, so it defaults to `spec.applyFormatting`.
 */
function applySpecToFieldValue(
  value: FieldValue,
  options: FieldFormatOptions | undefined,
  spec: FormatterSpec,
  formatMagnitude: (magnitude: number) => string = (m) => spec.applyFormatting(m),
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

/** Looks up an already-warmed [FormatterSpec]($core-quantity) for `value` from `provider`.
 * Consumes the shared [[collectFieldQuantityPairs]] helper so pre-warmed lookup enumerates
 * the same candidates as on-demand construction; returns `undefined` when no candidate matches
 * (caller falls through to the next step in the chain).
 */
function lookupSyncSpec(
  quantityOptions: QuantityFieldFormatOptions | undefined,
  value: FieldValue,
  provider: FormattingSpecProvider,
): FormatterSpec | undefined {
  const pairs = collectFieldQuantityPairs({
    overrideName: quantityOptions?.kindOfQuantity,
    overridePersistence: quantityOptions?.persistenceUnit,
    propertyName: value.kindOfQuantityFullName,
    propertyPersistence: value.persistenceUnitFullName,
  });
  for (const pair of pairs) {
    const spec = provider.getSpecsByNameAndUnit(pair)?.formatterSpec;
    if (spec) {
      return spec;
    }
  }
  return undefined;
}

/** Formats `"quantity"` and `"coordinate"` values via a caller-supplied
 * [FormattingSpecProvider]($core-quantity).
 * Intended for the txn callback path, where spec construction cannot be awaited but the app
 * has pre-built the required specs.
 *
 * Callers whose provider registry is keyed by [QuantityFieldFormatOptions.formatSet]($common)
 * are expected to look up the provider from `options?.quantity?.formatSet` before calling
 * this function, and fall back to [[formatFieldValue]] themselves when the lookup misses.
 *
 * Falls back to [[formatFieldValue]] for other [[FieldPropertyType]]s or when no
 * [FormatterSpec]($core-quantity) matches. See [[applySpecToFieldValue]] for why the sync
 * provider path routes each scalar through
 * [FormattingSpecProvider.formatQuantity]($core-quantity) while an on-demand spec uses
 * [FormatterSpec.applyFormatting]($core-quantity) directly.
 * @internal
 */
export function formatFieldValueWithSpecProvider(
  value: FieldValue,
  options: FieldFormatOptions | undefined,
  provider: FormattingSpecProvider,
): string | undefined {
  return formatFieldValueSync(value, options, { provider });
}

/** Unified synchronous formatter for `"quantity"` and `"coordinate"` values. Resolution chain:
 *
 * 1. **Pre-warmed provider** — when `args.provider` is supplied, an already-warmed
 *    [FormatterSpec]($core-quantity) is looked up via [[lookupSyncSpec]] and each scalar is
 *    rendered through [FormattingSpecProvider.formatQuantity]($core-quantity) so caller-side
 *    hooks are honored.
 * 2. **Sync on-demand construction** — when `args.context` is supplied and step 1 misses, a
 *    spec is constructed synchronously from the schema-backed sync providers (see
 *    [[getFormatterSpecSync]]). This is the schema-default fallback: fields whose EC property
 *    carries a KindOfQuantity format even when no app provider is registered.
 * 3. **Raw fallback** — [[formatFieldValue]] (`value.toString()` / `(x, y[, z])`).
 *
 * Intended for the txn callback path, where spec construction cannot be awaited.
 * @internal
 */
export function formatFieldValueSync(
  value: FieldValue,
  options: FieldFormatOptions | undefined,
  args: { provider?: FormattingSpecProvider, context?: FieldFormatterContextSync },
): string | undefined {
  if (value.type !== "quantity" && value.type !== "coordinate") {
    return formatFieldValue(value, options);
  }

  if (args.provider) {
    const spec = lookupSyncSpec(options?.quantity, value, args.provider);
    if (spec) {
      const provider = args.provider;
      return applySpecToFieldValue(value, options, spec, (m) => provider.formatQuantity(m, spec));
    }
  }

  if (args.context) {
    const spec = getFormatterSpecSync(options?.quantity, value, args.context);
    if (spec) {
      try {
        return applySpecToFieldValue(value, options, spec);
      } catch {
        // Fall through to the raw fallback.
      }
    }
  }

  return formatFieldValue(value, options);
}
