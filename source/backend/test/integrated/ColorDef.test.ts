/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
});
