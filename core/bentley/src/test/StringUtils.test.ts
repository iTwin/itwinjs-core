/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { utf8ToString } from "../bentleyjs-core";

function expectString(utf8: number[], expected: string) {
  const bytes = new Uint8Array(utf8);
  const result = utf8ToString(bytes);
  expect(result).not.to.be.undefined;
  expect(result).to.equal(expected);
}

function expectUndefined(utf8: number[]) {
  const bytes = new Uint8Array(utf8);
  expect(utf8ToString(bytes)).to.be.undefined;
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

  it("rejects impossible bytes", () => {
    expectUndefined([0xfe]);
    expectUndefined([0xff]);
    expectUndefined([0xfe, 0xfe, 0xff, 0xff]);
  });

  it("rejects overlong sequences", () => {
    const overlong = [
      [0xc0, 0xaf],
      [0xe0, 0x80, 0xaf],
      [0xf0, 0x80, 0x80, 0xaf],
      [0xc1, 0xbf],
      [0xe0, 0x9f, 0xbf],
      [0xf0, 0x8f, 0xbf, 0xbf],
      [0xf8, 0x87, 0xbf, 0xbf, 0xbf],
      [0xfc, 0x83, 0xbf, 0xbf, 0xbf, 0xbf],
    ];

    for (const seq of overlong)
      expectUndefined(seq);
  });

  it("rejects invalid sequences", () => {
    const invalid = [
      [0xa0, 0xa1],
      [0xe2, 0x28, 0xa1],
      [0xf0, 0x28, 0x8c, 0xbc],
      [0xf0, 0x90, 0x28, 0xbc],
      [0xf0, 0x28, 0x8c, 0x28],
    ];

    for (const seq of invalid)
      expectUndefined(seq);
  });

  it("skips invalid bytes", () => {
    expectString([0xc3, 0x28], "(");
    expectString([0xe2, 0x82, 0x28], "(");
  });
});
