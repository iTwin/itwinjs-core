/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { DateTimeFieldFormatOptions, EnumFieldFormatOptions, FieldFormatOptions, FieldPropertyType, QuantityFieldFormatOptions } from "../../annotation/TextField";
import { Format, FormatterSpec } from "@itwin/core-quantity";

// A FieldPropertyPath must ultimately resolve to one of these primitive types.
export type FieldPrimitiveValue = boolean | number | string | Date | XAndY | XYAndZ | Uint8Array;

export interface FieldValue {
  value: FieldPrimitiveValue;
  type: FieldPropertyType | string;
}

type FieldFormatter = (value: FieldPrimitiveValue, options: FieldFormatOptions | undefined) => string | undefined;

interface Coordinate { x: number, y: number, z: number | undefined }

function isCoordinate(v: FieldPrimitiveValue): v is Coordinate {
  const obj = typeof v === "object" ? v as any : undefined;
  return undefined !== obj && typeof obj.x === "number" && typeof obj.y === "number" && (undefined === obj.z || typeof obj.z === "number");
}

const formatters: { [type: string]: FieldFormatter | undefined } = {
  "string": (v, o) => formatString(v.toString(), o),

  "int-enum": (v, o) => {
    const n = typeof v === "number" ? v : undefined;
    if (undefined === n || Math.floor(n) !== n) {
      return undefined;
    }

    return formatString(formatEnum<number>(n, o?.enum), o);
  },

  "string-enum": (v, o) => {
    if (typeof v !== "string") {
      return undefined;
    }

    return formatString(formatEnum<string>(v, o?.enum), o);
  },

  "boolean": (v, o) => {
    const opts = o?.boolean;
    if (typeof v !== "boolean" || !opts) {
      return undefined;
    }

    return formatString(v ? opts.trueString : opts.falseString, o);
  },

  "quantity": (v, o) => formatString(formatQuantity(v, o?.quantity), o),

  "coordinate": (v, o) => {
    if (!isCoordinate(v)) {
      return undefined;
    }

    const parts: string[] = [];
    const formatComponent = (component: number) => {
      const str = formatQuantity(component, o?.quantity);
      if (undefined === str) {
        return false;
      }

      parts.push(str);
      return true;
    };

    const selector = o?.coordinate?.components ?? "XYZ";
    if ((selector === "XYZ" || selector === "XY" || selector === "X") && !formatComponent(v.x)) {
      return undefined;
    }

    if ((selector === "XYZ" || selector === "XY" || selector === "Y") && !formatComponent(v.y)) {
      return undefined;
    }

    if (selector === "XYZ" && undefined !== v.z && !formatComponent(v.z)) {
      return undefined;
    }

    const components = parts.join(o?.coordinate?.componentSeparator ?? ",");
    return formatString(components, o);
  },

  "datetime": (v, o) => formatString(formatDateTime(v, o?.dateTime), o),
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

function formatEnum<T extends number | string>(v: T, o: EnumFieldFormatOptions<number | string> | undefined): string | undefined {
  const fallback = o?.fallbackLabel;
  const labels = o?.labels;
  if (!labels) {
    return fallback;
  }

  for (const entry of labels) {
    if (entry.value === v) {
      return entry.label;
    }
  }

  return fallback;
}

function formatQuantity(v: FieldPrimitiveValue, o?: QuantityFieldFormatOptions): string | undefined {
  if (typeof v !== "number") {
    return undefined;
  }

  // ###TODO apply quantity formatting...
  if (o && o.formatProps){
    const formatName = o.formatProps.name ?? "defaultFormat";
    const format = Format.createFromFullyResolvedJSON(formatName, o.formatProps);
    const formatterSpec = new FormatterSpec(format.name, format, o?.unitConversions, o?.sourceUnit);
    return formatterSpec.applyFormatting(v);
  }else
    return v.toString();
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
  return undefined
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export function formatFieldValue(value: FieldValue, options: FieldFormatOptions | undefined): string | undefined {
  const formatter = formatters[value.type];
  return formatter ? formatter(value.value, options) : undefined;
}

export function isKnownFieldPropertyType(type: string): type is FieldPropertyType {
  return type in formatters;
}

