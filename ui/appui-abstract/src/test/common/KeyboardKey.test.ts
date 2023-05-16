/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { isArrowKey, SpecialKey } from "../../appui-abstract";

describe("isArrowKey", () => {
  it("should return true if Up key", () => {
    expect(isArrowKey(SpecialKey.ArrowUp)).true;
  });

  it("should return true if Down key", () => {
    expect(isArrowKey(SpecialKey.ArrowDown)).true;
  });

  it("should return true if Left key", () => {
    expect(isArrowKey(SpecialKey.ArrowLeft)).true;
  });

  it("should return true if Right key", () => {
    expect(isArrowKey(SpecialKey.ArrowRight)).true;
  });

  it("should return false if Enter key", () => {
    expect(isArrowKey(SpecialKey.Enter)).false;
  });
});
