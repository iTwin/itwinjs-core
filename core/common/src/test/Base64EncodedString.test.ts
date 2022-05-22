/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Base64EncodedString } from "../Base64EncodedString";

function expectEqualUint8Arrays(actual: Uint8Array, expected: Uint8Array) {
  expect(actual.length).to.equal(expected.length);
  for (let i = 0; i < actual.length; i++)
    expect(actual[i]).to.equal(expected[i]);
}

describe("Base64EncodedString", () => {
  it("should always include prefix", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const base64 = Base64EncodedString.fromUint8Array(bytes);
    expect(base64.startsWith(Base64EncodedString.prefix)).to.be.true;

    expectEqualUint8Arrays(Base64EncodedString.toUint8Array(base64), bytes);
  });

  it("should accept input without prefix", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const base64 = Base64EncodedString.fromUint8Array(bytes).substr(Base64EncodedString.prefix.length);
    expectEqualUint8Arrays(Base64EncodedString.toUint8Array(base64), bytes);
  });

  it("should round-trip an empty array", () => {
    const bytes = new Uint8Array(0);
    const base64 = Base64EncodedString.fromUint8Array(bytes);
    expect(base64.length).to.equal(Base64EncodedString.prefix.length);
    expect(Base64EncodedString.toUint8Array(base64).length).to.equal(0);
  });

  it("should round-trip through JSON", () => {
    interface ThingProps {
      name: string;
      data: Base64EncodedString;
    }

    interface Thing {
      name: string;
      data: Uint8Array;
    }

    const thing: Thing = { name: "thing", data: new Uint8Array([1, 2, 3, 4]) };

    const propsString = JSON.stringify(thing, Base64EncodedString.replacer);
    const props = JSON.parse(propsString) as ThingProps;
    expect(props.data).to.equal(Base64EncodedString.fromUint8Array(thing.data));
    expect(props.name).to.equal(thing.name);

    const thing2 = JSON.parse(propsString, Base64EncodedString.reviver) as Thing;
    expect(thing2.name).to.equal(thing.name);
    expectEqualUint8Arrays(thing2.data, thing.data);
  });
});
