/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { compareNumbers, IndexMap } from "../core-bentley";

describe("IndexMap", () => {
  it("should remember insertion order", () => {
    const map = new IndexMap<number>(compareNumbers);
    const list = [ 9, 8, 7, 1, 2, 3, 0, 5, 4 ];
    for (let i = 0; i < list.length; i++)
      expect(map.insert(list[i])).to.equal(i);

    expect(map.length).to.equal(list.length);
    for (let i = 0; i < list.length; i++) {
      expect(map.indexOf(list[i])).to.equal(i);
      expect(map.insert(list[i])).to.equal(i);
    }

    expect(map.length).to.equal(list.length);
  });

  it("should produce array ordered by index", () => {
    const map = new IndexMap<number>(compareNumbers);
    const inputs = [ 9, 8, 7, 8, 1, 9, 1, 2, 3, 3, 3, 0, 2 ];
    for (const input of inputs)
      map.insert(input);

    expect(map.toArray()).to.deep.equal([9, 8, 7, 1, 2, 3, 0]);
  });
});
