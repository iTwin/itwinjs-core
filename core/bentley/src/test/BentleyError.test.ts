/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BentleyError, BentleyStatus } from "../BentleyError";

describe("BentleyError.getErrorMessage", () => {
  it("returns string values", () => {
    expect(BentleyError.getErrorMessage("foo")).to.equal("foo");
    expect(BentleyError.getErrorMessage("")).to.equal("");
  });

  it("prefers Error.toString() to message property", () => {
    class CustomError extends Error {
      public override toString() { return "CustomToString"; }
    }
    expect(BentleyError.getErrorMessage(new Error("foo"))).to.equal("Error: foo");
    expect(BentleyError.getErrorMessage(new CustomError("foo"))).to.equal("CustomToString");
  });

  it("prefers message property to msg property", () => {
    const err = { message: "foo", msg: "bar", toString: () => "baz" };
    expect(BentleyError.getErrorMessage(err)).to.equal("foo");
  });

  it("prefers msg property to toString (on non-error object)", () => {
    const err = { msg: "foo", toString: () => "bar" };
    expect(BentleyError.getErrorMessage(err)).to.equal("foo");
  });

  it("returns useful toString output", () => {
    expect(BentleyError.getErrorMessage({ toString: () => "abc" })).to.equal("abc");
  });

  it("returns empty string for object with useless toString", () => {
    expect(BentleyError.getErrorMessage({})).to.equal("");
  });

  it("returns empty string for unsupported value types", () => {
    expect(BentleyError.getErrorMessage(null)).to.equal("");
    expect(BentleyError.getErrorMessage(undefined)).to.equal("");
    expect(BentleyError.getErrorMessage(5)).to.equal("");
    expect(BentleyError.getErrorMessage(BigInt(42))).to.equal("");
    expect(BentleyError.getErrorMessage(Symbol())).to.equal("");
    expect(BentleyError.getErrorMessage(true)).to.equal("");
    expect(BentleyError.getErrorMessage(false)).to.equal("");
    expect(BentleyError.getErrorMessage(() => "bad")).to.equal("");
  });
});

describe("BentleyError.getErrorStack", () => {
  it("returns stack from Error objects", () => {
    const err = new Error("foo");
    expect(err.stack).to.not.be.undefined;
    expect(BentleyError.getErrorStack(err)).to.equal(err.stack);
  });

  it("returns stack from non-Error objects", () => {
    expect(BentleyError.getErrorStack({ stack: "xyz" })).to.equal("xyz");
  });

  it("returns undefined for unsupported value types", () => {
    expect(BentleyError.getErrorStack("foo")).to.be.undefined;
    expect(BentleyError.getErrorStack(null)).to.be.undefined;
    expect(BentleyError.getErrorStack(undefined)).to.be.undefined;
    expect(BentleyError.getErrorStack(5)).to.be.undefined;
    expect(BentleyError.getErrorStack(BigInt(42))).to.be.undefined;
    expect(BentleyError.getErrorStack(Symbol())).to.be.undefined;
    expect(BentleyError.getErrorStack(true)).to.be.undefined;
    expect(BentleyError.getErrorStack(false)).to.be.undefined;
    expect(BentleyError.getErrorStack(() => "bad")).to.be.undefined;
  });

  it("returns undefined for unsupported stack property types", () => {
    expect(BentleyError.getErrorStack({ stack: {} })).be.undefined;
    expect(BentleyError.getErrorStack({ stack: null })).be.undefined;
    expect(BentleyError.getErrorStack({ stack: undefined })).be.undefined;
    expect(BentleyError.getErrorStack({ stack: 5 })).be.undefined;
    expect(BentleyError.getErrorStack({ stack: BigInt(42) })).be.undefined;
    expect(BentleyError.getErrorStack({ stack: Symbol() })).be.undefined;
    expect(BentleyError.getErrorStack({ stack: true })).be.undefined;
    expect(BentleyError.getErrorStack({ stack: false })).be.undefined;
    expect(BentleyError.getErrorStack({ stack: () => "bad" })).be.undefined;
  });
});

