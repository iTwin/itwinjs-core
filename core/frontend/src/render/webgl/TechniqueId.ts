/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export const enum TechniqueId {
  // Techniques with many different variations
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
  ClearPickAndColor,

  NumBuiltIn,
  COUNT = NumBuiltIn,
}
