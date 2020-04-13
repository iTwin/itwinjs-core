/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ViewFlags, RenderMode } from "../ViewFlags";

describe("ViewFlags", () => {
  it("should initialize to expected defaults", () => {
    const flags = new ViewFlags();
    assert(flags.acsTriad === false);
    assert(flags.grid === false);
    assert(flags.fill === true);
    assert(flags.renderMode === RenderMode.Wireframe);
  });

  it("should round-trip through JSON", () => {
    const flags = new ViewFlags();
    flags.renderMode = RenderMode.SmoothShade;
    flags.monochrome = true;
    const jsonstr = JSON.stringify(flags);
    const flags2 = ViewFlags.fromJSON(JSON.parse(jsonstr));
    assert(flags.acsTriad === flags2.acsTriad);
    assert(flags.renderMode === flags2.renderMode);
    assert(flags.monochrome === flags2.monochrome);
  });
});
