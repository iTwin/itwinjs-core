/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { BeDuration, Id64String } from "@bentley/bentleyjs-core";
import { Transform } from "@bentley/geometry-core";
import { ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { TileLoadPriority } from "./internal";

/**
 * Parameters used to construct a TileTree
 * @beta
 */
export interface TileTreeParams {
  /** Uniquely identifies this tile tree. */
  id: string;
  /** A 64-bit identifier for this tile tree, unique within the context of its [[IModelConnection]]. For a tile tree associated with a [[GeometricModelState]], this is the Id of the model; other types of tile treees typically use a transient Id.
   * @see [[IModelConnection.transientIds]].
   */
  modelId: Id64String;
  /** The IModelConnection to which the tile tree belongs. The tile tree will be disposed when the IModelConnection is closed. */
  iModel: IModelConnection;
  /** Transform from tile tree coordinates to iModel coordinates. */
  location: Transform;
  /** Optional clip volume applied to all tiles in the tree. */
  clipVolume?: RenderClipVolume;
  /** Loose description of the "importance" of the tiles exposed by this tile tree, used for prioritizing requests for tile content. */
  priority: TileLoadPriority;
  /** Optional volume tightly encompassing the contents of this tile tree - used for more accurate culling. */
  contentRange?: ElementAlignedBox3d;
  /** Optionally specifies the amount of time before tiles belonging to this tile tree are considered eligible for disposal after disuse.
   * If unspecified, a default expiration time is chosen based on the tile tree's [[priority]].
   * @see [[TileTree.prune]]
   */
  expirationTime?: BeDuration;
}