describe("BentleyError.getErrorMetadata", () => {
  it("returns metadata from BentleyError objects", () => {
    const metadata = { foo: "bar" };
    const err = new BentleyError(0, "message", () => metadata);
    expect(BentleyError.getErrorMetadata(err)).to.equal(metadata);
  });

  it("returns metadata from non-BentleyError objects", () => {
    const metadata = { prop: "value" };
    const err = { getMetaData: () => metadata };
    expect(BentleyError.getErrorMetadata(err)).to.equal(metadata);
  });

  it("returns undefined for unsupported value types", () => {
    expect(BentleyError.getErrorMetadata("foo")).to.be.undefined;
    expect(BentleyError.getErrorMetadata(null)).to.be.undefined;
    expect(BentleyError.getErrorMetadata(undefined)).to.be.undefined;
    expect(BentleyError.getErrorMetadata(5)).to.be.undefined;
    expect(BentleyError.getErrorMetadata(BigInt(42))).to.be.undefined;
    expect(BentleyError.getErrorMetadata(Symbol())).to.be.undefined;
    expect(BentleyError.getErrorMetadata(true)).to.be.undefined;
    expect(BentleyError.getErrorMetadata(false)).to.be.undefined;
    expect(BentleyError.getErrorMetadata(() => "bad")).to.be.undefined;
  });

  it("returns undefined for unsupported getMetaData property types", () => {
    expect(BentleyError.getErrorMetadata({ getMetaData: "foo" })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: null })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: undefined })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: 5 })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: BigInt(42) })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: Symbol() })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: true })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: false })).to.be.undefined;
  });

  it("returns undefined for unsupported getMetaData return types", () => {
    expect(BentleyError.getErrorMetadata({ getMetaData: () => "foo" })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: () => null })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: () => undefined })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: () => 5 })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: () => BigInt(42) })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: () => Symbol() })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: () => true })).to.be.undefined;
    expect(BentleyError.getErrorMetadata({ getMetaData: () => false })).to.be.undefined;
  });
});

describe("BentleyError.getErrorProps", () => {
  it("properly converts BentleyError objects", () => {
    const err = new BentleyError(BentleyStatus.SUCCESS, "message");
    const serialized = BentleyError.getErrorProps(err);
    expect(serialized).to.be.an("object");
    expect(serialized).to.eql({ message: err.toString(), stack: err.stack });
    expect(serialized).to.not.have.property("metadata");
  });

  it("properly converts BentleyErrors with metadata", () => {
    const metadata = { prop: "value" };
    const err = new BentleyError(BentleyStatus.ERROR, "fail", () => metadata);
    const serialized = BentleyError.getErrorProps(err);
    expect(serialized).to.be.an("object");
    expect(serialized).to.eql({ message: err.toString(), stack: err.stack, metadata });
  });

  it("returns values that can safely be JSON round-tripped", () => {
    const err = new BentleyError(BentleyStatus.ERROR, "fail", () => ({ prop: "value" }));
    // Regular Error objects can NOT be JSON round-tripped
    expect(JSON.parse(JSON.stringify(err))).to.not.eql(err);
    const serialized = BentleyError.getErrorProps(err);
    expect(JSON.parse(JSON.stringify(serialized))).to.eql(serialized);
  });

  it("safely handles unsupported value types", () => {
    expect(BentleyError.getErrorProps("foo")).to.eql({ message: "foo" });
    expect(BentleyError.getErrorProps(null)).to.eql({ message: "" });
    expect(BentleyError.getErrorProps(undefined)).to.eql({ message: "" });
    expect(BentleyError.getErrorProps(5)).to.eql({ message: "" });
    expect(BentleyError.getErrorProps(BigInt(42))).to.eql({ message: "" });
    expect(BentleyError.getErrorProps(Symbol())).to.eql({ message: "" });
    expect(BentleyError.getErrorProps(true)).to.eql({ message: "" });
    expect(BentleyError.getErrorProps(false)).to.eql({ message: "" });
    expect(BentleyError.getErrorProps(() => "bad")).to.eql({ message: "" });
  });
});
