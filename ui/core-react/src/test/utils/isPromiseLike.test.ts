/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { isPromiseLike } from "../../core-react";

describe("isPromiseLike", () => {
  it("returns false for `undefined`", () => {
    expect(isPromiseLike(undefined)).to.be.false;
  });
  it("returns false for `null`", () => {
    expect(isPromiseLike(null)).to.be.false;
  });
  it("returns false for non-object type", () => {
    expect(isPromiseLike(123)).to.be.false;
  });
  it("returns false for function type", () => {
    expect(isPromiseLike(() => { })).to.be.false;
  });
  it("returns false for object without `then`", () => {
    expect(isPromiseLike({ blah: 123 })).to.be.false;
  });
  it("returns false for object with `then` of non-function type", () => {
    expect(isPromiseLike({ then: 123 })).to.be.false;
  });
  it("returns true for object with `then` of function type", () => {
    expect(isPromiseLike({ then: () => { } })).to.be.true;
  });
});
