/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { RenderMemory } from "../../render/RenderMemory";
import { LRUTileList, LRUTileListNode, Tile } from "../../tile/internal";

function mockTile(bytesUsed: number): Tile {
  return {
    bytesUsed: 0,
    collectStatistics: (stats: RenderMemory.Statistics) => stats.addTexture(bytesUsed),
  } as unknown as Tile;
}

class List extends LRUTileList {
  public get sentinel() {
    return this._sentinel;
  }
  public get head() {
    return this._head;
  }
  public get tail() {
    return this._tail;
  }
  public override get totalBytesUsed() {
    return this._totalBytesUsed;
  }

  public expectOrder(...expected: LRUTileListNode[]): void {
    expect(this.head.previous).toBeUndefined();
    expect(this.tail.next).toBeUndefined();
    const actual = [];
    for (let node: LRUTileListNode | undefined = this.head; node !== undefined; node = node.next)
      actual.push(node);

    expect(actual.length).toEqual(expected.length);
    for (let i = 0; i < actual.length; i++)
      expect(actual[i]).toEqual(expected[i]);

    let j = actual.length;
    for (let node: LRUTileListNode | undefined = this.tail; node !== undefined; node = node.previous) {
      expect(j).greaterThan(0);
      expect(actual[--j]).toEqual(node);
    }

    expect(j).toEqual(0);
  }

  public moveTileToEnd(tile: Tile) {
    this.moveToEnd(tile);
  }
  public moveTileBeforeSentinel(tile: Tile) {
    this.moveBeforeSentinel(tile);
  }
  public moveTileAfterSentinel(tile: Tile) {
    this.moveAfterSentinel(tile);
  }
}

function expectUnlinked(node: LRUTileListNode): void {
  expect(node.previous).toBeUndefined();
  expect(node.next).toBeUndefined();
}

