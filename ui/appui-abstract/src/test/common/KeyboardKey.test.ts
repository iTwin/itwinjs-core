/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { isArrowKey, SpecialKey } from "../../appui-abstract";

describe("isArrowKey", () => {
  it("should return true if Up key", () => {
    isArrowKey(SpecialKey.ArrowUp).should.true;
  });

  it("should return true if Down key", () => {
    isArrowKey(SpecialKey.ArrowDown).should.true;
  });

  it("should return true if Left key", () => {
    isArrowKey(SpecialKey.ArrowLeft).should.true;
  });

  it("should return true if Right key", () => {
    isArrowKey(SpecialKey.ArrowRight).should.true;
  });

  it("should return false if Enter key", () => {
    isArrowKey(SpecialKey.Enter).should.false;
  });
});
