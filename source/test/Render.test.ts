/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ViewFlags, RenderMode } from "../Render";

describe("Render", () => {

  it("ViewFlags", () => {
    const flags = new ViewFlags();
    assert(flags.acsTriad === false);
    assert(flags.grid === false);
    assert(flags.fill === true);
    assert(flags.renderMode === RenderMode.Wireframe);

    flags.renderMode = RenderMode.SmoothShade;
    flags.monochrome = true;
    const jsonstr = JSON.stringify(flags);
    const flags2 = ViewFlags.fromJSON(JSON.parse(jsonstr));
    assert(flags.acsTriad === flags2.acsTriad);
    assert(flags.renderMode === flags2.renderMode);
    assert(flags.monochrome === flags2.monochrome);
  });

});
