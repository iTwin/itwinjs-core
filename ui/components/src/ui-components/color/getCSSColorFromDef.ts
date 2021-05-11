/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Color
 */

import { ColorDef } from "@bentley/imodeljs-common";

/** @internal */
export function getCSSColorFromDef(colorDef: ColorDef): string {
  const { b, g, r, t } = colorDef.colors;
  let rgbaString = "";
  if (t === 0)
    rgbaString = `rgb(${r},${g},${b})`;
  else {
    const alpha = ((255 - t) / 255).toFixed(2);
    rgbaString = `rgba(${r},${g},${b},${alpha})`;
  }
  return rgbaString;
}
