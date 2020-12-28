/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Geometry } from "@bentley/geometry-core";
/** Margins for white space to be left around view volumes for [[ViewState.lookAtVolume]].
 * Values mean "fraction of view size" and must be between 0 and .25.
 * @public
 */
export class MarginPercent {
  constructor(public left: number, public top: number, public right: number, public bottom: number) {
    const limitMargin = (val: number) => Geometry.clamp(val, 0.0, 0.25);
    this.left = limitMargin(left);
    this.top = limitMargin(top);
    this.right = limitMargin(right);
    this.bottom = limitMargin(bottom);
  }
}
