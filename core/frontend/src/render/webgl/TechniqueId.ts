/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { CompositeFlags } from "./RenderFlags";
import { assert } from "@bentley/bentleyjs-core";

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
  CompositeOcclusion,
  CompositeTranslucentAndOcclusion,
  CompositeHiliteAndOcclusion,
  CompositeAll,
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
  AmbientOcclusion,
  Blur,

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

export function computeCompositeTechniqueId(flags: CompositeFlags): TechniqueId {
  assert(flags >= 0 && flags <= 7);
  return compositeTechniqueIds[flags];
}
