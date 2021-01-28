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
});
