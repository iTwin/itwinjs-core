/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import type { FillFlags, RenderMaterial, RenderTexture } from "@itwin/core-common";
import type { VertexIndices } from "./VertexTable";

/** @internal */
export enum SurfaceType {
  Unlit,
  Lit,
  Textured,
  TexturedLit,
  VolumeClassifier,
}

/** @internal */
export function isValidSurfaceType(value: number): boolean {
  switch (value) {
    case SurfaceType.Unlit:
    case SurfaceType.Lit:
    case SurfaceType.Textured:
    case SurfaceType.TexturedLit:
    case SurfaceType.VolumeClassifier:
      return true;
    default:
      return false;
  }
}

/** @internal */
export interface SurfaceRenderMaterial {
  readonly isAtlas: false;
  readonly material: RenderMaterial;
}

/** @internal */
export interface SurfaceMaterialAtlas {
  readonly isAtlas: true;
  // Overrides surface alpha to be translucent. Implies `overridesAlpha`.
  readonly hasTranslucency: boolean;
  // Overrides surface alpha to be opaque or translucent.
  readonly overridesAlpha: boolean;
  // offset past the END of the vertex data; equivalently, number of 32-bit colors in color table preceding material atlas.
  readonly vertexTableOffset: number;
  readonly numMaterials: number;
}

/** @internal */
export type SurfaceMaterial = SurfaceRenderMaterial | SurfaceMaterialAtlas;

/** @internal */
export function createSurfaceMaterial(source: RenderMaterial | undefined): SurfaceMaterial | undefined {
  if (undefined === source)
    return undefined;
  else
    return { isAtlas: false, material: source };
}

/** @internal */
export interface SurfaceParams {
  readonly type: SurfaceType;
  readonly indices: VertexIndices;
  readonly fillFlags: FillFlags;
  readonly hasBakedLighting: boolean;
  readonly hasFixedNormals: boolean;
  readonly textureMapping?: {
    texture: RenderTexture;
    alwaysDisplayed: boolean;
  };
  readonly material?: SurfaceMaterial;
}

