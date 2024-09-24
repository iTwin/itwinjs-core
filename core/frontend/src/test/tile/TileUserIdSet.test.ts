/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { TileUserIdSet, TileUserIdSets } from "../../tile/LRUTileList";

function makeTileUserIdSet(ids: number[]): TileUserIdSet {
  const set = new TileUserIdSet();
  for (const id of ids)
    set.add(id);

  return set;
}

describe("TileUserIdSet", () => {
  it("compares for equality", () => {
    const idLists = [[], [1], [2], [1, 2], [5, 199, 2, 4, 300], [1, 1, 2, 2, 5, 4, 4, 3, 3, 1, 2]];

    for (let i = 0; i < idLists.length; i++) {
      const list = idLists[i];
      const set = makeTileUserIdSet(list);
      expect(set.equals(set)).toBe(true);
      const reverse = [...list];
      reverse.reverse();
      expect(set.equals(makeTileUserIdSet(reverse))).toBe(true);

      for (let j = 0; j < idLists.length; j++)
        expect(set.equals(makeTileUserIdSet(idLists[j]))).toEqual(i === j);
    }
  });
});

describe("TileUserIdSets", () => {
  it("adds unique sets as needed", () => {
    const sets = new TileUserIdSets();
    expect(sets.length).toEqual(0);

    const s1 = sets.plus(1);
    expect(sets.length).toEqual(1);
    expect(sets.plus(1)).toEqual(s1);
    expect(sets.plus(1, makeTileUserIdSet([1]))).toEqual(s1);
    expect(sets.length).toEqual(1);

    const s2 = sets.plus(2);
    expect(sets.length).toEqual(2);
    expect(s2).not.toEqual(s1);

    const s12 = sets.plus(2, makeTileUserIdSet([1]));
    expect(sets.length).toEqual(3);
    expect(s12.length).toEqual(2);

    const s21 = sets.plus(1, makeTileUserIdSet([2]));
    expect(s21).toEqual(s12);
    expect(sets.length).toEqual(3);

    const s123 = sets.plus(2, makeTileUserIdSet([3, 1]));
    expect(sets.length).toEqual(4);
    expect(s123.length).toEqual(3);

    expect(sets.minus(1)).toBeUndefined();

    expect(sets.minus(3, s123)).toEqual(s12);

    const s13 = sets.minus(2, s123)!;
    expect(s13).toBeDefined();
    expect(sets.length).toEqual(5);
    expect(s13.length).toEqual(2);
  });

  it("drops empty and duplicate sets", () => {
    const sets = new TileUserIdSets();
    const set = sets.plus(1);
    expect(sets.length).toEqual(1);
    expect(set.length).toEqual(1);

    sets.drop(1);
    expect(sets.length).toEqual(0);
    expect(set.length).toEqual(0);

    const s1 = sets.plus(1);
    const s2 = sets.plus(2);
    const s12 = sets.plus(1, makeTileUserIdSet([2]));
    const s134 = sets.plus(3, makeTileUserIdSet([1, 4]));
    expect(sets.length).toEqual(4);

    sets.drop(1);
    expect(sets.length).toEqual(2);
    expect(s1.length).toEqual(0);
    expect(s2.length).toEqual(1);
    expect(s12.length).toEqual(1);
    expect(s134.length).toEqual(2);

    const arr = (sets as any)._array as TileUserIdSet[];
    expect(arr.indexOf(s1)).toEqual(-1);
    expect(arr.indexOf(s134)).not.toEqual(-1);

    // One of the two sets containing only tile user Id 2 should have been removed.
    const s2Removed = arr.indexOf(s2) === -1;
    expect(arr.indexOf(s12) === -1).not.toEqual(s2Removed);

    sets.drop(2);
    expect(sets.length).toEqual(1);
    expect(s2.length).toEqual(s2Removed ? 1 : 0);
    expect(s12.length).toEqual(s2Removed ? 0 : 1);
    expect(s134.length).toEqual(2);
    expect(arr.indexOf(s2)).toEqual(-1);
    expect(arr.indexOf(s12)).toEqual(-1);
    expect(arr.indexOf(s134)).toEqual(0);

    sets.drop(4);
    expect(sets.length).toEqual(1);
    expect(s134.length).toEqual(1);
    expect(arr.indexOf(s134)).toEqual(0);

    sets.drop(3);
    expect(sets.length).toEqual(0);
    expect(s134.length).toEqual(0);
  });
});
