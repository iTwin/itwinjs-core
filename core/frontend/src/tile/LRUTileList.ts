/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ReadonlySortedArray, SortedArray } from "@itwin/core-bentley";
import { RenderMemory } from "../render/RenderMemory";
import { RealityTile, Tile } from "./internal";

/** Maintains in sorted order a set of [[TileUser]] Ids for which a given tile has been selected for display. The number of users in a set is expected to be very small - often only 1 for a typical application.
 * Strictly for use by LRUTileList.
 * @see TileUserIdSets.
 * @internal
 */
export class TileUserIdSet extends ReadonlySortedArray<number> {
  public constructor(userId?: number) {
    super((lhs, rhs) => lhs - rhs);
    if (undefined !== userId)
      this._array.push(userId);
  }

  public equals(set: TileUserIdSet): boolean {
    if (this.length !== set.length)
      return false;

    for (let i = 0; i < this.length; i++)
      if (this._array[i] !== set._array[i])
        return false;

    return true;
  }

  public add(userId: number): void {
    this._insert(userId);
  }

  public drop(userId: number): void {
    this._remove(userId);
  }

  public clear(): void {
    this._clear();
  }

  public copyFrom(src: TileUserIdSet): void {
    this._array.length = src.length;
    let i = 0;
    for (const userId of src)
      this._array[i++] = userId;
  }

  public clone(): TileUserIdSet {
    const clone = new TileUserIdSet();
    clone.copyFrom(this);
    return clone;
  }
}

/** Maintains a set of TileUserIdSets such that each set represents a unique combination of TileUser ids and each set contains at least one TileUser id.
 * Exported strictly for tests.
 * @see LRUTileList.
 * @internal
 */
export class TileUserIdSets extends SortedArray<TileUserIdSet> {
  private readonly _scratch = new TileUserIdSet();

  public constructor() {
    super((lhs, rhs) => {
      if (lhs === rhs)
        return 0;

      let diff = lhs.length - rhs.length;
      if (0 !== diff)
        return diff;

      for (let i = 0; i < lhs.length; i++) {
        const lhId = lhs.get(i)!;
        const rhId = rhs.get(i)!;
        diff = lhId - rhId;
        if (0 !== diff)
          return diff;
      }

      return 0;
    });
  }

  /** Remove the specified TileUser Id from all sets and remove empty and duplicate sets. */
  public drop(userId: number): void {
    // Remove from all sets, and delete empty sets.
    let i = 0;
    for (/* */; i < this._array.length; i++) {
      const set = this._array[i];
      set.drop(userId);
      if (set.length === 0)
        this._array.splice(i, 1);
    }

    // Collapse equivalent sets.
    i = 0;
    for (let j = 1; j < this._array.length; /* */) {
      if (this._array[i].equals(this._array[j])) {
        this._array.splice(i, 1);
      } else {
        i++;
        j++;
      }
    }
  }

  /** Obtain a TileUserIdSet owned by this object containing userId and (if specified) userIds. */
  public plus(userId: number, userIds?: TileUserIdSet): TileUserIdSet {
    const scratch = this.scratch(userIds);
    scratch.add(userId);
    return this.getEquivalent(scratch);
  }

  /** Obtain a TileUserIdSet owned by this object containing all of userIds (if specified) but not userId. Returns undefined if the resultant set would be empty. */
  public minus(userId: number, userIds?: TileUserIdSet): TileUserIdSet | undefined {
    const scratch = this.scratch(userIds);
    scratch.drop(userId);
    return scratch.length > 0 ? this.getEquivalent(scratch) : undefined;
  }

  private scratch(userIds?: TileUserIdSet): TileUserIdSet {
    const scratch = this._scratch;
    if (userIds)
      scratch.copyFrom(userIds);
    else
      scratch.clear();

    return scratch;
  }

  private getEquivalent(sought: TileUserIdSet): TileUserIdSet {
    assert(sought.length > 0);

    for (const set of this)
      if (set.equals(sought))
        return set;

    const newSet = sought.clone();
    this.insert(newSet);
    return newSet;
  }
}

/** A node in an LRUTileList. It is either a [[Tile]], or a sentinel node used to partition the list.
 * Strictly for use by LRUTileList.
 * @internal
 */
export interface LRUTileListNode {
  previous?: LRUTileListNode;
  next?: LRUTileListNode;
  /** The number of bytes of GPU memory allocated to the tile's content. The only node in a LRUTileListNode with `bytesUsed` less than 1 is the sentinel node. */
  bytesUsed: number;
  /** For a tile, the Ids of all of the TileUsers for which the tile is currently in use. The TileUserIdSet is owned by the LRUTileList's TileUserIdSets member.
   * Undefined if the tile is not in use by any TileUser.
   */
  tileUserIds?: TileUserIdSet | undefined;
}

function isLinked(node: LRUTileListNode): boolean {
  return undefined !== node.previous || undefined !== node.next;
}

