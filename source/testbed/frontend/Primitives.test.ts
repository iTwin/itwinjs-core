/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ToleranceRatio } from "../../frontend/render/primitives/Primitives";

describe("ToleranceRatio", () => {
  it("ToleranceRatio works as expected", () => {
    assert.isTrue(ToleranceRatio.vertex === 0.1, "pos is correct");
    assert.isTrue(ToleranceRatio.facetArea === 0.1, "normal is correct");
  });
});
