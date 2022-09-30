/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { RpcMarshaling, RpcSerializedValue } from "../rpc/core/RpcMarshaling";

describe("RpcMarshaling.deserialize", () => {
  it("should deserialize valid JSON", () => {
    const a = RpcMarshaling.deserialize(undefined, RpcSerializedValue.create(`{ "foo": "bar" }`));
    expect(a).to.eql({ foo: "bar" });

    const b = RpcMarshaling.deserialize(undefined, RpcSerializedValue.create(`[ "foo", "bar" ]`));
    expect(b).to.eql(["foo", "bar"]);

    const c = RpcMarshaling.deserialize(undefined, RpcSerializedValue.create(`"foobar"`));
    expect(c).to.eql("foobar");
  });

  it("should deserialize empty string as undefined", () => {
    const deserialized = RpcMarshaling.deserialize(undefined, RpcSerializedValue.create(""));
    expect(deserialized).to.be.undefined;
  });

  it("should throw for invalid JSON", () => {
    const val = RpcSerializedValue.create("This is not JSON!");
    expect(() => RpcMarshaling.deserialize(undefined, val)).to.throw(`Invalid JSON: "This is not JSON!"`);
  });

  it("should throw for JSON missing binary", () => {
    const val = RpcSerializedValue.create(`{ "isBinary": true, "index": 1 }`, []);
    expect(() => RpcMarshaling.deserialize(undefined, val)).to.throw("Cannot unmarshal missing binary value.");
  });
});
