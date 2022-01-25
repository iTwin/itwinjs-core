/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { compareStrings, SortedArray } from "../core-bentley";
import { compareBooleans, compareNumbers, compareNumbersOrUndefined, compareStringsOrUndefined, compareWithTolerance } from "../Compare";

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

export class Id {
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

export function expectSorted<T>(array: T[], expectedLength: number, allowDuplicates: boolean, compare: (lhs: T, rhs: T) => number) {
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
    expect(list.indexOfEquivalent((x) => compareThings(x, thing))).to.equal(index);

    // not allowing duplicates
    index = list.insert(thing);
    expect(list.length).to.equal(1);
    expect(index).to.equal(0);

    // not cloning
    let found = list.findEqual(new Thing(1, 1));
    expect(found).not.to.be.undefined;
    expect(found).to.equal(thing);
    expect(list.findEquivalent((x) => compareThings(x, new Thing(1, 1)))).to.equal(thing);

    found = list.get(0);
    expect(found).not.to.be.undefined;
    expect(found).to.equal(thing);

    index = list.insert(new Thing(2, 1));
    expect(index).to.equal(1);
    index = list.insert(new Thing(-1, 1));
    expect(index).to.equal(0);
    expect(list.indexOf(thing)).to.equal(1);
    expect(list.indexOfEquivalent((x) => compareThings(x, thing))).to.equal(1);
    expect(list.indexOf(new Thing(2, 1))).to.equal(2);
    expect(list.indexOfEquivalent((x) => compareThings(x, new Thing(2, 1)))).to.equal(2);
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
    expect(list.findEquivalent((x) => x.compare(id))).to.equal(found);
    list.insert(id);
    expect(list.length).to.equal(2);
    const lengthA = list.length;
    const ids = ["x", "w", "z", "a", "a", "z", "w", "p", "a", "x", "y", "e", "r", "w", "q"];
    for (const toInsert of ids)
      list.insert(new Id(toInsert));
    expect(list.length, "length of protected array").to.equal(ids.length + lengthA);
    expectSorted(list.extractArray(), ids.length + 2, true, (lhs: Id, rhs: Id) => lhs.compare(rhs));

  });

  it("Number array", () => {
    const listA = new SortedArray<number>(compareNumbers, false);
    const listB = new SortedArray<number>(compareNumbers, true);
    expect(listA.isEmpty, "isEmpty").to.be.true;
    const numbers = [1, 3, 3, 2, 5, 2, 4, 7, 2, 9, 5];
    let sumAll = 0;
    let sumBInsert = 0;
    for (const toInsert of numbers) {
      listA.insert(toInsert);
      listB.insert(toInsert, (a: number) => sumBInsert += a);
      expect(listA.findEqual(toInsert)).is.gte(0);
      sumAll += toInsert;
    }

    expect(listA.findEqual(sumAll)).to.be.undefined;   // sum of positives is larger

    expect(sumBInsert).to.equal(sumAll);
    let sumA = 0;
    let sumB = 0;
    listA.forEach((value: number) => sumA += value);
    listB.forEach((value: number) => sumB += value);
    expect(sumB).to.equal(sumAll);
    expect(sumA).to.be.lt(sumAll);
    const numDuplicates = listB.length - listA.length;
    expect(listA.length).to.be.lte(listB.length);
    expect(listA.isEmpty, "isEmpty").to.be.false;
    let numDuplicatesDuringRemoval = 0;
    for (const a of numbers) {
      expect(listB.contains(a)).to.be.true;
      const removeA = listA.remove(a);
      expect(listA.contains(a)).to.be.false;
      const removeB = listB.remove(a);
      expect(removeB, "listB should have all original entries with duplicates").is.gte(0);
      if (removeA === -1)   // this must be removal of a dup.
        numDuplicatesDuringRemoval++;
    }
    expect(numDuplicates).to.be.equal(numDuplicatesDuringRemoval);
    listA.clear();
    expect(listA.isEmpty).to.be.true;

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

    const contents = [6, 5, 1, 3, 2, 4, 4, 6, 5, 5, 5];
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

describe("SortFunctions", () => {
  it("single Calls", () => {
    expect(compareStrings("c", "b")).to.equal(1);
    expect(compareStrings("b", "c")).to.equal(-1);
    expect(compareStrings("olaf", "olaf")).to.equal(0);

    expect(compareWithTolerance(10, 20, 2)).to.equal(-1);
    expect(compareWithTolerance(20, 10, 2)).to.equal(1);

    expect(compareWithTolerance(10, 11, 2)).to.equal(0);
    expect(compareWithTolerance(11, 10, 2)).to.equal(0);
    expect(compareWithTolerance(10, 10, 2)).to.equal(0);
    // undefined precedes anything ..
    expect(compareStringsOrUndefined("a", undefined)).to.equal(1);
    expect(compareStringsOrUndefined(undefined, "a")).to.equal(-1);
    expect(compareStringsOrUndefined(undefined, undefined)).to.equal(0);
    expect(compareStringsOrUndefined("c", "b")).to.equal(1);
    expect(compareStringsOrUndefined("b", "c")).to.equal(-1);
    expect(compareStringsOrUndefined("olaf", "olaf")).to.equal(0);

    // !!! number comparison is b-a, rather than strict -1,0,1
    expect(compareNumbersOrUndefined(1, 2)).to.equal(-1);
    expect(compareNumbersOrUndefined(5, 2)).to.equal(3);
    expect(compareNumbersOrUndefined(undefined, undefined)).to.equal(0);
    expect(compareNumbersOrUndefined(undefined, 2)).to.equal(-1);
    expect(compareNumbersOrUndefined(5, undefined)).to.equal(1);
    for (const b0 of [false, true]) {
      const number0 = b0 ? 1 : 0;
      for (const b1 of [false, true]) {
        const number1 = b1 ? 1 : 0;
        expect(compareBooleans(b0, b1)).to.equal(compareNumbers(number0, number1));
      }
    }
  });
});
