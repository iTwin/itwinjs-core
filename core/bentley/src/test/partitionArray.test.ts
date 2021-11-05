/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { partitionArray } from "../partitionArray";

describe("partitionArray", () => {
  it("should partition array in-place", () => {
    function isEven(n: number): boolean {
      return 0 === n % 2;
    }

    type Test = [ number[], number ];
    const tests: Test[] = [
      [ [], 0 ],
      [ [1], 0 ],
      [ [2], 1 ],
      [ [1, 1], 0 ],
      [ [2, 2], 2 ],
      [ [1, 1, 1], 0 ],
      [ [2, 2, 2], 3 ],
      [ [1, 2], 1 ],
      [ [2, 1], 1 ],
      [ [1, 2, 3, 4], 2 ],
      [ [4, 3, 2, 1], 2 ],
      [ [1, 2, 3], 1 ],
      [ [4, 3, 2], 2 ],
      [ [4, 1, 2, 3, 2, 4, 1, 3], 4 ],
      [ [4, 1, 2, 3, 2, 4, 1], 4 ],
      [ [4, 1, 2, 3, 3, 4, 1], 3 ],
    ];

    for (const test of tests) {
      const list = test[0];
      const partition = partitionArray(list, isEven);
      expect(partition).to.equal(test[1]);
      for (let i = 0; i < list.length; i++)
        expect(isEven(list[i])).to.equal(i < partition);
    }
  });
});
