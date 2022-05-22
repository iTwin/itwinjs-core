/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { LinePixels } from "@itwin/core-common";
import { LineCode } from "../../../render/webgl/LineCode";

describe("LineCode", () => {
  it("valueFromLinePixels correctly converts a LinePixel into a LineCode", () => {
    expect(LineCode.valueFromLinePixels(LinePixels.Code0)).to.equal(0);
    expect(LineCode.valueFromLinePixels(LinePixels.Code1)).to.equal(1);
    expect(LineCode.valueFromLinePixels(LinePixels.Code2)).to.equal(2);
    expect(LineCode.valueFromLinePixels(LinePixels.Code3)).to.equal(3);
    expect(LineCode.valueFromLinePixels(LinePixels.Code4)).to.equal(4);
    expect(LineCode.valueFromLinePixels(LinePixels.Code5)).to.equal(5);
    expect(LineCode.valueFromLinePixels(LinePixels.Code6)).to.equal(6);
    expect(LineCode.valueFromLinePixels(LinePixels.Code7)).to.equal(7);
    expect(LineCode.valueFromLinePixels(LinePixels.HiddenLine)).to.equal(8);
    expect(LineCode.valueFromLinePixels(LinePixels.Invisible)).to.equal(9);
    expect(LineCode.valueFromLinePixels(LinePixels.Solid)).to.equal(0);
    expect(LineCode.valueFromLinePixels(LinePixels.Invalid)).to.equal(0);
    expect(LineCode.valueFromLinePixels(12345678)).to.equal(0);
  });
});
