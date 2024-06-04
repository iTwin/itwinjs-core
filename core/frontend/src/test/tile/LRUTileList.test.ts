/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { RenderMemory } from "../../render/RenderMemory";
import { LRUTileList, LRUTileListNode, Tile } from "../../tile/internal";

function mockTile(bytesUsed: number): Tile {
  return {
    bytesUsed: 0,
    collectStatistics: (stats: RenderMemory.Statistics) => stats.addTexture(bytesUsed),
  } as unknown as Tile;
}

class List extends LRUTileList {
  public get sentinel() { return this._sentinel; }
  public get head() { return this._head; }
  public get tail() { return this._tail; }
  public override get totalBytesUsed() { return this._totalBytesUsed; }

  public expectOrder(...expected: LRUTileListNode[]): void {
    expect(this.head.previous).to.be.undefined;
    expect(this.tail.next).to.be.undefined;
    const actual = [];
    for (let node: LRUTileListNode | undefined = this.head; node !== undefined; node = node.next)
      actual.push(node);

    expect(actual.length).to.equal(expected.length);
    for (let i = 0; i < actual.length; i++)
      expect(actual[i]).to.equal(expected[i]);

    let j = actual.length;
    for (let node: LRUTileListNode | undefined = this.tail; node !== undefined; node = node.previous) {
      expect(j).greaterThan(0);
      expect(actual[--j]).to.equal(node);
    }

    expect(j).to.equal(0);
  }

  public moveTileToEnd(tile: Tile) { this.moveToEnd(tile); }
  public moveTileBeforeSentinel(tile: Tile) { this.moveBeforeSentinel(tile); }
  public moveTileAfterSentinel(tile: Tile) { this.moveAfterSentinel(tile); }
}

function expectUnlinked(node: LRUTileListNode): void {
  expect(node.previous).to.be.undefined;
  expect(node.next).to.be.undefined;
}

