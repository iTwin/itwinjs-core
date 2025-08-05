/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, describe, expect, it } from "vitest";
import { TupleKeyedMap } from "../core-bentley";

describe("TupleKeyedMap", () => {
  it("should maintain mapping between keys and values", () => {
    const entries = ["a", "b", "c", "z", "y", "x", "p", "r", "q"];
    const map = new TupleKeyedMap<[string], string>();
    for (const entry of entries) {
      const key = entry;
      const val = entry;
      map.set([key], val);
      const found = map.get([key]);
      assert(found !== undefined);
      assert(found === entry);
      assert(found === val);
    }

    expect(map.size).to.equal(entries.length);
  });

  it("gets, sets, and iterates", () => {
    const [a, b, c, d] = new Array(4).fill(undefined).map(() => ({}));
    const map = new TupleKeyedMap<[string, number, object], number>([
      [["three", 3, c], 3],
      [["four", 4, d], 4],
    ]);

    expect(map.get(["one", 1, a])).to.equal(undefined);

    expect(map.get(["three", 3, c])).to.equal(3);
    expect(map.get(["three", 3, d])).to.equal(undefined);
    expect(map.get(["three", 4, c])).to.equal(undefined);
    expect(map.get(["four", 3, c])).to.equal(undefined);
    expect(() => map.get(["three", 3, c, b] as any)).to.throw();
    expect(() => map.get(["three", 3] as any)).to.throw();

    expect(() => map.set(["three", 3, c], 10)).not.to.throw();
    expect(map.get(["three", 3, c])).to.equal(10);
    expect(map.get(["three", 3, d])).to.equal(undefined);
    expect(map.get(["three", 4, c])).to.equal(undefined);
    expect(map.get(["four", 3, c])).to.equal(undefined);
    expect(() => map.get(["three", 3, c, b] as any)).to.throw();
    expect(() => map.get(["three", 3] as any)).to.throw();

    expect(() => map.set(["three", 4, c], 11)).not.to.throw();

    // subkey-level insertion order is expected because the underlying Map guarantees insertion order
    const iter = map[Symbol.iterator]();
    expect(iter.next()).to.deep.equal({ value: [["three", 3, c], 10], done: false});
    expect(iter.next()).to.deep.equal({ value: [["three", 4, c], 11], done: false});
    expect(iter.next()).to.deep.equal({ value: [["four", 4, d], 4], done: false});
    expect(iter.next()).to.deep.equal({ value: undefined, done: true });
  });
});
