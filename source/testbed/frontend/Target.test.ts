/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { FrustumUniforms, FrustumUniformType } from "../../frontend/render/Target";

describe("FrustumUniforms", () => {
  it("should create, store, and retrieve FrustumUniforms", () => {
    const fu = new FrustumUniforms();
    fu.SetPlanes(1.0, 2.0, 3.0, 4.0);
    fu.SetFrustum(5.0, 6.0, FrustumUniformType.Perspective);

    assert.isTrue(5.0 === fu.getNearPlane(), "should be able to retieve Near after setting frustum");
    assert.isTrue(6.0 === fu.getFarPlane(), "should be able to retieve Far after setting frustum");
    assert.isTrue(FrustumUniformType.Perspective === fu.GetType(), "should be able to retieve Type after setting frustum");

    const p: Float32Array = fu.getFrustumPlanes();
    let f: Float32Array = fu.getFrustum();
    assert.isTrue(1.0 === p[0] && 2.0 === p[1] && 3.0 === p[2] && 4.0 === p[3], "should be able to retrieve same values of planes after setting them");
    assert.isTrue(5.0 === f[0] && 6.0 === f[1] && FrustumUniformType.Perspective === f[2], "should be able to retrieve same values of Perspective frustum after setting them");
    assert.isFalse(fu.Is2d(), "frustum with type Perspective should not return true for Is2d()");

    fu.SetFrustum(7.0, 8.0, FrustumUniformType.Orthographic);
    f = fu.getFrustum();
    assert.isTrue(7.0 === f[0] && 8.0 === f[1] && FrustumUniformType.Orthographic === f[2], "should be able to retrieve same values of Orthographic frustum after setting them");
    assert.isFalse(fu.Is2d(), "frustum with type Orthographic should not return true for Is2d()");

    fu.SetFrustum(0.0, 1.0, FrustumUniformType.TwoDee);
    f = fu.getFrustum();
    assert.isTrue(0.0 === f[0] && 1.0 === f[1] && FrustumUniformType.TwoDee === f[2], "should be able to retrieve same values of TwoDee frustum after setting them");
    assert.isTrue(fu.Is2d(), "frustum with type TwoDee should return true for Is2d()");
  });
});
