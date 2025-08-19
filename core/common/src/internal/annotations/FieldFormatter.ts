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
  // ###TODO
};

function formatString(s: string, o?: FieldFormatOptions): string {
  if (!o) {
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
