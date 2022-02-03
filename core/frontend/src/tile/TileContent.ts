/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import type { ElementAlignedBox3d } from "@itwin/core-common";
import type { RenderGraphic } from "../render/RenderGraphic";

/**
 * Describes the contents of a [[Tile]]. Specific sub-types of [[Tile]] may describe their content using sub-types of this interface.
 * @see [[Tile.readContent]].
 * @public
 */
export interface TileContent {
  /** Graphical representation of the tile's geometry. */
  graphic?: RenderGraphic;
  /** Bounding box tightly enclosing the tile's geometry. */
  contentRange?: ElementAlignedBox3d;
  /** True if this tile requires no subdivision or refinement - i.e., has no child tiles. */
  isLeaf?: boolean;
}
