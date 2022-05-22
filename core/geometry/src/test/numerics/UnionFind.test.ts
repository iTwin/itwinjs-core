/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { UnionFindContext } from "../../numerics/UnionFind";
import { Checker } from "../Checker";

/* eslint-disable no-console */

describe("UnionFind", () => {
  it("BinaryTree", () => {
    const ck = new Checker();
    const noisy = Checker.noisy.unionFind;
    for (const numLeaf of [4, 2, 16, 1, 128, 5, 29, 77, 78, 79]) {
      // Make a power-of-2 length set.
      // merge blocks of 1,2,4 ...
      // confirm counts drop at expected times.
      // confirm immediate parents after each merge.
      if (noisy)
        console.log(`tree size ${numLeaf}`);
      // variant calls to constructor to get coverage . ..
      let context: UnionFindContext;
      if (numLeaf < 20) {
        context = new UnionFindContext();
        for (let i = 0; i < numLeaf; i++) {
          context.addLeaf();
        }
      } else
        context = new UnionFindContext(numLeaf);
      ck.testExactNumber(numLeaf, context.length);
      // exercise invalid indices . .
      ck.testFalse(context.isValidIndex(-1));
      for (const invalidIndex of [-1, numLeaf, numLeaf + 100]) {
        ck.testExactNumber(invalidIndex, context.askParent(invalidIndex), "askParent with invalid index is identity function.");
        ck.testExactNumber(invalidIndex, context.findRoot(invalidIndex), "findRoot with invalid index is identity");
      }
      ck.testExactNumber(numLeaf, context.countRoots(), "Root count in singleton context");
      // merge in a sequence that reduces the subset count predictably.
      let numSubset = numLeaf;
      // blockSize is a power-of-2 divisor of numLeaf
      // after merging (i0, i0+1, i0 +blockSize-1) the number of roots is decreased.
      for (let blockSize = 1; blockSize < numLeaf; blockSize *= 2) {
        if (noisy)
          console.log(`blockSize ${blockSize}`);
        for (let i0 = 0; i0 < numLeaf; i0 += blockSize) {
          for (let i = 0; i < blockSize; i++) {
            context.mergeSubsets(i0, i0 + i);
            if (context.isValidIndex(i0) && context.isValidIndex(i0 + i))
              ck.testExactNumber(context.askParent(i0), context.askParent(i0 + i), "verify merge happened");
          }
          if (blockSize > 1)
            numSubset--;
          // fuzziness.  If all blocks were complete, the was a merge in each and we know how many should be there.
          // But the counting is harder in the incomplete case.
          // So only test the complete case.
          if (numLeaf / blockSize === Math.floor(numLeaf / blockSize))
            ck.testExactNumber(numSubset, context.countRoots(), "Expected root count after merge at binary depth");
        }
        if (numLeaf / blockSize === Math.floor(numLeaf / blockSize))
          ck.testExactNumber(numLeaf / blockSize, context.countRoots(), "Expected root count after merge at binary depth");
      }
      // expect number of roots unchanged by sweep that queries every leaf.
      const numRoot0 = context.countRoots();
      const numLongPath0 = context.countNonTrivialPaths();
      for (let i = 0; i < numLeaf; i++)
        context.findRoot(i);
      const numRoot1 = context.countRoots();
      const numLongPath1 = context.countNonTrivialPaths();

      ck.testExactNumber(numRoot0, numRoot1, "Leaf queries do not change root count");
      ck.testLE(numLongPath1, numLongPath0, "Leaf queries can reduce number of long paths");
      ck.testExactNumber(0, numLongPath1, "Leaf queries eliminate long paths");    // is this really certain?
    }
    expect(ck.getNumErrors()).equals(0);
  });
});
