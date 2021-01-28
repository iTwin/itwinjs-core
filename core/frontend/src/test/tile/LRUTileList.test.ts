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
  public get totalBytesUsed() { return this._totalBytesUsed; }

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

      expect(list.head).to.equal(tiles[0]);
      expect(list.tail).to.equal(list.sentinel);
      expect(tile.previous).to.equal(i > 0 ? tiles[i - 1] : undefined);
      if (tile.previous)
        expect(tile.previous.next).to.equal(tile);

      expect(tile.next).to.equal(list.sentinel);
    }

    list.expectOrder(...tiles, list.sentinel);

    list.drop(tiles[3]);
    expectUnlinked(tiles[3]);
    expect(tiles[2].next).to.equal(tiles[4]);
    expect(tiles[4].previous).to.equal(tiles[2]);
    list.expectOrder(tiles[0], tiles[1], tiles[2], tiles[4], list.sentinel);

    list.drop(tiles[4]);
    expectUnlinked(tiles[4]);
    list.expectOrder(tiles[0], tiles[1], tiles[2], list.sentinel);

    expect(list.head).to.equal(tiles[0]);
    list.drop(tiles[0]);
    expectUnlinked(tiles[0]);
    expect(list.head).to.equal(tiles[1]);
    list.expectOrder(tiles[1], tiles[2], list.sentinel);
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
    list.expectOrder(t1, s);
    list.moveTileToEnd(t1);
    list.expectOrder(s, t1);

    list.add(t2);
    list.expectOrder(t2, s, t1);
    list.moveTileToEnd(t2);
    list.expectOrder(s, t1, t2);
    list.moveTileBeforeSentinel(t1);
    list.expectOrder(t1, s, t2);
    list.moveTileBeforeSentinel(t2);
    list.expectOrder(t1, t2, s);

    list.add(t3);
    list.add(t4);
    list.expectOrder(t1, t2, t3, t4, s);
    list.moveTileToEnd(t4);
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

  it("accumulates total memory used", () => {
  });

  it("updates when selected tiles change", () => {
  });

  it("frees memory to specified target", () => {
  });

  it("disposes", () => {
  });
});