function* lruListIterator(start: Tile | undefined, end: LRUTileListNode | undefined): Iterator<Tile> {
  let cur = start;
  while (cur && cur !== end) {
    const prev = cur;
    cur = cur.next as Tile | undefined;
    yield prev;
  }
}

/** An intrusive doubly-linked list of LRUTileListNodes, containing Tiles partitioned by a singleton sentinel node into two partitions and ordered from least-recently- to most-recently-used by any TileUser.
 * Used by TileAdmin to keep track of and impose limits upon the total amount of GPU memory allocated to tile content.
 *
 * Illustration of the structure of the list:
 *
 * ```
 * v------------- Not selected --------------v                                v----------------- Selected ------------------v
 *   ______               ______                           __________                           ______               ______
 *  | head |.next =>     |      |.next => ...             | sentinel |.next => ...             |      |.next =>     | tail |
 *  | 12kb |             |  8kb |                         |   0kb    |                         | 19kb |             | 23kb |
 *  |______| <= previous.|______|         ... <= previous.|__________|         ... <= previous.|______| <= previous.|______|
 *
 * least-recently-selected --> --> --> --> --> --> --> --> --> --> --> --> --> --> --> --> --> --> --> most-recently-selected
 * ```
 *
 * The sentinel node is always present and floats freely as the contents of each partition change. Note that the `next` and `previous` pointers are stored directly on the tiles - no link nodes are allocated to hold the entries in the list. This of course means that a Tile can only ever belong to one LRUTileList - the one owned by the TileAdmin.
 *
 * The list contains only those tiles whose content has been loaded. Each node records the amount of GPU memory allocated for the tile's content. The list keeps track of the total amount of GPU memory allocated by all tiles. The list's contents are updated as follows:
 *
 * - When a tile's content is loaded, it is added to the end of the "not selected" partition. Its memory usage is computed and added to the list's total.
 * - When a tile's content is unloaded, it is removed from the list. Its memory usage is deducted from the list's totla.
 * - Just before a TileUser selects tiles for use (e.g., Viewport selects tiles for display), it is removed from each tile's set of viewports in which they are selected. If a tile's set of users becomes empty as a result, it is moved to the end of the "not selected" partition.
 * - When a tile becomes selected for use by a TileUser, the user is added to its user set and the tile is moved to the end of the "selected" partition.
 *
 * When the system determines that GPU memory should be freed up, it can simply pop nodes off the beginning of the "not selected" partition, freeing their content, until the target memory usage is reached or no more non-selected nodes exist.
 *
 * Strictly for use by [[TileAdmin]].
 * @internal
 */
export class LRUTileList {
  protected readonly _sentinel: LRUTileListNode;
  protected readonly _stats = new RenderMemory.Statistics();
  protected readonly _userIdSets = new TileUserIdSets();
  protected _head: LRUTileListNode;
  protected _tail: LRUTileListNode;
  protected _totalBytesUsed = 0;

  /** The amount of GPU memory, in bytes, allocated to all tiles in the list. */
  public get totalBytesUsed(): number {
    return this._totalBytesUsed;
  }

  public constructor() {
    this._head = this._tail = this._sentinel = { bytesUsed: 0 };
  }

  public dispose(): void {
    let node: LRUTileListNode | undefined = this._head;
    let next: LRUTileListNode | undefined;
    while (node) {
      next = node.next;
      node.previous = node.next = undefined;
      node.bytesUsed = 0;
      node.tileUserIds = undefined;
      node = next;
    }

    this._head = this._tail = this._sentinel;
    this._totalBytesUsed = 0;
    this._userIdSets.clear();
  }

  /** Compute the amount of GPU memory allocated to the tile's content and, if greater than zero, add the tile to the beginning of the "selected" partition.
   * Invoked by TileAdmin whenever a tile's content is set to a valid RenderGraphic.
   */
  public add(tile: Tile): void {
    assert(!isLinked(tile));
    if (isLinked(tile))
      return;

    assert(tile.bytesUsed === 0);
    assert(tile.tileUserIds === undefined);

    this._stats.clear();
    tile.collectStatistics(this._stats, false);
    tile.bytesUsed = this.computeBytesUsed(tile);
    assert(tile.bytesUsed >= 0);
    assert(tile.bytesUsed === Math.floor(tile.bytesUsed));

    if (tile.bytesUsed <= 0)
      return;

    // Insert just after the sentinel, indicating this is the least-recently-used selected tile.
    this._totalBytesUsed += tile.bytesUsed;
    this.append(tile);
    this.moveAfterSentinel(tile);
  }

  /** Remove the tile from the list and deduct its previously-used GPU memory from the list's running total.
   * Invoked by TileAdmin when a tile's content is unloaded, including when the list itself disposes of the content in its `freeMemory` method.
   */
  public drop(tile: Tile): void {
    assert(isLinked(tile) || tile.bytesUsed === 0);
    if (!isLinked(tile))
      return;

    assert(tile.bytesUsed > 0);
    this._totalBytesUsed -= tile.bytesUsed;
    assert(this._totalBytesUsed >= 0);

    this.unlink(tile);
    tile.tileUserIds = undefined;
    tile.bytesUsed = 0;

    this.assertList();
  }

