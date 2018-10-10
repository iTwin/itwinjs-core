/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { LinePixels, HiddenLine } from "@bentley/imodeljs-common";
import { LineCode, EdgeOverrides, FloatPreMulRgba, OvrFlags } from "@bentley/imodeljs-frontend/lib/webgl";

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

describe("EdgeOverrides", () => {
  it("default constructor sets flags to None", () => {
    expect(new EdgeOverrides().computeOvrFlags()).to.equal(OvrFlags.None);
  });
  it("anyOverridden returns true if flags is not equal to None", () => {
    expect(new EdgeOverrides().anyOverridden).to.equal(false);
    const override = new EdgeOverrides(undefined, true);
    expect(override.anyOverridden).to.equal(true);
    expect(override.computeOvrFlags()).to.equal(OvrFlags.Alpha);
  });
  it("init properly sets member values", () => {
    const override = new EdgeOverrides();
    let style = HiddenLine.Style.fromJSON({ ovrColor: true, color: 0xf00d, width: 0, pattern: 0 });
    const color = FloatPreMulRgba.fromColorDef(style.color!);
    override.init(true, style);
    expect(override.overridesColor).to.equal(true);
    expect(override.overridesWeight).to.equal(false);
    expect(override.color!.equals(color)).to.equal(true);
    expect(override.overridesAlpha).to.equal(true);
    expect(override.overridesLineCode).to.equal(true);
    expect(override.lineCode!).to.equal(LineCode.valueFromLinePixels(style.pattern!));

    style = HiddenLine.Style.fromJSON({ ovrColor: false, color: 0xf00c, width: 5, pattern: LinePixels.Invalid });
    override.init(false, style);
    expect(override.overridesColor).to.equal(false);
    expect(override.overridesWeight).to.equal(true);
    expect(override.weight!).to.equal(style.width);
    expect(override.overridesLineCode).to.equal(false);
    expect(override.overridesAlpha).to.equal(false);
  });
});