describe("LRUTileList", () => {
  it("adds and removes nodes", () => {
    const list = new List();
    expect(list.head).to.equal(list.sentinel);
    expect(list.tail).to.equal(list.sentinel);
    expect(list.sentinel.previous).to.be.undefined;
    expect(list.sentinel.next).to.be.undefined;

    const tiles: Tile[] = [];
    for (let i = 0; i < 5; i++) {
      const tile = mockTile(i + 1);
      tiles.push(tile);
      list.add(tile);

      expect(list.head).to.equal(list.sentinel);
      expect(list.tail).to.equal(tiles[0]);
      expect(tile.previous).to.equal(list.sentinel);
      expect(tile.next).to.equal(i > 0 ? tiles[i - 1] : undefined);
      if (tile.next)
        expect(tile.next.previous).to.equal(tile);
    }

    list.expectOrder(list.sentinel, tiles[4], tiles[3], tiles[2], tiles[1], tiles[0]);

    list.drop(tiles[3]);
    expectUnlinked(tiles[3]);
    expect(tiles[2].previous).to.equal(tiles[4]);
    expect(tiles[4].next).to.equal(tiles[2]);
    list.expectOrder(list.sentinel, tiles[4], tiles[2], tiles[1], tiles[0]);

    list.drop(tiles[4]);
    expectUnlinked(tiles[4]);
    list.expectOrder(list.sentinel, tiles[2], tiles[1], tiles[0]);

    expect(list.tail).to.equal(tiles[0]);
    list.drop(tiles[0]);
    expectUnlinked(tiles[0]);
    expect(list.tail).to.equal(tiles[1]);
    list.expectOrder(list.sentinel, tiles[2], tiles[1]);
  });

  it("ignores empty nodes", () => {
    const list = new List();
    const tile = mockTile(0);
    list.add(tile);
    expect(list.tail).to.equal(list.sentinel);
    expect(list.head).to.equal(list.sentinel);
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
    expect(t1.tileUserIds).not.to.be.undefined;
    expect(t2.tileUserIds).not.to.be.undefined;
    expect(t3.tileUserIds).to.be.undefined;
    expect(t4.tileUserIds).to.be.undefined;

    list.markUsed(vp2, [t1, t4]);
    list.expectOrder(t3, s, t2, t1, t4);
    expect(t1.tileUserIds).not.to.be.undefined;
    expect(t2.tileUserIds).not.to.be.undefined;
    expect(t3.tileUserIds).to.be.undefined;
    expect(t4.tileUserIds).not.to.be.undefined;

    list.clearUsed(vp1);
    list.expectOrder(t3, t2, s, t1, t4);
    expect(t1.tileUserIds).not.to.be.undefined;
    expect(t2.tileUserIds).to.be.undefined;
    expect(t3.tileUserIds).to.be.undefined;
    expect(t4.tileUserIds).not.to.be.undefined;

    list.markUsed(vp1, [t3, t4, t2]);
    list.expectOrder(s, t1, t3, t4, t2);
    expect(t1.tileUserIds).not.to.be.undefined;
    expect(t2.tileUserIds).not.to.be.undefined;
    expect(t3.tileUserIds).not.to.be.undefined;
    expect(t4.tileUserIds).not.to.be.undefined;

    list.clearUsed(vp2);
    list.expectOrder(t1, s, t3, t4, t2);
    expect(t1.tileUserIds).to.be.undefined;
    expect(t2.tileUserIds).not.to.be.undefined;
    expect(t3.tileUserIds).not.to.be.undefined;
    expect(t4.tileUserIds).not.to.be.undefined;

    list.clearUsed(vp1);
    list.expectOrder(t1, t3, t4, t2, s);
    expect(t1.tileUserIds).to.be.undefined;
    expect(t2.tileUserIds).to.be.undefined;
    expect(t3.tileUserIds).to.be.undefined;
    expect(t4.tileUserIds).to.be.undefined;
  });

  it("iterates over partitions", () => {
    const list = new List();

    function expectPartition(which: "selected" | "unselected", ...expected: LRUTileListNode[]): void {
      const actual = Array.from("selected" === which ? list.selectedTiles : list.unselectedTiles);
      expect(actual.length).to.equal(expected.length);
      for (let i = 0; i < actual.length; i++)
        expect(actual[i]).to.equal(expected[i]);
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
    expect(list.totalBytesUsed).to.equal(0);

    const t1 = mockTile(1);
    const t10 = mockTile(10);
    const t100 = mockTile(100);
    list.add(t1);
    list.add(t10);
    list.add(t100);
    expect(list.totalBytesUsed).to.equal(111);

    list.drop(t10);
    expect(list.totalBytesUsed).to.equal(101);

    list.drop(t1);
    expect(list.totalBytesUsed).to.equal(100);

    list.add(t10);
    expect(list.totalBytesUsed).to.equal(110);

    list.drop(t100);
    expect(list.totalBytesUsed).to.equal(10);

    list.drop(t10);
    expect(list.totalBytesUsed).to.equal(0);
  });

  it("disposes", () => {
    const list = new List();
    const tiles = [];
    for (let i = 0; i < 4; i++) {
      tiles.push(mockTile(i + 1));
      list.add(tiles[i]);
      list.moveTileBeforeSentinel(tiles[i]);
    }

    expect(list.head).not.to.equal(list.tail);
    expect(list.tail).to.equal(list.sentinel);
    expect(list.totalBytesUsed).greaterThan(0);

    list.markUsed(1, tiles);
    expect(list.head).to.equal(list.sentinel);
    for (const tile of tiles) {
      expect(tile.previous !== undefined || tile.next !== undefined).to.be.true;
      expect(tile.bytesUsed).greaterThan(0);
      expect(tile.tileUserIds).not.to.be.undefined;
    }

    list.dispose();
    expect(list.head).to.equal(list.sentinel);
    expect(list.tail).to.equal(list.sentinel);
    expect(list.totalBytesUsed).to.equal(0);
    for (const tile of tiles) {
      expectUnlinked(tile);
      expect(tile.tileUserIds).to.be.undefined;
      expect(tile.bytesUsed).to.equal(0);
    }
  });
});
