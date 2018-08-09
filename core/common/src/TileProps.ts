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

/** The metadata describing a single Tile */
export interface TileProps {
  /** The unique identifier of the tile within the iModel */
  id: TileIdProps;
  /** The id of the tile's parent within its TileTree, if it is not the root tile. */
  parentId?: string;
  /** The volume in which all of the tile's contents reside */
  range: Range3dProps;
  /** Optional volume within the tile's range which more tightly encloses the tile geometry */
  contentRange?: Range3dProps;
  /** The maximum size in pixels at which the tile should be drawn on the screen. */
  maximumSize: number;
  /** The IDs of this tile's child tiles within its TileTree */
  childIds: string[];
  /** Optional scaling factor applied to this tile's maximum size */
  zoomFactor?: number;
  /** WIP: base-64-encoded binary tile geometry data, ArrayBuffer or undefined if no geometry */
  geometry?: any;
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
  // ###TODO: ViewFlag.Overrides, ClipVector
}
