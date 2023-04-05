/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Geometry } from "@itwin/core-geometry";

/** Specifies margins to apply around a view volume for methods like [[ViewState.lookAtVolume]] and [[Viewport.zoomToElements]], expanding the
 * viewed volume by a percentage of its original size to add extra space around one or more edges.
 * The margin values represent a fraction of the view volume's width (for [[left]] and [[right]]) or height (for [[top]] and [[bottom]]).
 * The values are clamped to the range 0 through 0.25.
 * @note Margins are only applied in 2d views, or 3d views in which the camera has been turned off.
 * @note The way in which the extra space is computed is somewhat unintuitive and may lead to surprising results.
 * @see [[MarginOptions.marginPercent]].
 * @see [[PaddingPercent]] for a more predictable way of adjusting the viewed volume.
 * @public
 * @extensions
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

/** Specifies padding to apply around a view volume for methods like [[ViewState.lookAtVolume]] and [[Viewport.zoomToElements]], expanding or
 * contracting the viewed volume by a fraction of its original size.
 * The margin values represent a fraction of the view volume's width (for [[left]] and [[right]]) or height (for [[top]] and [[bottom]]).
 * Positive values add additional volume along the specified edge, negative values subtract it, and zero values have no effect.
 * All properties default to zero if `undefined`.
 * For example, if the original volume has a width of 100 and the padding is specified as `{ left: 1 }`, the width will be doubled to 200, with 100 padding on the left side of the view.
 * If a padding of 0.25 is specified for each of [[left]], [[right]], [[top]], and [[bottom]], then the final volume will be inset such that 25% of the original volume falls outside
 * of the view on each side.
 * @note Margins are only applied in 2d views, or 3d views in which the camera has been turned off.
 * @see [[MarginOptions.paddingPercent]].
 * @public
 * @extensions
 */
export interface PaddingPercent {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}
