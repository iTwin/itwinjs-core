/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import type { OrderedComparator} from "@itwin/core-bentley";
import { OrderedSet } from "@itwin/core-bentley";
import type { TileTree } from "./internal";

/** Interface adopted by an object that contains references to [[TileTree]]s, to expose those trees.
 * @see [[DisclosedTileTreeSet]].
 * @public
 */
export interface TileTreeDiscloser {
  /** Add all [[TileTree]]s referenced by this object to the set. */
  discloseTileTrees: (trees: DisclosedTileTreeSet) => void;
}

/** A set of [[TileTree]]s disclosed by a set of objects implementing [[TileTreeDiscloser]], used to collect references to tile trees in use by those objects.
 * @public
 */
export class DisclosedTileTreeSet implements Iterable<TileTree> {
  private readonly _processed = new Set<TileTreeDiscloser>();
  private readonly _trees: Set<TileTree> | OrderedSet<TileTree>;

  /** Construct a new set.
   * @param comparator If supplied, a comparison function used to determine the order of iteration of the set; otherwise, iteration will proceed in insertion order.
   */
  public constructor(comparator?: OrderedComparator<TileTree, TileTree>) {
    this._trees = comparator ? new OrderedSet<TileTree>(comparator) : new Set<TileTree>();
  }

  /** Returns true if the specified tree has been [[add]]ed to the set. */
  public has(tree: TileTree): boolean {
    return this._trees.has(tree);
  }

  /** Adds the specified tree to the set. */
  public add(tree: TileTree): void {
    this._trees.add(tree);
  }

  /** Iterates all trees in the set.
   * @note Do not [[add]] to the set during iteration.
   */
  public [Symbol.iterator](): Iterator<TileTree> {
    return this._trees[Symbol.iterator]();
  }

  /** The number of trees in the set. */
  public get size(): number {
    return this._trees.size;
  }

  /** Add all tile trees referenced by `discloser` to the set. */
  public disclose(discloser: TileTreeDiscloser): void {
    if (this._processed.has(discloser))
      return;

    this._processed.add(discloser);
    discloser.discloseTileTrees(this);
  }

  /** Clear the contents of this set. */
  public clear(): void {
    this._processed.clear();
    this._trees.clear();
  }
}
