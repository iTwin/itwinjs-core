/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { XAndY, XYAndZ } from "@itwin/core-geometry";
import { FieldFormatOptions, FieldPropertyType } from "../../core-common";

// A FieldPropertyPath must ultimately resolve to one of these primitive types.
export type FieldPrimitiveValue = boolean | number | string | Date | XAndY | XYAndZ | Uint8Array;

type FieldFormatter = (value: FieldPrimitiveValue, options: FieldFormatOptions | undefined) => string | undefined;

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
  "quantity": () => { throw new Error("###TODO") },
  "coordinate": () => { throw new Error("###TODO") },
  "datetime": () => { throw new Error("###TODO") },
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

export function formatFieldValue(value: FieldPrimitiveValue, type: FieldPropertyType, options: FieldFormatOptions | undefined): string | undefined {
  const formatter = formatters[type];
  return formatter ? formatter(value, options) : undefined;
}
