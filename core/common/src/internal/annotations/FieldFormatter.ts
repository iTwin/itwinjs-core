/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { DateTimeFieldFormatOptions, FieldFormatOptions, FieldPropertyType } from "../../annotation/TextField";

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
  /** How [[value]] should be formatted; drives the per-type branch in [[formatFieldValue]]. */
  type: FieldPropertyType;
  /** EC full name of the property's KindOfQuantity, e.g. `"AecUnits.LENGTH"`, if it has one. */
  kindOfQuantityFullName?: string;
  /** EC full name of the unit the stored magnitude is expressed in, e.g. `"Units.M"`. */
  persistenceUnitFullName?: string;
}

/** Renders one magnitude of a `"quantity"` or `"coordinate"` value — typically by applying a
 * [FormatterSpec]($core-quantity) the caller resolved ahead of time. Supplying one is what lets
 * field evaluation stay synchronous on paths that cannot await.
 * @internal
 */
export type FormatMagnitude = (magnitude: number) => string;

type FieldFormatter = (value: FieldPrimitiveValue, options: FieldFormatOptions | undefined, formatMagnitude?: FormatMagnitude) => string | undefined;

const formatters: { [type: string]: FieldFormatter | undefined } = {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  "string": (v, o) => formatString(v.toString(), o),

  "datetime": (v, o) => formatString(formatDateTime(v, o?.dateTime), o),

  "quantity": (v, o, fm) => formatString(formatMagnitudeValue(v, fm), o),

  "coordinate": (v, o, fm) => formatString(formatPoint(v, fm), o),
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

/** A `"quantity"` magnitude rendered through `formatMagnitude`, or its raw string
 * representation when no callback was supplied or the value is not a number.
 */
function formatMagnitudeValue(v: FieldPrimitiveValue, formatMagnitude?: FormatMagnitude): string | undefined {
  if (formatMagnitude && typeof v === "number") {
    return formatMagnitude(v);
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return v.toString();
}

/** A coordinate rendered as `(x, y[, z])`, each component passed through `formatMagnitude` when
 * one is supplied. Without a callback the components render bare, with no unit labels — Core
 * carries no built-in coordinate format.
 */
function formatPoint(v: FieldPrimitiveValue, formatMagnitude?: FormatMagnitude): string | undefined {
  const magnitudes = getCoordinateMagnitudes(v);
  if (!magnitudes) {
    return undefined;
  }

  return `(${magnitudes.map((m) => formatMagnitude ? formatMagnitude(m) : `${m}`).join(", ")})`;
}

/** Formats `value` through the per-type entry in [[formatters]], wrapping the result with
 * prefix/suffix/case.
 *
 * `formatMagnitude` is consulted only by the `"quantity"` and `"coordinate"` branches. Omitting
 * it falls those values back to `value.toString()`.
 * @internal
 */
export function formatFieldValue(value: FieldValue, options: FieldFormatOptions | undefined, formatMagnitude?: FormatMagnitude): string | undefined {
  const formatter = formatters[value.type];
  return formatter ? formatter(value.value, options, formatMagnitude) : undefined;
}

/** Type guard for [[FieldPropertyType]] strings that have a built-in per-type formatter.
 * @internal
 */
export function isKnownFieldPropertyType(type: string): type is FieldPropertyType {
  return type in formatters;
}

/** The `x`, `y` and (when present) `z` components of a coordinate value, or `undefined` if `v` is
 * not one.
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
