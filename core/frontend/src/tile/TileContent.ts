/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  ElementAlignedBox3d,
  RenderTexture,
} from "@bentley/imodeljs-common";
import { RenderTerrainMeshGeometry } from "../render/RenderSystem";
import { RenderGraphic } from "../render/RenderGraphic";
import { TerrainMeshPrimitive } from "../render/primitives/mesh/TerrainMeshPrimitive";
/**
 * Describes the contents of a [[Tile]].
 * @internal
 */
export interface TileContent {
  /** Graphical representation of the tile's geometry. */
  graphic?: RenderGraphic;
  /** Bounding box tightly enclosing the tile's geometry. */
  contentRange?: ElementAlignedBox3d;
  /** True if this tile requires no subdivision or refinement. */
  isLeaf?: boolean;
  /** If this tile was produced by refinement, the multiplier applied to its screen size. */
  sizeMultiplier?: number;
  /** A bitfield describing empty sub-volumes of this tile's volume. */
  emptySubRangeMask?: number;
  /** Texture only for trees that provide imagery. */
  imageryTexture?: RenderTexture;
  /** For terrain tiles. */
  terrain?: {
    geometry?: RenderTerrainMeshGeometry;
    /** Used on leaves to support up-sampling. */
    mesh?: TerrainMeshPrimitive;
  };
}
