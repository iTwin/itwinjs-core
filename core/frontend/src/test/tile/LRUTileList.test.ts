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

  public toArray(): LRUTileListNode[] {
    const nodes = [];
    for (let node: LRUTileListNode | undefined = this.head; node !== undefined; node = node.next)
      nodes.push(node);

    return nodes;
  }

  public expectOrder(expected: LRUTileListNode[]): void {
    const actual = this.toArray();
    expect(actual.length).to.equal(expected.length);
    for (let i = 0; i < actual.length; i++)
      expect(actual[i]).to.equal(expected[i]);
  }
}

describe.only("LRUTileList", () => {
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

    list.expectOrder([...tiles, list.sentinel]);

    list.drop(tiles[3]);
    expect(tiles[3].previous).to.be.undefined;
    expect(tiles[3].next).to.be.undefined;
    expect(tiles[2].next).to.equal(tiles[4]);
    expect(tiles[4].previous).to.equal(tiles[2]);
    list.expectOrder([ tiles[0], tiles[1], tiles[2], tiles[4], list.sentinel ]);

    expect(list.tail).to.equal(tiles[4]);
    list.drop(tiles[4]);
    expect(tiles[4].previous).to.be.undefined;
    expect(tiles[4].next).to.be.undefined;
    expect(list.tail).to.equal(tiles[2]);
    expect(tiles[2].next).to.be.undefined;
    expect(tiles[2].previous).to.equal(tiles[1]);
    list.expectOrder([ tiles[0], tiles[1], tiles[2], list.sentinel ]);

    expect(list.head).to.equal(tiles[0]);
    list.drop(tiles[0]);
    expect(tiles[0].previous).to.be.undefined;
    expect(tiles[0].next).to.be.undefined;
    expect(list.head).to.equal(tiles[1]);
    expect(list.head.previous).to.be.undefined;
    expect(list.head.next).to.equal(tiles[1]);
    list.expectOrder([ tiles[1], tiles[2], list.sentinel ]);
  });

  it("moves nodes", () => {
  });

  it("accumulates total memory used", () => {
  });

  it("updates when selected tiles change", () => {
  });

  it("disposes", () => {
  });
});