  /** Mark the tiles as in use by the specified TileUser. They are moved to the end of the "selected" partition. */
  public markUsed(userId: number, tiles: Iterable<Tile>): void {
    for (const tile of tiles) {
      if (tile.bytesUsed <= 0)
        continue;

      assert(isLinked(tile));

      if (isLinked(tile)) {
        tile.tileUserIds = this._userIdSets.plus(userId, tile.tileUserIds);
        this.moveToEnd(tile);
      }
    }
  }

  /** Mark the tiles as no longer in user by the specified TileUser.
   * If this results in a tile being no longer selected for any user, it is moved to the end of the "not selected" partition.
   */
  public clearUsed(userId: number): void {
    this._userIdSets.drop(userId);
    let prev: LRUTileListNode | undefined = this._sentinel;
    while (prev && prev.next) {
      const tile = prev.next as Tile;
      assert(tile !== this._sentinel);
      tile.tileUserIds = this._userIdSets.minus(userId, tile.tileUserIds);
      if (undefined === tile.tileUserIds)
        this.moveBeforeSentinel(tile);
      else
        prev = tile;
    }
  }

  /** Dispose of the contents of tiles currently not selected for display until the total amount of memory consumed is no more than `maxBytes`
   * or until the contents of all un-selected tiles have been disposed.
   */
  public freeMemory(maxBytes: number): void {
    let prev: LRUTileListNode | undefined = this._head;
    while (prev && prev !== this._sentinel && this.totalBytesUsed > maxBytes) {
      const tile = prev as Tile;
      prev = tile.next;
      // prevent freeing if AdditiveRefinementStepChildren are in play, as they depend on the parent tile to draw
      if (!tile.children || !tile.children.some((child) => (child as RealityTile).isStepChild))
        tile.freeMemory();

      // Some tiles (ImageryMapTile) use reference-counting, in which case freeMemory() may not actually free the contents.
      // If the contents *were* disposed, then `this.drop` will have been called, and `tile` is no longer in the list.
      // Otherwise, `tile` remains in the list. Either way, we proceed to the next entry in the list.
      assert((this.computeBytesUsed(tile) > 0) === isLinked(tile));
    }
  }

  /** Iterate over all of the tiles in the unselected partition. */
  public get unselectedTiles(): Iterable<Tile> {
    const start = this._head === this._sentinel ? undefined : this._head as Tile | undefined;
    return {
      [Symbol.iterator]: () => lruListIterator(start, this._sentinel),
    };
  }

  /** Iterate over all of the tiles in the selected partition. */
  public get selectedTiles(): Iterable<Tile> {
    return {
      [Symbol.iterator]: () => lruListIterator(this._sentinel.next as Tile | undefined, undefined),
    };
  }

  protected computeBytesUsed(tile: Tile): number {
    this._stats.clear();
    tile.collectStatistics(this._stats, false);
    return this._stats.totalBytes;
  }

  protected assertList(): void {
    assert(this._head !== undefined);
    assert(this._tail !== undefined);
  }

  protected append(tile: Tile): void {
    assert(!isLinked(tile));
    if (isLinked(tile))
      this.unlink(tile);

    this._tail.next = tile;
    tile.previous = this._tail;
    this._tail = tile;
  }

  protected unlink(tile: Tile): void {
    assert(isLinked(tile));
    if (!isLinked(tile))
      return;

    if (tile.next && tile.previous) {
      assert(tile !== this._head);
      assert(tile !== this._tail);
      assert(tile.previous.next === tile);
      assert(tile.next.previous === tile);

      tile.previous.next = tile.next;
      tile.next.previous = tile.previous;
    } else if (tile.previous) {
      assert(tile === this._tail);
      assert(undefined === tile.next);
      assert(tile.previous.next === tile);

      tile.previous.next = undefined;
      this._tail = tile.previous;
    } else {
      assert(tile === this._head);
      assert(undefined !== tile.next);
      assert(tile.next.previous === tile);

      tile.next.previous = undefined;
      this._head = tile.next;
    }

    tile.next = tile.previous = undefined;
    this.assertList();
  }

  protected moveToEnd(tile: Tile): void {
    this.unlink(tile);
    this.append(tile);
  }

  protected moveBeforeSentinel(tile: Tile): void {
    this.unlink(tile);
    tile.previous = this._sentinel.previous;
    this._sentinel.previous = tile;
    tile.next = this._sentinel;

    if (!tile.previous)
      this._head = tile;
    else
      tile.previous.next = tile;
  }

  protected moveAfterSentinel(tile: Tile): void {
    this.unlink(tile);
    tile.next = this._sentinel.next;
    this._sentinel.next = tile;
    tile.previous = this._sentinel;

    if (!tile.next)
      this._tail = tile;
    else
      tile.next.previous = tile;
  }
}
