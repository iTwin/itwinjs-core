/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { IModelConnection } from "../IModelConnection";
import { Viewport } from "../Viewport";
import { DisclosedTileTreeSet, TileRequest } from "./internal";

/** Represents some object that makes use of [[Tile]]s in some way - e.g., by requesting and/or displaying their contents, querying their geometry, etc.
 * Each [[Tile]] keeps track of its users via its [[TileUsageMarker]]. A tile with no users is eligible to be discarded view [[Tile.prune]].
 * Every [[Viewport]] is a tile user. It is occasionally useful to have a tile user that is **not** a viewport.
 * Every TileUser is identified by an integer Id that is unique among all extant TileUsers. This Id **must** be obtained via [[TileUser.generateId]].
 * Every TileUser must be registered with [[IModelApp.tileAdmin]] before use via [[TileAdmin.registerUser]] and unregistered via [[TileAdmin.forgetUser]] after
 * it ceases using tiles.
 * @public
 */
export interface TileUser {
  /** A unique integer identifying this user amongst all extant users. This Id **must** be obtained via [[TIleUser.generateId]]. */
  readonly tileUserId: number;
  /** The iModel with which the user is associated. */
  readonly iModel: IModelConnection;
  /** Disclose all tile trees currently in use by this user. Any tile tree not disclosed by any user becomes eligible for garbage collection. */
  readonly discloseTileTrees: (trees: DisclosedTileTreeSet) => void;
  /** An optional function invoked when a [[TileRequest]] associated with a [[Tile]] in use by this user changes state - e.g., when the request completes, fails, or
   * is cancelled. For example, a [[Viewport]] responds to such events by invalidating its scene.
   */
  readonly onRequestStateChanged?: (req: TileRequest) => void;
}

let nextUserId = 1;

/** @public */
export namespace TileUser {
  export function generateId(): number {
    return nextUserId++;
  }

  /** Iterate the subset of `users` that are [[Viewport]]s. */
  export function* viewportsFromUsers(users: Iterable<TileUser>): Iterable<Viewport> {
    for (const user of users) if (user instanceof Viewport) yield user;
  }
}
