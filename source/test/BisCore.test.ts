/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { BisCore, BisClass } from "../Biscore";

describe("BisCore tests", () => {

  it("BisCore enum values should have 'BisCore.' prefix, BisClass enum values should not", () => {
    assert.equal(BisCore.Element, BisCore.Schema + "." + BisClass.Element);
  });

});
