/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { TupleKeyedMap } from "../core-bentley";

describe("TupleKeyedMap", () => {
  it("should maintain mapping between keys and values", () => {
    const entries = ["a", "b", "c", "z", "y", "x", "p", "r", "q"];
    const map = new TupleKeyedMap<[string], string>();
    for (const entry of entries) {
      const key = entry;
      const val = entry;
      expect(map.set([key], val)).to.be.true;
      const found = map.get([key]);
      assert(found !== undefined);
      assert(found === entry);
      assert(found === val);
    }

    expect(map.size).to.equal(entries.length);
  });

  it("gets and sets", () => {
    const [a, b, c, d] = new Array(4).fill(undefined).map(() => ({}));
    const map = new TupleKeyedMap<[string, number, object], number>();
    map.set(["three", 3, c], 3);
    map.set(["four", 4, d], 4);
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
  });
});
