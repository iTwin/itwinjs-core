/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ReadonlySortedArray, SortedArray } from "@bentley/bentleyjs-core";
import { RenderMemory } from "../render/RenderMemory";
import { Tile } from "./internal";

/** Maintains in sorted order a set of Viewport Ids for which a given tile has been selected for display.
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

  public drop(viewportId: number): void {
    // Remove from all sets, and delete empty sets.
    for (let i = 0; i < this._array.length; i++) {
      const set = this._array[i];
      set.drop(viewportId);
      if (set.length === 0)
        this._array.splice(i, 1);
    }

    // Collapse equivalent sets.
    let i = 0;
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
  bytesUsed: number;
  /** For a tile, the Ids of all of the Viewports for which the tile is currently selected for display. The ViewportIdSet is owned by the LRUTileList's ViewportIdSets member.
   * Undefined if the tile is not selected for display in any viewport.
   */
  viewportIds?: ViewportIdSet | undefined;
}

function isLinked(node: LRUTileListNode): boolean {
  return undefined !== node.previous || undefined !== node.next;
}

/** A doubly-linked list of LRUTileListNodes, containing Tiles partitioned by a singleton sentinel node into two partitions and ordered from least-recently- to most-recently-selected for display in any Viewport.
 *
 * Illustration of the structure of the list:
 *
 * ```
 * v------------- Not selected --------------v                                v----------------- Selected ------------------v
 *   ______               ______                           __________                           ______               ______
 *  |      |.next =>     |      |.next => ...             |          |.next => ...             |      |.next =>     |      |
 *  | head |             |      |                         | sentinel |                         |      |             | tail |
 *  |______| <= previous.|______|         ... <= previous.|__________|         ... <= previous.|______| <= previous.|______|
 *
 * least-recently-selected --> --> --> --> --> --> --> --> --> --> --> --> --> --> --> --> --> --> --> most-recently-selected
 * ```
 *
 * The sentinel node is always present and floats freely as the contents of each partition change.
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

  public add(tile: Tile): void {
    assert(!isLinked(tile));
    if (isLinked(tile))
      return;

    assert(tile.bytesUsed === 0);
    assert(tile.viewportIds === undefined);

    this._stats.clear();
    tile.collectStatistics(this._stats, false);
    tile.bytesUsed = this._stats.totalBytes;
    assert(tile.bytesUsed >= 0);
    assert(tile.bytesUsed === Math.floor(tile.bytesUsed));

    if (tile.bytesUsed <= 0)
      return;

    // Insert just before the sentinel, indicating this is the most-recently-used non-selected tile.
    this._totalBytesUsed += tile.bytesUsed;
    this.append(tile);
    this.moveBeforeSentinel(tile);
  }

  public drop(tile: Tile): void {
    assert(isLinked(tile));
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

  public markSelectedForViewport(viewportId: number, tiles: Iterable<Tile>): void {
    for (const tile of tiles) {
      assert(isLinked(tile));
      assert(tile.bytesUsed > 0);

      if (isLinked(tile)) {
        tile.viewportIds = this._viewportIdSets.plus(viewportId, tile.viewportIds);
        this.moveToEnd(tile);
      }
    }
  }

  public clearSelectedForViewport(viewportId: number): void {
    this._viewportIdSets.drop(viewportId);
    for (let node = this._sentinel.next; node !== undefined; node = node.next) {
      assert(node instanceof Tile);
      node.viewportIds = this._viewportIdSets.minus(viewportId, node.viewportIds);
      if (undefined === node.viewportIds)
        this.moveBeforeSentinel(node);
    }
  }
}
