/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { compareStrings, Dictionary, SortedArray } from "../bentleyjs-core";

class Thing {
  public constructor(public readonly first: number, public readonly second: number) { }
}

function compareThings(lhs: Thing, rhs: Thing) {
  if (lhs === rhs)
    return 0;

  const diff = lhs.first - rhs.first;
  if (0 !== diff)
    return diff;

  return lhs.second - rhs.second;
}

class Id {
  public constructor(public readonly value: string) { }

  public compare(rhs: Id) {
    if (this === rhs || this.value === rhs.value)
      return 0;
    else if (this.value < rhs.value)
      return -123;
    else
      return 654;
  }
}

function expectSorted<T>(array: T[], expectedLength: number, allowDuplicates: boolean, compare: (lhs: T, rhs: T) => number) {
  expect(array.length).to.equal(expectedLength);
  for (let i = 0; i < array.length - 1; i++) {
    const lhs = array[i];
    const rhs = array[i + 1];
    const comp = compare(lhs, rhs);
    if (allowDuplicates)
      expect(comp).to.not.be.above(0);
    else
      expect(comp).to.be.lessThan(0);
  }
}

describe("SortedArray", () => {
  it("Should maintain sorted order", () => {
    const list = new SortedArray<Thing>(compareThings);

    const thing = new Thing(1, 1);
    list.insert(thing);
    expect(list.length).to.equal(1);
    let index = list.indexOf(thing);
    expect(index).to.equal(0);

    // not allowing duplicates
    index = list.insert(thing);
    expect(list.length).to.equal(1);
    expect(index).to.equal(0);

    // not cloning
    let found = list.findEqual(new Thing(1, 1));
    expect(found).not.to.be.undefined;
    expect(found).to.equal(thing);

    found = list.get(0);
    expect(found).not.to.be.undefined;
    expect(found).to.equal(thing);

    index = list.insert(new Thing(2, 1));
    expect(index).to.equal(1);
    index = list.insert(new Thing(-1, 1));
    expect(index).to.equal(0);
    expect(list.indexOf(thing)).to.equal(1);
    expect(list.indexOf(new Thing(2, 1))).to.equal(2);
    expect(list.length).to.equal(3);

    const thing05 = new Thing(0, 5);
    const thing04 = new Thing(0, 4);
    index = list.insert(thing04);
    expect(index).to.equal(1);
    index = list.insert(thing05);
    expect(index).to.equal(2);

    const array = list.extractArray();
    expect(list.length).to.equal(0);
    expectSorted(array, 5, false, compareThings);
  });

  it("Should clone and allow duplicates", () => {
    const list = new SortedArray<Id>((lhs: Id, rhs: Id) => lhs.compare(rhs), true, (src: Id) => new Id(src.value));

    const id = new Id("a");
    list.insert(id);
    const found = list.findEqual(id);
    expect(found).not.to.be.undefined;
    expect(found).not.to.equal(id);
    expect(found!.compare(id)).to.equal(0);
    list.insert(id);
    expect(list.length).to.equal(2);

    const ids = ["x", "w", "z", "a", "a", "z", "w", "p", "a", "x", "y", "e", "r", "w", "q"];
    for (const toInsert of ids)
      list.insert(new Id(toInsert));

    expectSorted(list.extractArray(), ids.length + 2, true, (lhs: Id, rhs: Id) => lhs.compare(rhs));
  });

  it("Should support iteration", () => {
    const list = new SortedArray<number>((lhs, rhs) => lhs - rhs);

    const countEntries = () => {
      let numEntries = 0;
      for (const entry of list) {
        ++numEntries;
        expect(entry).not.to.be.undefined; // silence `unused variable` warning...
      }

      expect(numEntries).to.equal(list.length);
    };

    countEntries();

    const contents = [ 6, 5, 1, 3, 2, 4, 4, 6, 5, 5, 5 ];
    for (const content of contents)
      list.insert(content);

    countEntries();

    let prev = 0;
    for (const entry of list) {
      expect(entry).to.equal(prev + 1);
      prev = entry;
    }

    const iter = list[Symbol.iterator]();
    const howManyTimes = list.length; // stupid compiler/linter is stupid.
    expect(howManyTimes).to.equal(6);
    for (let i = 0; i < howManyTimes; i++) {
      const next = iter.next();
      expect(next.done).to.be.false;
    }

    expect(iter.next().done).to.be.true;
  });
});

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

    expect(dict.length).to.equal(entries.length);

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

      expect(numEntries).to.equal(dict.length);
    };

    countEntries();

    dict.insert("one", 1);
    dict.insert("two", 2);
    dict.insert("three", 3);
    dict.insert("four", 4);

    countEntries();

    const sorted = [ ["four", 4], ["one", 1], ["three", 3], ["two", 2] ];
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
});
