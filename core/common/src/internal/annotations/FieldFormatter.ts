/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { EnumFieldFormatOptions, FieldFormatOptions, FieldPropertyType, QuantityFieldFormatOptions } from "../../annotation/TextField";
import { Format, FormatterSpec } from "@itwin/core-quantity";

// A FieldPropertyPath must ultimately resolve to one of these primitive types.
export type FieldPrimitiveValue = boolean | number | string | Date | XAndY | XYAndZ | Uint8Array;

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

  "datetime": (v, o) => {
    // ###TODO customizable formatting...
    // ###TODO currently ECSqlValue exposes date-time values as ISO strings...
    return formatString(v.toString(), o);
  },
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
    case "first-capital":
    case "title":
      // ###TODO
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

function formatQuantity(v: FieldPrimitiveValue, _o?: QuantityFieldFormatOptions): string | undefined {
  if (typeof v !== "number") {
    return undefined;
  }

  // ###TODO apply quantity formatting...
  if (_o && _o.formatProps){
    const formatName = _o.formatProps.name ?? "defaultFormat";
    const format = Format.createFromFullyResolvedJSON(formatName, _o.formatProps);
    const formatterSpec = new FormatterSpec(format.name, format, _o?.unitConversions, _o?.sourceUnit);
    return formatterSpec.applyFormatting(v);
  }else
    return v.toString();
}

export function formatFieldValue(value: FieldPrimitiveValue, type: FieldPropertyType, options: FieldFormatOptions | undefined): string | undefined {
  const formatter = formatters[type];
  return formatter ? formatter(value, options) : undefined;
}
