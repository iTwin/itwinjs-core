/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ReadonlySortedArray, SortedArray } from "@itwin/core-bentley";
import { RenderMemory } from "../render/RenderMemory";
import { Tile } from "./internal";

/** Maintains in sorted order a set of Viewport Ids for which a given tile has been selected for display. The number of viewports in a set is expected to be very small - often only 1 for a typical application.
 * Strictly for use by LRUTileList.
 * @see ViewportIdSets.
 * @internal
 */
export class ViewportIdSet extends ReadonlySortedArray<number> {
  public constructor(viewportId?: number) {
    super((lhs, rhs) => lhs - rhs);
    if (undefined !== viewportId)
      this._array.push(viewportId);
  }

  public equals(set: ViewportIdSet): boolean {
    if (this.length !== set.length)
      return false;

    for (let i = 0; i < this.length; i++)
      if (this._array[i] !== set._array[i])
        return false;

    return true;
  }

  public add(viewportId: number): void {
    this._insert(viewportId);
  }

  public drop(viewportId: number): void {
    this._remove(viewportId);
  }

  public clear(): void {
    this._clear();
  }

  public copyFrom(src: ViewportIdSet): void {
    this._array.length = src.length;
    let i = 0;
    for (const viewportId of src)
      this._array[i++] = viewportId;
  }

  public clone(): ViewportIdSet {
    const clone = new ViewportIdSet();
    clone.copyFrom(this);
    return clone;
  }
}

/** Maintains a set of ViewportIdSets such that each set represents a unique combination of Viewport ids and each set contains at least one Viewport id.
 * Exported strictly for tests.
 * @see LRUTileList.
 * @internal
 */
export class ViewportIdSets extends SortedArray<ViewportIdSet> {
  private readonly _scratch = new ViewportIdSet();

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

  /** Remove the specified viewport Id from all sets and remove empty and duplicate sets. */
  public drop(viewportId: number): void {
    // Remove from all sets, and delete empty sets.
    let i = 0;
    for (/* */; i < this._array.length; i++) {
      const set = this._array[i];
      set.drop(viewportId);
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

  /** Obtain a ViewportIdSet owned by this object containing viewportId and (if specified) viewportIds. */
  public plus(viewportId: number, viewportIds?: ViewportIdSet): ViewportIdSet {
    const scratch = this.scratch(viewportIds);
    scratch.add(viewportId);
    return this.getEquivalent(scratch);
  }

  /** Obtain a ViewportIdSet owned by this object containing all of viewportIds (if specified) but not viewportId. Returns undefined if the resultant set would be empty. */
  public minus(viewportId: number, viewportIds?: ViewportIdSet): ViewportIdSet | undefined {
    const scratch = this.scratch(viewportIds);
    scratch.drop(viewportId);
    return scratch.length > 0 ? this.getEquivalent(scratch) : undefined;
  }

  private scratch(viewportIds?: ViewportIdSet): ViewportIdSet {
    const scratch = this._scratch;
    if (viewportIds)
      scratch.copyFrom(viewportIds);
    else
      scratch.clear();

    return scratch;
  }

  private getEquivalent(sought: ViewportIdSet): ViewportIdSet {
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
  /** For a tile, the Ids of all of the Viewports for which the tile is currently selected for display. The ViewportIdSet is owned by the LRUTileList's ViewportIdSets member.
   * Undefined if the tile is not selected for display in any viewport.
   */
  viewportIds?: ViewportIdSet | undefined;
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

/** An intrusive doubly-linked list of LRUTileListNodes, containing Tiles partitioned by a singleton sentinel node into two partitions and ordered from least-recently- to most-recently-selected for display in any Viewport.
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
 * - Just before a Viewport selects tiles for display, it is removed from each tile's set of viewports in which they are selected. If a tile's set of viewports becomes empty as a result, it is moved to the end of the "not selected" partition.
 * - When a tile becomes selected for display in a Viewport, the viewport is added to its viewport set and the tile is moved to the end of the "selected" partition.
 *
 * When the system determines that GPU memory should be freed up, it can simply pop nodes off the beginning of the "not selected" partition, freeing their content, until the target memory usage is reached or no more non-selected nodes exist.
 *
 * Strictly for use by [[TileAdmin]].
 * @internal
 */
export class LRUTileList {
  protected readonly _sentinel: LRUTileListNode;
  protected readonly _stats = new RenderMemory.Statistics();
  protected readonly _viewportIdSets = new ViewportIdSets();
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
      node.viewportIds = undefined;
      node = next;
    }

    this._head = this._tail = this._sentinel;
    this._totalBytesUsed = 0;
    this._viewportIdSets.clear();
  }

  /** Compute the amount of GPU memory allocated to the tile's content and, if greater than zero, add the tile to the end of the "not selected" partition.
   * Invoked by TileAdmin whenever a tile's content is set to a valid RenderGraphic.
   */
  public add(tile: Tile): void {
    assert(!isLinked(tile));
    if (isLinked(tile))
      return;

    assert(tile.bytesUsed === 0);
    assert(tile.viewportIds === undefined);

    this._stats.clear();
    tile.collectStatistics(this._stats, false);
    tile.bytesUsed = this.computeBytesUsed(tile);
    assert(tile.bytesUsed >= 0);
    assert(tile.bytesUsed === Math.floor(tile.bytesUsed));

    if (tile.bytesUsed <= 0)
      return;

    // Insert just before the sentinel, indicating this is the most-recently-used non-selected tile.
    this._totalBytesUsed += tile.bytesUsed;
    this.append(tile);
    this.moveBeforeSentinel(tile);
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
    tile.viewportIds = undefined;
    tile.bytesUsed = 0;

    this.assertList();
  }

  /** Mark the tiles as selected for display in the specified Viewport. They are moved to the end of the "selected" partition. */
  public markSelectedForViewport(viewportId: number, tiles: Iterable<Tile>): void {
    for (const tile of tiles) {
      if (tile.bytesUsed <= 0)
        continue;

      assert(isLinked(tile));

      if (isLinked(tile)) {
        tile.viewportIds = this._viewportIdSets.plus(viewportId, tile.viewportIds);
        this.moveToEnd(tile);
      }
    }
  }

  /** Mark the tiles as no longer selected for display in the specified Viewport.
   * If this results in a tile being no longer selected for any viewport, it is moved to the end of the "not selected" partition.
   */
  public clearSelectedForViewport(viewportId: number): void {
    this._viewportIdSets.drop(viewportId);
    let prev: LRUTileListNode | undefined = this._sentinel;
    while (prev && prev.next) {
      const tile = prev.next as Tile;
      assert(tile !== this._sentinel);
      tile.viewportIds = this._viewportIdSets.minus(viewportId, tile.viewportIds);
      if (undefined === tile.viewportIds)
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
}
