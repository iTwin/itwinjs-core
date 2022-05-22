/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { utf8ToString, utf8ToStringPolyfill } from "../core-bentley";

function expectString(utf8: number[], expected: string) {
  const bytes = new Uint8Array(utf8);
  let result = utf8ToString(bytes);
  expect(result).not.to.be.undefined;
  expect(result).to.equal(expected);

  result = utf8ToStringPolyfill(bytes);
  expect(result).not.to.be.undefined;
  expect(result).to.equal(expected);
}

describe("utf8ToString", () => {
  it("converts ascii", () => {
    const utf8 = [0x69, 0x4d, 0x6f, 0x64, 0x65, 0x6C, 0x4a, 0x73];
    expectString(utf8, "iModelJs");
  });

  it("converts an empty string", () => {
    expectString([], "");
  });

  it("converts 2-byte utf-8 code points", () => {
    expectString([0x5a, 0xc3, 0xbc, 0x72, 0x69, 0x63, 0x68], "Zürich");
    expectString([0xc2, 0xa1, 0xc2, 0xa2, 0xc2, 0xab, 0xd0, 0x88], "\u00A1\u00A2\u00AB\u0408");
  });

  it("converts 3-byte utf-8 code points", () => {
    expectString([0xe0, 0xa2, 0xa0], "ࢠ");
    expectString([0xe0, 0xa0, 0x80, 0xe0, 0xb7, 0x83, 0xe1, 0x8a, 0x81], "\u0800\u0DC3\u1281");
  });

  it("converts 4-byte utf-8 code points", () => {
    expectString([0xf0, 0x90, 0x8a, 0x81], "\uD800\uDE81");
    expectString([0xf0, 0x9f, 0x9c, 0x81], "\uD83D\uDF01");
  });

  it("converts a mix of code points", () => {
    expectString([0x69, 0xf0, 0x9f, 0x9c, 0x81, 0xc3, 0xbc, 0xe1, 0x8a, 0x81], "i\uD83D\uDF01ü\u1281");
  });
});
