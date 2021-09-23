/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BentleyError, BentleyStatus, getErrorMessage, getErrorMetadata, getErrorProps, getErrorStack } from "../BentleyError";

describe("getErrorMessage", () => {
  it("returns string values", () => {
    expect(getErrorMessage("foo")).to.equal("foo");
    expect(getErrorMessage("")).to.equal("");
  });

  it("prefers Error.toString() to message property", () => {
    class CustomError extends Error {
      public override toString() { return "CustomToString"; }
    }
    expect(getErrorMessage(new Error("foo"))).to.equal("Error: foo");
    expect(getErrorMessage(new CustomError("foo"))).to.equal("CustomToString");
  });

  it("prefers message property to msg property", () => {
    const err = { message: "foo", msg: "bar", toString: () => "baz" };
    expect(getErrorMessage(err)).to.equal("foo");
  });

  it("prefers msg property to toString (on non-error object)", () => {
    const err = { msg: "foo", toString: () => "bar" };
    expect(getErrorMessage(err)).to.equal("foo");
  });

  it("returns useful toString output", () => {
    expect(getErrorMessage({ toString: () => "abc" })).to.equal("abc");
  });

  it("returns empty string for object with useless toString", () => {
    expect(getErrorMessage({})).to.equal("");
  });

  it("returns empty string for unsupported value types", () => {
    expect(getErrorMessage(null)).to.equal("");
    expect(getErrorMessage(undefined)).to.equal("");
    expect(getErrorMessage(5)).to.equal("");
    expect(getErrorMessage(BigInt(42))).to.equal("");
    expect(getErrorMessage(Symbol())).to.equal("");
    expect(getErrorMessage(true)).to.equal("");
    expect(getErrorMessage(false)).to.equal("");
    expect(getErrorMessage(() => "bad")).to.equal("");
  });
});

describe("getErrorStack", () => {
  it("returns stack from Error objects", () => {
    const err = new Error("foo");
    expect(err.stack).to.not.be.undefined;
    expect(getErrorStack(err)).to.equal(err.stack);
  });

  it("returns stack from non-Error objects", () => {
    expect(getErrorStack({ stack: "xyz" })).to.equal("xyz");
  });

  it("returns undefined for unsupported value types", () => {
    expect(getErrorStack("foo")).to.be.undefined;
    expect(getErrorStack(null)).to.be.undefined;
    expect(getErrorStack(undefined)).to.be.undefined;
    expect(getErrorStack(5)).to.be.undefined;
    expect(getErrorStack(BigInt(42))).to.be.undefined;
    expect(getErrorStack(Symbol())).to.be.undefined;
    expect(getErrorStack(true)).to.be.undefined;
    expect(getErrorStack(false)).to.be.undefined;
    expect(getErrorStack(() => "bad")).to.be.undefined;
  });

  it("returns undefined for unsupported stack property types", () => {
    expect(getErrorStack({ stack: {} })).be.undefined;
    expect(getErrorStack({ stack: null })).be.undefined;
    expect(getErrorStack({ stack: undefined })).be.undefined;
    expect(getErrorStack({ stack: 5 })).be.undefined;
    expect(getErrorStack({ stack: BigInt(42) })).be.undefined;
    expect(getErrorStack({ stack: Symbol() })).be.undefined;
    expect(getErrorStack({ stack: true })).be.undefined;
    expect(getErrorStack({ stack: false })).be.undefined;
    expect(getErrorStack({ stack: () => "bad" })).be.undefined;
  });
});

describe("getErrorMetadata", () => {
  it("returns metadata from BentleyError objects", () => {
    const metadata = { foo: "bar" };
    const err = new BentleyError(0, "message", () => metadata);
    expect(getErrorMetadata(err)).to.equal(metadata);
  });

  it("returns metadata from non-BentleyError objects", () => {
    const metadata = { prop: "value" };
    const err = { getMetaData: () => metadata };
    expect(getErrorMetadata(err)).to.equal(metadata);
  });

  it("returns undefined for unsupported value types", () => {
    expect(getErrorMetadata("foo")).to.be.undefined;
    expect(getErrorMetadata(null)).to.be.undefined;
    expect(getErrorMetadata(undefined)).to.be.undefined;
    expect(getErrorMetadata(5)).to.be.undefined;
    expect(getErrorMetadata(BigInt(42))).to.be.undefined;
    expect(getErrorMetadata(Symbol())).to.be.undefined;
    expect(getErrorMetadata(true)).to.be.undefined;
    expect(getErrorMetadata(false)).to.be.undefined;
    expect(getErrorMetadata(() => "bad")).to.be.undefined;
  });

  it("returns undefined for unsupported getMetaData property types", () => {
    expect(getErrorMetadata({ getMetaData: "foo" })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: null })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: undefined })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: 5 })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: BigInt(42) })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: Symbol() })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: true })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: false })).to.be.undefined;
  });

  it("returns undefined for unsupported getMetaData return types", () => {
    expect(getErrorMetadata({ getMetaData: () => "foo" })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: () => null })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: () => undefined })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: () => 5 })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: () => BigInt(42) })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: () => Symbol() })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: () => true })).to.be.undefined;
    expect(getErrorMetadata({ getMetaData: () => false })).to.be.undefined;
  });
});

describe("getErrorProps", () => {
  it("properly converts BentleyError objects", () => {
    const err = new BentleyError(BentleyStatus.SUCCESS, "message");
    const serialized = getErrorProps(err);
    expect(serialized).to.be.an("object");
    expect(serialized).to.eql({ message: err.toString(), stack: err.stack });
    expect(serialized).to.not.have.property("metadata");
  });

  it("properly converts BentleyErrors with metadata", () => {
    const metadata = { prop: "value" };
    const err = new BentleyError(BentleyStatus.ERROR, "fail", () => metadata);
    const serialized = getErrorProps(err);
    expect(serialized).to.be.an("object");
    expect(serialized).to.eql({ message: err.toString(), stack: err.stack, metadata });
  });

  it("returns values that can safely be JSON round-tripped", () => {
    const err = new BentleyError(BentleyStatus.ERROR, "fail", () => ({ prop: "value" }));
    // Regular Error objects can NOT be JSON round-tripped
    expect(JSON.parse(JSON.stringify(err))).to.not.eql(err);
    const serialized = getErrorProps(err);
    expect(JSON.parse(JSON.stringify(serialized))).to.eql(serialized);
  });

  it("safely handles unsupported value types", () => {
    expect(getErrorProps("foo")).to.eql({ message: "foo" });
    expect(getErrorProps(null)).to.eql({ message: "" });
    expect(getErrorProps(undefined)).to.eql({ message: "" });
    expect(getErrorProps(5)).to.eql({ message: "" });
    expect(getErrorProps(BigInt(42))).to.eql({ message: "" });
    expect(getErrorProps(Symbol())).to.eql({ message: "" });
    expect(getErrorProps(true)).to.eql({ message: "" });
    expect(getErrorProps(false)).to.eql({ message: "" });
    expect(getErrorProps(() => "bad")).to.eql({ message: "" });
  });
});