describe("LRUTileList", () => {
  it("adds and removes nodes", () => {
    const list = new List();
    expect(list.head).toEqual(list.sentinel);
    expect(list.tail).toEqual(list.sentinel);
    expect(list.sentinel.previous).toBeUndefined();
    expect(list.sentinel.next).toBeUndefined();

    const tiles: Tile[] = [];
    for (let i = 0; i < 5; i++) {
      const tile = mockTile(i + 1);
      tiles.push(tile);
      list.add(tile);

      expect(list.head).toEqual(list.sentinel);
      expect(list.tail).toEqual(tiles[0]);
      expect(tile.previous).toEqual(list.sentinel);
      expect(tile.next).toEqual(i > 0 ? tiles[i - 1] : undefined);
      if (tile.next)
        expect(tile.next.previous).toEqual(tile);
    }

    list.expectOrder(list.sentinel, tiles[4], tiles[3], tiles[2], tiles[1], tiles[0]);

    list.drop(tiles[3]);
    expectUnlinked(tiles[3]);
    expect(tiles[2].previous).toEqual(tiles[4]);
    expect(tiles[4].next).toEqual(tiles[2]);
    list.expectOrder(list.sentinel, tiles[4], tiles[2], tiles[1], tiles[0]);

    list.drop(tiles[4]);
    expectUnlinked(tiles[4]);
    list.expectOrder(list.sentinel, tiles[2], tiles[1], tiles[0]);

    expect(list.tail).toEqual(tiles[0]);
    list.drop(tiles[0]);
    expectUnlinked(tiles[0]);
    expect(list.tail).toEqual(tiles[1]);
    list.expectOrder(list.sentinel, tiles[2], tiles[1]);
  });

  it("ignores empty nodes", () => {
    const list = new List();
    const tile = mockTile(0);
    list.add(tile);
    expect(list.tail).toEqual(list.sentinel);
    expect(list.head).toEqual(list.sentinel);
    expectUnlinked(tile);
  });

  it("moves nodes", () => {
    const t1 = mockTile(1);
    const t2 = mockTile(2);
    const t3 = mockTile(3);
    const t4 = mockTile(4);

    const list = new List();
    const s = list.sentinel;

    list.add(t1);
    list.moveTileBeforeSentinel(t1);
    list.expectOrder(t1, s);
    list.moveTileToEnd(t1);
    list.expectOrder(s, t1);

    list.add(t2);
    list.expectOrder(s, t2, t1);
    list.moveTileToEnd(t2);
    list.expectOrder(s, t1, t2);
    list.moveTileBeforeSentinel(t1);
    list.expectOrder(t1, s, t2);
    list.moveTileBeforeSentinel(t2);
    list.expectOrder(t1, t2, s);
    list.moveTileAfterSentinel(t1);
    list.expectOrder(t2, s, t1);
    list.moveTileAfterSentinel(t2);
    list.expectOrder(s, t2, t1);

    list.add(t3);
    list.add(t4);
    list.expectOrder(s, t4, t3, t2, t1);
    list.moveTileBeforeSentinel(t1);
    list.expectOrder(t1, s, t4, t3, t2);
    list.moveTileBeforeSentinel(t2);
    list.expectOrder(t1, t2, s, t4, t3);
    list.moveTileBeforeSentinel(t3);
    list.expectOrder(t1, t2, t3, s, t4);
    list.moveTileToEnd(t2);
    list.expectOrder(t1, t3, s, t4, t2);

    // No-op
    list.moveTileToEnd(t2);
    list.expectOrder(t1, t3, s, t4, t2);

    // No-op
    list.moveTileToEnd(t1);
    list.expectOrder(t3, s, t4, t2, t1);
    list.moveTileBeforeSentinel(t3);
    list.expectOrder(t3, s, t4, t2, t1);
  });

  it("updates when selected tiles change", () => {
    const vp1 = 1;
    const vp2 = 2;
    const t1 = mockTile(1);
    const t2 = mockTile(2);
    const t3 = mockTile(3);
    const t4 = mockTile(4);

    const list = new List();
    const s = list.sentinel;
    list.add(t1);
    list.moveTileBeforeSentinel(t1);
    list.add(t2);
    list.moveTileBeforeSentinel(t2);
    list.add(t3);
    list.moveTileBeforeSentinel(t3);
    list.add(t4);
    list.moveTileBeforeSentinel(t4);
    list.expectOrder(t1, t2, t3, t4, s);

    list.markUsed(vp1, [t1, t2]);
    list.expectOrder(t3, t4, s, t1, t2);
    expect(t1.tileUserIds).toBeDefined();
    expect(t2.tileUserIds).toBeDefined();
    expect(t3.tileUserIds).toBeUndefined();
    expect(t4.tileUserIds).toBeUndefined();

    list.markUsed(vp2, [t1, t4]);
    list.expectOrder(t3, s, t2, t1, t4);
    expect(t1.tileUserIds).toBeDefined();
    expect(t2.tileUserIds).toBeDefined();
    expect(t3.tileUserIds).toBeUndefined();
    expect(t4.tileUserIds).toBeDefined();

    list.clearUsed(vp1);
    list.expectOrder(t3, t2, s, t1, t4);
    expect(t1.tileUserIds).toBeDefined();
    expect(t2.tileUserIds).toBeUndefined();
    expect(t3.tileUserIds).toBeUndefined();
    expect(t4.tileUserIds).toBeDefined();

    list.markUsed(vp1, [t3, t4, t2]);
    list.expectOrder(s, t1, t3, t4, t2);
    expect(t1.tileUserIds).toBeDefined();
    expect(t2.tileUserIds).toBeDefined();
    expect(t3.tileUserIds).toBeDefined();
    expect(t4.tileUserIds).toBeDefined();

    list.clearUsed(vp2);
    list.expectOrder(t1, s, t3, t4, t2);
    expect(t1.tileUserIds).toBeUndefined();
    expect(t2.tileUserIds).toBeDefined();
    expect(t3.tileUserIds).toBeDefined();
    expect(t4.tileUserIds).toBeDefined();

    list.clearUsed(vp1);
    list.expectOrder(t1, t3, t4, t2, s);
    expect(t1.tileUserIds).toBeUndefined();
    expect(t2.tileUserIds).toBeUndefined();
    expect(t3.tileUserIds).toBeUndefined();
    expect(t4.tileUserIds).toBeUndefined();
  });

  it("iterates over partitions", () => {
    const list = new List();

    function expectPartition(which: "selected" | "unselected", ...expected: LRUTileListNode[]): void {
      const actual = Array.from("selected" === which ? list.selectedTiles : list.unselectedTiles);
      expect(actual.length).toEqual(expected.length);
      for (let i = 0; i < actual.length; i++)
        expect(actual[i]).toEqual(expected[i]);
    }

    function expectSelected(...expected: LRUTileListNode[]) {
      expectPartition("selected", ...expected);
    }

    function expectUnselected(...expected: LRUTileListNode[]) {
      expectPartition("unselected", ...expected);
    }

    expectSelected();
    expectUnselected();

    const t1 = mockTile(1);
    const t2 = mockTile(2);
    const t3 = mockTile(3);
    list.add(t1);
    expectSelected(t1);
    list.add(t2);
    expectSelected(t2, t1);
    list.add(t3);
    expectSelected(t3, t2, t1);
    list.moveTileBeforeSentinel(t1);
    list.moveTileBeforeSentinel(t2);
    list.moveTileBeforeSentinel(t3);
    expectUnselected(t1, t2, t3);
    list.moveTileToEnd(t1);
    expectUnselected(t2, t3);
    expectSelected(t1);
    list.moveTileToEnd(t2);
    expectUnselected(t3);
    expectSelected(t1, t2);
    list.moveTileToEnd(t3);
    expectUnselected();
    expectSelected(t1, t2, t3);
    list.drop(t3);
    expectUnselected();
    expectSelected(t1, t2);
    list.drop(t1);
    expectUnselected();
    expectSelected(t2);
    list.moveTileBeforeSentinel(t2);
    expectUnselected(t2);
    expectSelected();
    list.drop(t2);
    expectUnselected();
    expectSelected();
  });

  it("accumulates total memory used", () => {
    const list = new List();
    expect(list.totalBytesUsed).toEqual(0);

    const t1 = mockTile(1);
    const t10 = mockTile(10);
    const t100 = mockTile(100);
    list.add(t1);
    list.add(t10);
    list.add(t100);
    expect(list.totalBytesUsed).toEqual(111);

    list.drop(t10);
    expect(list.totalBytesUsed).toEqual(101);

    list.drop(t1);
    expect(list.totalBytesUsed).toEqual(100);

    list.add(t10);
    expect(list.totalBytesUsed).toEqual(110);

    list.drop(t100);
    expect(list.totalBytesUsed).toEqual(10);

    list.drop(t10);
    expect(list.totalBytesUsed).toEqual(0);
  });

  it("disposes", () => {
    const list = new List();
    const tiles = [];
    for (let i = 0; i < 4; i++) {
      tiles.push(mockTile(i + 1));
      list.add(tiles[i]);
      list.moveTileBeforeSentinel(tiles[i]);
    }

    expect(list.head).not.toEqual(list.tail);
    expect(list.tail).toEqual(list.sentinel);
    expect(list.totalBytesUsed).greaterThan(0);

    list.markUsed(1, tiles);
    expect(list.head).toEqual(list.sentinel);
    for (const tile of tiles) {
      expect(tile.previous !== undefined || tile.next !== undefined).toBe(true);
      expect(tile.bytesUsed).greaterThan(0);
      expect(tile.tileUserIds).toBeDefined();
    }

    list.dispose();
    expect(list.head).toEqual(list.sentinel);
    expect(list.tail).toEqual(list.sentinel);
    expect(list.totalBytesUsed).toEqual(0);
    for (const tile of tiles) {
      expectUnlinked(tile);
      expect(tile.tileUserIds).toBeUndefined();
      expect(tile.bytesUsed).toEqual(0);
    }
  });
});
