/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { TileUserIdSet, TileUserIdSets } from "../../tile/LRUTileList";

function makeTileUserIdSet(ids: number[]): TileUserIdSet {
  const set = new TileUserIdSet();
  for (const id of ids)
    set.add(id);

  return set;
}

describe("TileUserIdSet", () => {
  it("compares for equality", () => {
    const idLists = [
      [ ],
      [ 1 ],
      [ 2 ],
      [ 1, 2 ],
      [ 5, 199, 2, 4, 300 ],
      [ 1, 1, 2, 2, 5, 4, 4, 3, 3, 1, 2 ],
    ];

    for (let i = 0; i < idLists.length; i++) {
      const list = idLists[i];
      const set = makeTileUserIdSet(list);
      expect(set.equals(set)).to.be.true;
      const reverse = [ ...list ];
      reverse.reverse();
      expect(set.equals(makeTileUserIdSet(reverse))).to.be.true;

      for (let j = 0; j < idLists.length; j++)
        expect(set.equals(makeTileUserIdSet(idLists[j]))).to.equal(i === j);
    }
  });
});

describe("TileUserIdSets", () => {
  it("adds unique sets as needed", () => {
    const sets = new TileUserIdSets();
    expect(sets.length).to.equal(0);

    const s1 = sets.plus(1);
    expect(sets.length).to.equal(1);
    expect(sets.plus(1)).to.equal(s1);
    expect(sets.plus(1, makeTileUserIdSet([1]))).to.equal(s1);
    expect(sets.length).to.equal(1);

    const s2 = sets.plus(2);
    expect(sets.length).to.equal(2);
    expect(s2).not.to.equal(s1);

    const s12 = sets.plus(2, makeTileUserIdSet([1]));
    expect(sets.length).to.equal(3);
    expect(s12.length).to.equal(2);

    const s21 = sets.plus(1, makeTileUserIdSet([2]));
    expect(s21).to.equal(s12);
    expect(sets.length).to.equal(3);

    const s123 = sets.plus(2, makeTileUserIdSet([3, 1]));
    expect(sets.length).to.equal(4);
    expect(s123.length).to.equal(3);

    expect(sets.minus(1)).to.be.undefined;

    expect(sets.minus(3, s123)).to.equal(s12);

    const s13 = sets.minus(2, s123)!;
    expect(s13).not.to.be.undefined;
    expect(sets.length).to.equal(5);
    expect(s13.length).to.equal(2);
  });

  it("drops empty and duplicate sets", () => {
    const sets = new TileUserIdSets();
    const set = sets.plus(1);
    expect(sets.length).to.equal(1);
    expect(set.length).to.equal(1);

    sets.drop(1);
    expect(sets.length).to.equal(0);
    expect(set.length).to.equal(0);

    const s1 = sets.plus(1);
    const s2 = sets.plus(2);
    const s12 = sets.plus(1, makeTileUserIdSet([2]));
    const s134 = sets.plus(3, makeTileUserIdSet([1, 4]));
    expect(sets.length).to.equal(4);

    sets.drop(1);
    expect(sets.length).to.equal(2);
    expect(s1.length).to.equal(0);
    expect(s2.length).to.equal(1);
    expect(s12.length).to.equal(1);
    expect(s134.length).to.equal(2);

    const arr = (sets as any)._array as TileUserIdSet[];
    expect(arr.indexOf(s1)).to.equal(-1);
    expect(arr.indexOf(s134)).not.to.equal(-1);

    // One of the two sets containing only tile user Id 2 should have been removed.
    const s2Removed = arr.indexOf(s2) === -1;
    expect(arr.indexOf(s12) === -1).not.to.equal(s2Removed);

    sets.drop(2);
    expect(sets.length).to.equal(1);
    expect(s2.length).to.equal(s2Removed ? 1 : 0);
    expect(s12.length).to.equal(s2Removed ? 0 : 1);
    expect(s134.length).to.equal(2);
    expect(arr.indexOf(s2)).to.equal(-1);
    expect(arr.indexOf(s12)).to.equal(-1);
    expect(arr.indexOf(s134)).to.equal(0);

    sets.drop(4);
    expect(sets.length).to.equal(1);
    expect(s134.length).to.equal(1);
    expect(arr.indexOf(s134)).to.equal(0);

    sets.drop(3);
    expect(sets.length).to.equal(0);
    expect(s134.length).to.equal(0);
  });
});
