/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { IModelConnection } from "../IModelConnection";
import { TileTree } from "./internal";

/** Interface adopted by an object which can supply a [[TileTree]] for rendering.
 * A supplier can supply any number of tile trees; the only requirement is that each tile tree has a unique identifier within the context of the supplier and a single IModelConnection.
 * The identifier can be any type, as the supplier is responsible for interpreting it.
 * However, it is *essential* that the identifier is treated as immutable, because it is used as a lookup key in a sorted collection; changes to its properties may affect comparison and therefore sorting order.
 * @internal
 */
export interface TileTreeSupplier {
  /** Compare two tree Ids returning a negative number if lhs < rhs, a positive number if lhs > rhs, or 0 if the Ids are equivalent. */
  compareTileTreeIds(lhs: any, rhs: any): number;

  /** Produce the TileTree corresponding to the specified tree Id. The returned TileTree will be associated with its Id in a Map. */
  createTileTree(id: any, iModel: IModelConnection): Promise<TileTree | undefined>;
}
