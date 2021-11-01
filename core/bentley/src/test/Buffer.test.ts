/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { isBuffer } from "../core-bentley";

describe("Buffer", ()=> {
  describe("isBuffer", ()=>{
    it("returns true if the object is a buffer", ()=>{
      const bufferedString = Buffer.from("Hello World");
      const bufferTest = isBuffer(bufferedString);
      assert.equal(bufferTest, true);
    });
    it("returns false if the object is not a buffer", ()=>{
      const nonBufferedString = "Hello World";
      const bufferTest = isBuffer(nonBufferedString);
      assert.equal(bufferTest, false);
    });
  });
});
