/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { readPntsColors } from "../../tile/internal";
import { ByteStream } from "@itwin/core-bentley";

describe("readPntsColors", () => {
  it("reads RGB", () => {
    const pntsProps = {
      POINTS_LENGTH: 3,
      POSITION: { byteOffset: -999 },
      RGB: { byteOffset: 0 },
    };

    const rgb = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const stream = ByteStream.fromUint8Array(new Uint8Array(rgb));
    const result = readPntsColors(stream, 0, pntsProps)!;
    expect(Array.from(result)).to.deep.equal(rgb);
  });

  it("converts RGBA to RGB", () => {
    const pntsProps = {
      POINTS_LENGTH: 3,
      POSITION: { byteOffset: -999 },
      RGBA: { byteOffset: 0 },
    };

    const stream = ByteStream.fromUint8Array(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
    const result = readPntsColors(stream, 0, pntsProps)!;
    expect(Array.from(result)).to.deep.equal([0, 1, 2, 4, 5, 6, 8, 9, 10]);
  });
});
