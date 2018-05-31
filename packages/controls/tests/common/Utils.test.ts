/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as utils from "@src/common/Utils";

describe("Utils", () => {

  describe("prioritySortFunction", () => {

    it("sorts by priority", () => {
      const arr = [
        { priority: 2 },
        { priority: 3 },
        { priority: 3 },
        { priority: 1 },
      ];
      arr.sort(utils.prioritySortFunction);
      expect(arr).to.deep.eq([
        { priority: 3 },
        { priority: 3 },
        { priority: 2 },
        { priority: 1 },
      ]);
    });

  });

});
