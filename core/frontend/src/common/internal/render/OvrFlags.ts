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
export const enum OvrFlags {
  None = 0,
  Visibility = 1 << 0,
  Rgb = 1 << 1,
  Alpha = 1 << 2,
  IgnoreMaterial = 1 << 3, // ignore material color, specular properties, and texture.
  Flashed = 1 << 4,
  NonLocatable = 1 << 5, // do not draw during pick - allows geometry beneath to be picked.
  LineCode = 1 << 6,
  Weight = 1 << 7,
  Hilited = 1 << 8,
  Emphasized = 1 << 9, // rendered with "emphasis" hilite settings (silhouette etc).
  ViewIndependentTransparency = 1 << 10,

  Rgba = Rgb | Alpha,
}

