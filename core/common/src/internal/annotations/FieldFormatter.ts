/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { FieldFormatOptions, FieldPropertyType, QuantityFieldFormatOptions } from "../../core-common";
import { Format, FormatterSpec } from "@itwin/core-quantity";

// A FieldPropertyPath must ultimately resolve to one of these primitive types.
export type FieldPrimitiveValue = boolean | number | string | Date | XAndY | XYAndZ | Uint8Array;

type FieldFormatter = (value: FieldPrimitiveValue, options: FieldFormatOptions | undefined) => string | undefined;

type Coordinate = { x: number, y: number, z: number | undefined };

function isCoordinate(v: FieldPrimitiveValue): v is Coordinate {
  const obj = typeof v === "object" ? v as any : undefined;
  return undefined !== obj && typeof obj.x === "number" && typeof obj.y === "number" && (undefined === obj.z || typeof obj.z === "number");
}

const formatters: { [type: string]: FieldFormatter | undefined } = {
  "string": (v, o) => formatString(v.toString(), o),

  "enum": (v, o) => {
    const labels = o?.enum?.labels;
    if (!labels) {
      // Need to be able to map enum value to display label.
      return undefined;
    }

    const n = typeof v === "number" ? v : undefined;
    if (undefined === n || Math.floor(n) !== n) {
      // enum values must be integers.
      return undefined;
    }

    for (const entry of labels) {
      if (entry.value === n) {
        return formatString(entry.label, o);
      }
    }

    // value doesn't match any of the labels.
    return undefined;
  },

  "boolean": (v, o) => {
    const opts = o?.boolean;
    if (typeof v !== "boolean" || !opts) {
      return undefined;
    }

    return formatString(v ? opts.trueString : opts.falseString, o);
  },
  "quantity": (v, o) => formatString(formatQuantity(v, o?.quantity)),

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
    if ((selector === "XYZ" || selector == "XY" || selector === "X") && !formatComponent(v.x)) {
      return undefined;
    }

    if ((selector === "XYZ" || selector === "XY" || selector === "Y") && !formatComponent(v.y)) {
      return undefined;
    }

    if (selector === "XYZ" && undefined !== v.z && !formatComponent(v.z)) {
      return undefined;
    }

    const components = parts.join(o?.coordinate?.componentSeparator ?? "");
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

function formatQuantity(v: FieldPrimitiveValue, _o?: QuantityFieldFormatOptions): string | undefined {
  if (typeof v !== "number") {
    return undefined;
  }

  // ###TODO apply quantity formatting...
  if (_o){
    const formatterSpec = new FormatterSpec(v.toString(),_o!.format, _o?.unitConversions, _o?.sourceUnit);
    return formatterSpec.applyFormatting(v);
  }else
    return undefined;

}

export function formatFieldValue(value: FieldPrimitiveValue, type: FieldPropertyType, options: FieldFormatOptions | undefined): string | undefined {
  const formatter = formatters[type];
  return formatter ? formatter(value, options) : undefined;
}
