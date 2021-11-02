/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { expect } from "chai";
import { MaskManager } from "../../topology/MaskManager";
import { Checker } from "../Checker";

describe("MaskManager", () => {

  it("HelloWorld", () => {
    const ck = new Checker();
    const allFreeMasks = 0x000F0F00;
    const numFreeMasks = 8;
    ck.testUndefined(MaskManager.create(0), " Expect undefined when no masks are provided.");
    const manager = MaskManager.create(allFreeMasks)!;
    ck.testDefined(manager, "Mask manager created");
    const grabList = [];
    // grab every mask  (several times)
    // verify that each is unique
    // verify that there are none left
    for (let pass = 0; pass < 10; pass++) {
      for (let i = 0; i < numFreeMasks; i++) {
        const q = manager.grabMask();
        if (ck.testTrue(q > 0, "grab mask")) {
          for (const q1 of grabList)
            ck.testFalse(q === q1, "should not get same mask");
          grabList.push(q);
        }
      }
      ck.testExactNumber(0, manager.grabMask(), "Should run out of masks");
      for (const q of grabList) {
        manager.dropMask(q);
      }
      grabList.length = 0;
    }

    expect(ck.getNumErrors()).equals(0);
  });

});
