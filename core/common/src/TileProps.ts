/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { Id64Props, Id64 } from "@bentley/bentleyjs-core";
import { TransformProps, Range3dProps } from "@bentley/geometry-core";

export interface TileIdProps {
  treeId: Id64Props;
  tileId: string;
}

export class TileId implements TileIdProps {
  public readonly treeId: Id64;
  public readonly tileId: string;

  public constructor(treeId: Id64, tileId: string) {
    this.treeId = treeId;
    this.tileId = tileId;
  }

  public static fromJSON(props: TileIdProps): TileId { return new TileId(Id64.fromJSON(props.treeId), props.tileId); }
}

/**
 * The metadata describing a single Tile.
 * Note that a Tile's metadata is distinct from its content (geometry, from which graphics are created).
 * Before a Tile's content is loaded, some of the metadata may be in an unknown state.
 * For example, the content range is derived from the geometry; if the geometry has not been loaded, the content range cannot be computed.
 * Therefore after loading a Tile's content, some metadata may change:
 *  - isLeaf may be set to true
 *  - sizeMultiplier may be set to a value > 1.0
 *  - contentRange may be set to a non-null range
 *  - maximumSize may be set to zero if the tile content is empty.
 * Due to tile caching optimizations, some of this metadata may be retrieved from the backend cache before the tile content is loaded.
 */
export interface TileProps {
  /** The unique identifier of the tile within the iModel */
  id: TileIdProps;
  /** The volume in which all of the tile's contents reside */
  range: Range3dProps;
  /** Optional volume within the tile's range which more tightly encloses the tile geometry */
  contentRange?: Range3dProps;
  /** The maximum size in pixels at which the tile should be drawn on the screen. Excludes the optional sizeMultiplier which is applied separately. */
  maximumSize: number;
  /** Optional scaling factor applied to this tile's maximum size. Defaults to 1.0 if undefined. */
  sizeMultiplier?: number;
  /** Optional boolean indicating this tile has no children. Defaults to false if undefined. */
  isLeaf?: boolean;
}

/** The metdata describing a TileTree */
export interface TileTreeProps {
  /** The unique identifier of this TileTree within the iModel */
  id: Id64Props;
  /** Metadata describing the tree's root Tile. */
  rootTile: TileProps;
  /** Transform tile coordinates to iModel world coordinates. */
  location: TransformProps;
  /** If defined, limits the number of child tiles which can be skipped in selecting tiles of appropriate LOD */
  maxTilesToSkip?: number;
  /** Optional - set to True for Y Axis up. By default Z Axis is up. */
  yAxisUp?: boolean;
  /** Optional - if defined and true, this TileTree contains only terrain tiles. */
  isTerrain?: boolean;
}
