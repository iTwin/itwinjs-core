/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Frustum2d } from "../Frustum2d";

describe("Frustum2d", () => {
  it("should range from -1 to 1", () => {
    expect(Frustum2d.minimumZDistance).to.equal(1);
    expect(Frustum2d.minimumZExtents.low).to.equal(-1);
    expect(Frustum2d.minimumZExtents.high).to.equal(1);
  });

  it("should map display priority to depth", () => {
    expect(Frustum2d.depthFromDisplayPriority(0)).to.equal(0);
    expect(Frustum2d.depthFromDisplayPriority(500)).to.equal(1);
    expect(Frustum2d.depthFromDisplayPriority(-500)).to.equal(-1);
    expect(Frustum2d.depthFromDisplayPriority(250)).to.equal(0.5);
    expect(Frustum2d.depthFromDisplayPriority(-125)).to.equal(-0.25);
    expect(Frustum2d.depthFromDisplayPriority(501)).to.equal(1);
    expect(Frustum2d.depthFromDisplayPriority(-501)).to.equal(-1);
    expect(Frustum2d.depthFromDisplayPriority(99999)).to.equal(1);
    expect(Frustum2d.depthFromDisplayPriority(-99999)).to.equal(-1);
  });
});
