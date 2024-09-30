/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { RgbColor } from "../RgbColor";

describe("RgbColor", () => {
  it("converts to hex string", () => {
    expect(new RgbColor(0, 255, 127).toHexString()).to.equal("#00ff7f");
    expect(new RgbColor(255, 254, 1).toHexString()).to.equal("#fffe01");
    expect(new RgbColor(15, 32, 138).toHexString()).to.equal("#0f208a");
  });
});
