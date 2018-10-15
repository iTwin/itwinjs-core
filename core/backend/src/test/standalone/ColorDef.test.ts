/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ColorDef, ColorByName } from "@bentley/imodeljs-common";

describe("ColorDef", () => {
  it("should compare ColorDef RGB values", () => {
    const cadetBlue = new ColorDef(ColorByName.cadetBlue);
    assert.equal(cadetBlue.tbgr, ColorByName.cadetBlue);
    assert.equal(cadetBlue.getRgb(), 0x5f9ea0);
    assert.equal(cadetBlue.toHexString(), "#5f9ea0");
    assert.equal(cadetBlue.getRgb(), ColorDef.from(0x5f, 0x9e, 0xa0).getRgb());
    assert.equal(cadetBlue.getRgb(), ColorDef.from(95, 158, 160).getRgb());
    assert.equal(cadetBlue.toRgbString(), "rgb(95,158,160)");
    assert.equal(cadetBlue.tbgr, new ColorDef("cadetblue").tbgr, "Expect case insensitive compare");
    assert.equal(cadetBlue.getRgb(), new ColorDef("cadetBlue").getRgb());
  });

  it("ColorDef should compare properly", () => {
    const color1 = ColorDef.from(1, 2, 3, 0);
    const color2 = ColorDef.from(1, 2, 3);
    const color3 = ColorDef.from(0xa, 2, 3, 0);
    const blue = ColorDef.blue;

    assert.isTrue(color1.equals(color2), "color1 should equal color2");
    assert.isNotTrue(color1.equals(blue), "color1 should not equal blue");

    assert.equal(blue.tbgr, ColorByName.blue);
    assert.equal(blue.getRgb(), 0xff);
    assert.isTrue(blue.equals(new ColorDef(blue)));

    const colors = color3.colors;
    ColorDef.from(colors.r, colors.g, colors.b, 0x30, color3);
    assert.isTrue(color3.equals(ColorDef.from(0xa, 2, 3, 0x30)));

    // cornflowerBlue: 0xED9564,
    const cfg = new ColorDef(ColorByName.cornflowerBlue);
    assert.isTrue(cfg.equals(ColorDef.from(0x64, 0x95, 0xed)));

    const yellow = new ColorDef("yellow");
    const yellow2 = new ColorDef(ColorByName.yellow);
    assert.isTrue(yellow.equals(yellow2));
    assert.equal(yellow.name, "yellow");
    assert.isUndefined(color1.name, "no color name");

    const yellow3 = new ColorDef("#FFFF00");
    assert.isTrue(yellow.equals(yellow3));
    let yellow4 = new ColorDef("rgbA(255,255,0,255)");
    assert.isTrue(yellow.equals(yellow4));
    yellow4 = new ColorDef("rgb(255,255,0)");
    assert.isTrue(yellow.equals(yellow4));
    yellow4 = new ColorDef("Yellow"); // wrong case, should still work
    assert.isTrue(yellow.equals(yellow4));
    const yellow5 = new ColorDef("rgba(255,255,0,200)");
    assert.isTrue(yellow.getRgb() === yellow5.getRgb());
    assert.equal(200, yellow5.getAlpha());
    const str = yellow.toHexString();
    const str2 = yellow.toRgbString();
    yellow4 = new ColorDef(str);
    assert.isTrue(yellow.equals(yellow4));
    yellow4 = new ColorDef(str2);
    assert.isTrue(yellow.equals(yellow4));
    const hsl = yellow.toHSL();
    yellow4 = hsl.toColorDef();
    assert.isTrue(yellow.equals(yellow4));

    color1.tbgr = 0x123456; // no transparency
    assert.equal(color1.tbgr, 0x123456);

    color1.tbgr = 0xf0123456; // make sure this works if high-bit is set
    assert.equal(color1.tbgr, 0xf0123456);

    color1.tbgr = 0xff00000000; // try it with a number bigger than 32 bits
    assert.equal(color1.tbgr, 0); // should get truncated

    color1.tbgr = 1.1;
    assert.equal(color1.tbgr, 1); // should get rounded down
  });
});
