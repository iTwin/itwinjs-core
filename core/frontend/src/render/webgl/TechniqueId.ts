/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { CompositeFlags } from "./RenderFlags";

/* eslint-disable no-restricted-syntax */

/** Technique enumeration
 * @internal
 */
export const enum TechniqueId {
  // Techniques with many different variations
  Invalid = -1,
  Surface,
  Polyline,
  PointCloud,
  PointString,
  Edge,
  SilhouetteEdge,
  IndexedEdge,
  RealityMesh,
  PlanarGrid,

  // Techniques with a single associated shader that operates on the entire image
  CompositeHilite,
  CompositeTranslucent,
  CompositeHiliteAndTranslucent,
  CompositeOcclusion,
  CompositeTranslucentAndOcclusion,
  CompositeHiliteAndOcclusion,
  CompositeAll,
  OITClearTranslucent,
  CopyPickBuffers,
  CopyColor,
  CopyColorNoAlpha,
  VolClassColorUsingStencil,
  ClearPickAndColor,
  EVSMFromDepth,
  SkyBox,
  SkySphereGradient,
  SkySphereTexture,
  AmbientOcclusion,
  Blur,
  CombineTextures,
  Combine3Textures,
  VolClassCopyZ,
  VolClassSetBlend,
  VolClassBlend,

  NumBuiltIn,
  COUNT = NumBuiltIn,
}

const compositeTechniqueIds = [
  TechniqueId.Invalid, // None = 0
  TechniqueId.CompositeTranslucent, // Translucent == 1 << 0
  TechniqueId.CompositeHilite, // Hilite == 1 << 1 == 2
  TechniqueId.CompositeHiliteAndTranslucent, // Hilite | Translucent == 1 | 2 == 3
  TechniqueId.CompositeOcclusion, // AmbientOcclusion == 1 << 2 == 4
  TechniqueId.CompositeTranslucentAndOcclusion, // Translucent | AmbientOcclusion == 1 | 4 == 5
  TechniqueId.CompositeHiliteAndOcclusion, // Hilite | AmbientOcclusion == 2 | 4 == 6
  TechniqueId.CompositeAll, // Translucent | Hilite | AmbientOcclusion == 1 | 2 | 4 == 7
];

/** @internal */
export function computeCompositeTechniqueId(flags: CompositeFlags): TechniqueId {
  assert(flags >= 0 && flags <= 7);
  return compositeTechniqueIds[flags];
}
