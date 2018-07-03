/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
  ClearPickAndColor,
  ClipMask,

  NumBuiltIn,
  COUNT = NumBuiltIn,
}
