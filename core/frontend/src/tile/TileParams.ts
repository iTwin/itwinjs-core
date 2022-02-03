/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import type { ElementAlignedBox3d } from "@itwin/core-common";
import type { Tile } from "./internal";

/**
 * Parameters used to construct a [[Tile]].
 * @public
 */
export interface TileParams {
  /** This tile's parent tile, if any.
   * @note Every tile has exactly one parent, except for [[TileTree.rootTile]] which has no parent.
   */
  parent?: Tile;
  /** True if this tile has no child tiles - i.e., requires no refinement. */
  isLeaf?: boolean;
  /** Uniquely identifies this tile's content within the context of its [[TileTree]]. */
  contentId: string;
  /** The volume of space occupied by this tile. If the tile has a parent tile, this tile's volume must be fully enclosed by its parent tile's volume. */
  range: ElementAlignedBox3d;
  /** Optionally, a volume more tightly encompassing this tile's contents. Must be fully enclosed by [[range]]. */
  contentRange?: ElementAlignedBox3d;
  /** The size in pixels beyond which this tile is considered too low-resolution for display. If zero, the tile is considered undisplayable.
   * An undisplayable tile may have displayable child tiles.
   */
  maximumSize: number;
}
