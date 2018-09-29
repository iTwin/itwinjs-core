/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

/** Technique enumeration */
export const enum TechniqueId {
  // Techniques with many different variations
  Invalid = -1,
  Surface,
  Polyline,
  PointCloud,
  PointString,
  Edge,
  SilhouetteEdge,

  // Techniques with a single associated shader that operates on the entire image
  CompositeHilite,
  CompositeTranslucent,
  CompositeHiliteAndTranslucent,
  OITClearTranslucent,
  CopyPickBuffers,
  CopyColor,
  CopyColorNoAlpha,
  CopyStencil,
  ClearPickAndColor,
  ClipMask,
  SkyBox,
  SkySphereGradient,
  SkySphereTexture,

  NumBuiltIn,
  COUNT = NumBuiltIn,
}
