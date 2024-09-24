/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

/** 16-bit flags indicating what aspects of a feature's symbology are overridden.
 * These are used for FeatureOverrides and InstancedGraphicParams.
 * The flags are interpreted in the vertex shader.
 */
export const enum OvrFlags { // eslint-disable-line no-restricted-syntax
  None = 0,
  Visibility = 1 << 0,
  Rgb = 1 << 1,
  Alpha = 1 << 2,
  /** ignore material color, specular properties, and texture. */
  IgnoreMaterial = 1 << 3,
  Flashed = 1 << 4,
  /* do not draw during pick - allows geometry beneath to be picked. */
  NonLocatable = 1 << 5,
  LineCode = 1 << 6,
  Weight = 1 << 7,
  Hilited = 1 << 8,
  /* rendered with "emphasis" hilite settings (silhouette etc). */
  Emphasized = 1 << 9,
  ViewIndependentTransparency = 1 << 10,
  /* Different from both NonLocatable and Visibility, but with the same effect as NonLocatable - don't draw during pick.
   * It's a separate flag because it is temporarily set during readPixels if a list of elements to hide is supplied, and then reset
   * immediately afterward.
   * We want to be able to efficiently change just that flag in the FeatureOverrides texture, and then flip it back off without worrying about
   * interfering with the other 2 flags.
   */
  InvisibleDuringPick = 1 << 11,

  Rgba = Rgb | Alpha,
}

