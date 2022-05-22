/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { FrustumUniforms, FrustumUniformType } from "../../../render/webgl/FrustumUniforms";

class TestUniforms extends FrustumUniforms {
  public constructor() {
    super();
  }

  public testSetPlanes(top: number, bottom: number, left: number, right: number): void { this.setPlanes(top, bottom, left, right); }
  public testSetFrustum(nearPlane: number, farPlane: number, type: FrustumUniformType): void { this.setFrustum(nearPlane, farPlane, type); }
}

describe("FrustumUniforms", () => {
  it("should create, store, and retrieve FrustumUniforms", () => {
    const fu = new TestUniforms();
    fu.testSetPlanes(1.0, 2.0, 3.0, 4.0);
    fu.testSetFrustum(5.0, 6.0, FrustumUniformType.Perspective);

    expect(fu.nearPlane).to.equal(5.0);
    expect(fu.farPlane).to.equal(6.0);
    expect(fu.type).to.equal(FrustumUniformType.Perspective);

    const p: Float32Array = fu.planes;
    let f: Float32Array = fu.frustum;
    assert.isTrue(1.0 === p[0] && 2.0 === p[1] && 3.0 === p[2] && 4.0 === p[3], "should be able to retrieve same values of planes after setting them");
    assert.isTrue(5.0 === f[0] && 6.0 === f[1] && FrustumUniformType.Perspective === f[2], "should be able to retrieve same values of Perspective frustum after setting them");
    expect(fu.is2d).to.be.false;

    fu.testSetFrustum(7.0, 8.0, FrustumUniformType.Orthographic);
    f = fu.frustum;
    assert.isTrue(7.0 === f[0] && 8.0 === f[1] && FrustumUniformType.Orthographic === f[2], "should be able to retrieve same values of Orthographic frustum after setting them");
    expect(fu.is2d).to.be.false;

    fu.testSetFrustum(0.0, 1.0, FrustumUniformType.TwoDee);
    f = fu.frustum;
    assert.isTrue(0.0 === f[0] && 1.0 === f[1] && FrustumUniformType.TwoDee === f[2], "should be able to retrieve same values of TwoDee frustum after setting them");
    expect(fu.is2d).to.be.true;

    fu.testSetPlanes(1.0, 2.0, 3.0, 4.0);
    fu.testSetFrustum(5.0, 6.0, FrustumUniformType.Perspective);
  });
});
