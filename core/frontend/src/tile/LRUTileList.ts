/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert } from "@bentley/bentleyjs-core";
import { Viewport } from "../Viewport";
import { RenderMemory } from "../render/RenderMemory";
import { Tile } from "./internal";

export interface LRUTileListNode {
  previous?: LRUTileListNode;
  next?: LRUTileListNode;
  bytesUsed: number;
  selectedViewports?: Set<Viewport> | undefined;
}

function isLinked(node: LRUTileListNode): boolean {
  return undefined !== node.previous || undefined !== node.next;
}

export class LRUTileList {
  private readonly _sentinel: LRUTileListNode;
  private readonly _stats = new RenderMemory.Statistics();
  private _head: LRUTileListNode;
  private _tail: LRUTileListNode;
  private _totalBytesUsed = 0;

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
      node.selectedViewports = undefined;
      node = next;
    }

    this._head = this._tail = this._sentinel;
    this._totalBytesUsed = 0;
  }

  public add(tile: Tile): void {
    assert(!isLinked(tile));
    if (isLinked(tile))
      return;

    assert(tile.bytesUsed === 0);
    assert(tile.selectedViewports === undefined);

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
    tile.selectedViewports = undefined;
    tile.bytesUsed = 0;

    this.assertList();
  }

  private assertList(): void {
    assert(this._head !== undefined);
    assert(this._tail !== undefined);
  }

  private append(tile: Tile): void {
    assert(!isLinked(tile));
    if (isLinked(tile))
      this.unlink(tile);

    this._tail.next = tile;
    tile.next = this._tail;
    this._tail = tile;
  }

  private unlink(tile: Tile): void {
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
      assert(undefined !== tile.next);
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

  private moveToEnd(tile: Tile): void {
    this.unlink(tile);
    this.append(tile);
  }

  private moveBeforeSentinel(tile: Tile): void {
    this.unlink(tile);
    tile.previous = this._sentinel.previous;
    this._sentinel.previous = tile;
    tile.next = this._sentinel;

    if (!tile.previous)
      this._head = tile;

    if (!tile.next)
      this._tail = tile;
  }

  public markSelected(_vp: Viewport, tiles: Set<Tile>): void {
    // ###TODO add to viewport sets.
    for (const tile of tiles)
      this.moveToEnd(tile);
  }

  /* ###TODO remove from viewport sets; move all non-selected tiles before sentinel.
  public forgetViewport(vp: Viewport): void {
  }
  */
}
