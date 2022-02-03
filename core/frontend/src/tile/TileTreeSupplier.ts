/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "../IModelConnection";
import type { TileTree, TileTreeOwner } from "./internal";

/** Interface adopted by an object which can supply a [[TileTree]] for rendering.
 * A supplier can supply any number of tile trees; the only requirement is that each tile tree has a unique identifier within the context of the supplier and a single IModelConnection.
 * The identifier can be any type, as only the supplier needs to be able to interpret it.
 * However, it is *essential* that the identifier is treated as immutable, because it is used as a lookup key in a sorted collection -
 * changes to its properties may affect comparison and therefore sorting order.
 * @see [[Tiles.getTileTreeOwner]] to obtain a tile tree from a supplier.
 * @public
 */
export interface TileTreeSupplier {
  /** Compare two tree Ids returning a negative number if `lhs` < rhs, a positive number if `lhs` > rhs, or 0 if the Ids are equivalent. */
  compareTileTreeIds(lhs: any, rhs: any): number;

  /** Produce the TileTree corresponding to the specified tree Id. The returned TileTree will be associated with its Id in a Map. */
  createTileTree(id: any, iModel: IModelConnection): Promise<TileTree | undefined>;

  /** `true` if this supplier is dependent upon the [[IModelConnection]]'s [EcefLocation]($common).
   * Typically this returns true for suppliers of tile trees for map tiles.
   * When the IModelConnection's ECEF location is modified (a relatively rare occurrence), all tile trees supplied by this supplier will be discarded, to be recreated using
   * the updated ECEF location whenever they are next requested.
   */
  readonly isEcefDependent?: true;

  /** Given the set of trees belonging to this supplier, add the modelIds associated with any trees that are animated by
   * the schedule script hosted by the specified RenderTimeline or DisplayStyle element.
   * @see [[Tiles.updateForScheduleScript]].
   * @internal
   */
  addModelsAnimatedByScript?: (modelIds: Set<Id64String>, scriptSourceId: Id64String, trees: Iterable<{ id: any, owner: TileTreeOwner }>) => void;

  /** Given the set of trees belonging to this supplier, add the modelIds associated with any trees representing spatial models.
   * @see [[Tiles.getSpatialModels]].
   * @internal
   */
  addSpatialModels?: (modelIds: Set<Id64String>, trees: Iterable<{ id: any, owner: TileTreeOwner }>) => void;
}
