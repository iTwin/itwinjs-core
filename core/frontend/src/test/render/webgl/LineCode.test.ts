/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { LinePixels } from "@itwin/core-common";
import { LineCode } from "../../../render/webgl/LineCode";

describe("LineCode", () => {
  it("valueFromLinePixels correctly converts a LinePixel into a LineCode", () => {
    expect(LineCode.valueFromLinePixels(LinePixels.Code0)).toEqual(0);
    expect(LineCode.valueFromLinePixels(LinePixels.Code1)).toEqual(1);
    expect(LineCode.valueFromLinePixels(LinePixels.Code2)).toEqual(2);
    expect(LineCode.valueFromLinePixels(LinePixels.Code3)).toEqual(3);
    expect(LineCode.valueFromLinePixels(LinePixels.Code4)).toEqual(4);
    expect(LineCode.valueFromLinePixels(LinePixels.Code5)).toEqual(5);
    expect(LineCode.valueFromLinePixels(LinePixels.Code6)).toEqual(6);
    expect(LineCode.valueFromLinePixels(LinePixels.Code7)).toEqual(7);
    expect(LineCode.valueFromLinePixels(LinePixels.HiddenLine)).toEqual(8);
    expect(LineCode.valueFromLinePixels(LinePixels.Invisible)).toEqual(9);
    expect(LineCode.valueFromLinePixels(LinePixels.Solid)).toEqual(0);
    expect(LineCode.valueFromLinePixels(LinePixels.Invalid)).toEqual(0);
    expect(LineCode.valueFromLinePixels(12345678 as LinePixels)).toEqual(0);
  });
});
