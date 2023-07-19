/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ElementAlignedBox3d } from "@itwin/core-common";
import { RenderGraphic } from "../render/RenderGraphic";

/**
 * Describes the contents of a [[Tile]]. Specific sub-types of [[Tile]] may describe their content using sub-types of this interface.
 * @see [[Tile.readContent]].
 * @public
 * @extensions
 */
export interface TileContent {
  /** Graphical representation of the tile's geometry. */
  graphic?: RenderGraphic;
  /** Bounding box tightly enclosing the tile's geometry. */
  contentRange?: ElementAlignedBox3d;
  /** True if this tile requires no subdivision or refinement - i.e., has no child tiles. */
  isLeaf?: boolean;
  /** Whether the content includes one or more point clouds.
   * Generally, if this is true, it contains exactly one point cloud and no other geometry.
   * We need to know this for the classification shaders.
   * @internal
   */
  containsPointCloud?: boolean;
}
