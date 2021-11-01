/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { compareStrings, Dictionary } from "../core-bentley";
import { expectSorted, Id } from "./SortedArray.test";

describe("Dictionary", () => {
  it("should maintain mapping between keys and values", () => {
    const compareIds = (lhs: Id, rhs: Id) => lhs.compare(rhs);
    const entries = ["a", "b", "c", "z", "y", "x", "p", "r", "q"];
    const dict = new Dictionary<Id, Id>(compareIds);
    for (const entry of entries) {
      const key = new Id(entry);
      const val = new Id(entry);
      expect(dict.insert(key, val)).to.be.true;
      const found = dict.get(key);
      expect(found).not.to.be.undefined;
      expect(found!.value).to.equal(entry);
      expect(found!).to.equal(val);
    }

    expect(dict.size).to.equal(entries.length);

    const arrays = dict.extractArrays();
    expectSorted(arrays.keys, entries.length, false, compareIds);
    expectSorted(arrays.values, entries.length, false, compareIds);
  });

  it("should support iteration", () => {
    const dict = new Dictionary<string, number>((lhs, rhs) => compareStrings(lhs, rhs));

    const countEntries = () => {
      let numEntries = 0;
      for (const entry of dict) {
        expect(entry.key).not.to.be.undefined; // because otherwise `entry` is unused...
        ++numEntries;
      }

      expect(numEntries).to.equal(dict.size);
    };

    countEntries();

    dict.insert("one", 1);
    dict.insert("two", 2);
    dict.insert("three", 3);
    dict.insert("four", 4);

    countEntries();

    const sorted = [["four", 4], ["one", 1], ["three", 3], ["two", 2]];
    let index = 0;
    for (const kvp of dict) {
      expect(kvp.key).to.equal(sorted[index][0]);
      expect(kvp.value).to.equal(sorted[index][1]);
      ++index;
    }

    const iter = dict[Symbol.iterator]();
    for (let i = 0; i < 4; i++) {
      const next = iter.next();
      expect(next.done).to.be.false;
      expect(next.value).not.to.be.undefined;
    }

    const last = iter.next();
    expect(last.done).to.be.true;
    expect(last.value).to.be.undefined;
  });

  it("iterates over keys and values", () => {
    const dict = new Dictionary<string, number>((lhs, rhs) => compareStrings(lhs, rhs));
    dict.set("one", 1);
    dict.set("two", 2);
    dict.set("three", 3);
    dict.set("four", 4);

    expect(Array.from(dict.keys())).to.deep.equal(["four", "one", "three", "two"]);
    expect(Array.from(dict.values())).to.deep.equal([4, 1, 3, 2]);
  });

  it("finds or inserts", () => {
    const dict = new Dictionary<string, number>((lhs, rhs) => compareStrings(lhs, rhs));
    dict.set("three", 3);
    dict.set("four", 4);
    expect(dict.findOrInsert("one", 1)).to.deep.equal({ value: 1, inserted: true });
    expect(dict.findOrInsert("one", 111)).to.deep.equal({ value: 1, inserted: false });
    expect(dict.findOrInsert("two", 2)).to.deep.equal({ value: 2, inserted: true });
    expect(dict.findOrInsert("three", 33)).to.deep.equal({ value: 3, inserted: false });
  });
});
