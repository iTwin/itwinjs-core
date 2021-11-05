/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { assert, setAssertionsEnabled } from "../Assert";

describe("assert", () => {
  let wereAssertionsEnabled: boolean;

  beforeEach(() => wereAssertionsEnabled = setAssertionsEnabled(true));
  afterEach(() => setAssertionsEnabled(wereAssertionsEnabled));

  it("only throws if enabled", () => {
    expect(() => assert(false)).to.throw("Assert: Programmer Error");
    setAssertionsEnabled(false);
    expect(() => assert(false)).not.to.throw;
    setAssertionsEnabled(true);
    expect(() => assert(false)).to.throw("Assert: Programmer Error");
  });

  it("only throws if condition is false", () => {
    expect(() => assert(false)).to.throw("Assert: Programmer Error");
    expect(() => assert(true)).not.to.throw("Assert: Programmer Error");
  });

  it("includes message in error if supplied", () => {
    expect(() => assert(false, "ruh-roh!")).to.throw("Assert: ruh-roh!");
  });

  it("accepts a function for condition or message", () => {
    expect(() => assert(() => false)).to.throw("Assert: Programmer Error");
    expect(() => assert(() => true)).not.to.throw;
    expect(() => assert(false, () => "Danger Will Robinson!")).to.throw("Assert: Danger Will Robinson!");
  });

  it("only evaluates condition function if enabled", () => {
    let called = false;
    const condition = () => { called = true; return false; }
    setAssertionsEnabled(false);
    assert(() => condition);
    expect(called).to.be.false;

    setAssertionsEnabled(true);
    try {
      assert(condition);
    } catch (_) { }
    expect(called).to.be.true;
  });

  it("only evaluates message function if condition is false", () => {
    let called = false;
    const message = () => { called = true; return "message"; }

    assert(true, message);
    expect(called).to.be.false;

    try {
      assert(false, message);
    } catch (_) { }
    expect(called).to.be.true;
  });
});
