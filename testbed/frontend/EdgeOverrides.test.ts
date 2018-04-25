/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { LinePixels, HiddenLine } from "@bentley/imodeljs-common";
import { LineCode, EdgeOverrides, FloatPreMulRgba, OvrFlags } from "@bentley/imodeljs-frontend/lib/rendering";

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
    let style = new HiddenLine.Style({ ovrColor: true, color: 0xf00d, width: 0, pattern: 0 });
    let color = new FloatPreMulRgba();
    override.init(style, true);
    color.initFromColorDef(style.color);
    assert.isTrue(override.isOverridden(OvrFlags.Rgba), "if style's ovrColor is true, then flags contains Rgba"); //tslint:disable-line
    assert.isFalse(override.isOverridden(OvrFlags.Weight), "if style's weight is 0, then flags does not contain Weight");//tslint:disable-line
    assert.isTrue(override.color.equals(color), "if style's ovrColor is true, then color is equivalent to style's color as FlatPreMulRgba");
    assert.isTrue(override.weight === style.width, "style's width is equivalent to the weight");
    assert.isTrue(override.isOverridden(OvrFlags.Alpha), "if forceOpaque is true, then flags contains Alpha");//tslint:disable-line
    assert.isTrue(override.isOverridden(OvrFlags.LineCode), "if style's pattern is valid, then flags contain LineCode");//tslint:disable-line
    expect(override.lineCode).to.equal(LineCode.valueFromLinePixels(style.pattern));

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
    assert.isTrue(LinePixels.Solid === override.lineCode, "if style's pattern is invalid, then lineCode is set to solid");
    assert.isFalse(override.isOverridden(OvrFlags.Alpha), "if forceOpaque is false then flags is not equal to Alpha");//tslint:disable-line
  });
});
