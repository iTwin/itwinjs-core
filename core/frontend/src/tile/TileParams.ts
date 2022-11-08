/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ElementAlignedBox3d } from "@itwin/core-common";
import { Tile } from "./internal";

/**
 * Parameters used to construct a [[Tile]].
 * @public
 * @extensions
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

  /** True if the tile is outside the valid range of LOD : some tile trees, such as ImageryTileTree might not be fully defined (i.e. TileTree might start at level 10+).
   * This flag is needed because we can't assume this is tile is a leaf, or start drilling down the tile tree for available higher resolutions tiles.  If a tile
   * matches the current display screen size but is out of range, simply render blank data (i.e We want user to adjust level of the view to see available data.)
  */
  outOfLodRange?: boolean;
}
