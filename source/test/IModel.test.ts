/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ColorDef } from "../IModel";

class T1 {
  constructor(public t1?: boolean) { }
}

describe("ColorDef", () => {
  it("ColorDef should compare properly", () => {
    const color1 = new ColorDef(1, 2, 3, 0);
    const color2 = new ColorDef(1, 2, 3, 0);
    const color3 = new ColorDef(0xa, 2, 3, 0);
    const blue = ColorDef.blue();

    assert(color1.equals(color2), "A");
    assert(!color1.equals(blue), "B");

    const blueVal = blue.getRgba();
    assert(blueVal === 0xff0000);
    assert(blue.equals(ColorDef.fromRgba(blueVal)));

    color3.a = 0x30;
    assert(color3.equals(ColorDef.fromBytes(0xa, 2, 3, 0x30)));

    const b1 = new T1();
    const b2 = new T1(true);
    const b3 = new T1(false);
    if (b1.t1)
      assert(false);
    assert(b2.t1);
    if (b3.t1)
      assert(false);

  });
});
