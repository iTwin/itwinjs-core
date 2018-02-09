/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { LinePixels, HiddenLine } from "../../common/Render";
import { LineCode, EdgeOverrides } from "../../frontend/render/EdgeOverrides";
import { FloatPreMulRgba } from "../../frontend/render/FloatRGBA";
import { OvrFlags } from "../../frontend/render/RenderFlags";

describe("LineCode", () => {
  it("valueFromLinePixels correctly converts a LinePixel into a LineCode", () => {
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.Code0) === 0, "Code0 equals 0");
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.Code1) === 1, "Code1 equals 1");
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.Code2) === 2, "Code2 equals 2");
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.Code3) === 3, "Code3 equals 3");
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.Code4) === 4, "Code4 equals 4");
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.Code5) === 5, "Code5 equals 5");
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.Code6) === 6, "Code6 equals 6");
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.Code7) === 7, "Code7 equals 7");
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.HiddenLine) === 8, "HiddenLine equals 8");
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.Invisible) === 9, "HiddenLine equals 9");
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.Solid) === 0, "Solid equals 0");
    assert.isTrue(LineCode.valueFromLinePixels(LinePixels.Invalid) === 0, "Invalid equals 0");
  });
  it("constructor correctly sets value", () => {
    assert.isTrue(new LineCode().value === 0, "default constructor set value to 0");
    assert.isTrue(new LineCode(LinePixels.Code0).value === 0, "default constructor set value to 0");
    assert.isTrue(new LineCode(LinePixels.Code1).value === 1, "constructed from Code1, value equals 1");
    assert.isTrue(new LineCode(LinePixels.Code2).value === 2, "constructed from Code2, value equals 2");
    assert.isTrue(new LineCode(LinePixels.Code3).value === 3, "constructed from Code3, value equals 3");
    assert.isTrue(new LineCode(LinePixels.Code4).value === 4, "constructed from Code4, value equals 4");
    assert.isTrue(new LineCode(LinePixels.Code5).value === 5, "constructed from Code5, value equals 5");
    assert.isTrue(new LineCode(LinePixels.Code6).value === 6, "constructed from Code6, value equals 6");
    assert.isTrue(new LineCode(LinePixels.Code7).value === 7, "constructed from Code7, value equals 7");
    assert.isTrue(new LineCode(LinePixels.HiddenLine).value === 8, "constructed from HiddenLine, value equals 8");
    assert.isTrue(new LineCode(LinePixels.Invisible).value === 9, "constructed from Invisible, value equals 9");
    assert.isTrue(new LineCode(LinePixels.Solid).value === 0, "constructed from Solid, value equals 0");
    assert.isTrue(new LineCode(LinePixels.Invalid).value === 0, "constructed from Invalid, value equals 0");
  });
  it("count equals 10", () => {
    assert.isTrue(LineCode.count === 10);
  });
});

describe("EdgeOverrides", () => {
  it("default constructor sets flags to None", () => {
    assert.isTrue(new EdgeOverrides().flags === OvrFlags.None);
  });
  it("anyOverridden returns true if flags is not equal to None", () => {
    assert.isFalse(new EdgeOverrides().anyOverridden(), "default is false");
    let override = new EdgeOverrides();
    override.flags |= OvrFlags.Alpha;
    assert.isTrue(override.anyOverridden(), "true if flags set to OvrFlag other than None");
    override = new EdgeOverrides();
    override.flags = OvrFlags.None;
    assert.isFalse(override.anyOverridden(), "false if flags set to None");
  });
  it("isOverridden returns true if given flag is equivalent to member flag", () => {
    let override = new EdgeOverrides();
    override.flags = OvrFlags.Alpha;
    assert.isTrue(override.isOverridden(OvrFlags.Alpha), "true if flag is overridden");
    override = new EdgeOverrides();
    override.flags = OvrFlags.LineCode;
    assert.isFalse(override.isOverridden(OvrFlags.Alpha), "false if given flag not overridden");
  });
  it("init properly sets member values", () => {
    let override = new EdgeOverrides();
    let style = new HiddenLine.Style({ ovrColor: true, color: 0xf00d, width: 0, pattern: 0  });
    let color = new FloatPreMulRgba();
    override.init(style, true);
    color.initFromColorDef(style.color);
    assert.isTrue(override.isOverridden(OvrFlags.Rgba), "if style's ovrColor is true, then flags contains Rgba"); //tslint:disable-line
    assert.isFalse(override.isOverridden(OvrFlags.Weight), "if style's weight is 0, then flags does not contain Weight");//tslint:disable-line
    assert.isTrue(override.color.equals(color), "if style's ovrColor is true, then color is equivalent to style's color as FlatPreMulRgba");
    assert.isTrue(0.0 === override.weight, "if style's width is 0, weight is 0");
    assert.isTrue(override.isOverridden(OvrFlags.Alpha), "if forceOpaque is true, then flags contains Alpha");//tslint:disable-line
    assert.isTrue(override.isOverridden(OvrFlags.LineCode), "if style's pattern is valid, then flags contain LineCode");//tslint:disable-line
    assert.isTrue(override.lineCode.value === new LineCode(style.pattern).value, "if style's pattern is valid, then lineCode is equivalent to its pattern as LineCode");

    style = new HiddenLine.Style({ ovrColor: false, color: 0xf00c, width: 5, pattern: 0xffffffff });
    color = new FloatPreMulRgba();
    color.initFromColorDef(style.color);
    override = new EdgeOverrides();
    override.init(style, false);
    assert.isFalse(override.isOverridden(OvrFlags.Rgba), "if style's ovrColor is false, then flags does not contain Rgba");//tslint:disable-line
    assert.isFalse(override.color.equals(color), "if style's ovrColor is false, then color isn't set");
    assert.isTrue(override.isOverridden(OvrFlags.Weight), "if style's width not equal to 0, then flags contain Weight");//tslint:disable-line
    assert.isTrue(override.weight === style.width, "if style's width isn't 0, then weight is equivalent to its width");
    assert.isFalse(override.isOverridden(OvrFlags.LineCode), "if style's pattern is invalid, then flags does not contains LineCode");//tslint:disable-line
    assert.isTrue(LinePixels.Solid === override.lineCode.value, "if style's pattern is invalid, then lineCode is set to solid");
    assert.isFalse(override.isOverridden(OvrFlags.Alpha), "if forceOpaque is false then flags is not equal to Alpha");//tslint:disable-line
  });
});
