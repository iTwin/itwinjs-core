/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { isLetter } from "../../appui-abstract";

describe("isLetter", () => {
  it("should return true for lower-case letters", () => {
    expect(isLetter("a")).to.be.true;
    expect(isLetter("z")).to.be.true;
  });

  it("should return true for upper-case letters", () => {
    expect(isLetter("A")).to.be.true;
    expect(isLetter("Z")).to.be.true;
  });

  it("should return false for numbers", () => {
    expect(isLetter("0")).to.be.false;
    expect(isLetter("9")).to.be.false;
  });

  it("should return false for punctuation", () => {
    expect(isLetter(".")).to.be.false;
    expect(isLetter(",")).to.be.false;
    expect(isLetter("-")).to.be.false;
    expect(isLetter("_")).to.be.false;
    expect(isLetter("{")).to.be.false;
    expect(isLetter("[")).to.be.false;
  });

  it("should return false if more than a single char", () => {
    expect(isLetter("Hi")).to.be.false;
  });
});
