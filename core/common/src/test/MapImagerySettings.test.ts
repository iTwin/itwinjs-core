/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { MapImagerySettings } from "../MapImagerySettings";
import { ColorDef } from "../ColorDef";

describe("MapImagerySettings", () => {
  it("preserves black background base", () => {
    const baseline = MapImagerySettings.fromJSON({ backgroundBase: ColorDef.black.toJSON() });
    expect(baseline.backgroundBase).to.equal(ColorDef.black);

    const json = baseline.toJSON();
    expect(json.backgroundBase).to.equal(0);

    const roundTripped = MapImagerySettings.fromJSON(json);
    expect(roundTripped.backgroundBase).to.equal(ColorDef.black);
  });
});
