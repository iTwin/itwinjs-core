/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { FrustumUniforms, FrustumUniformType } from "../../../render/webgl/FrustumUniforms";

class TestUniforms extends FrustumUniforms {
  public constructor() {
    super();
  }

  public testSetPlanes(top: number, bottom: number, left: number, right: number): void {
    this.setPlanes(top, bottom, left, right);
  }
  public testSetFrustum(nearPlane: number, farPlane: number, type: FrustumUniformType): void {
    this.setFrustum(nearPlane, farPlane, type);
  }
}

describe("FrustumUniforms", () => {
  it("should create, store, and retrieve FrustumUniforms", () => {
    const fu = new TestUniforms();
    fu.testSetPlanes(1.0, 2.0, 3.0, 4.0);
    fu.testSetFrustum(5.0, 6.0, FrustumUniformType.Perspective);

    expect(fu.nearPlane).toEqual(5.0);
    expect(fu.farPlane).toEqual(6.0);
    expect(fu.type).toEqual(FrustumUniformType.Perspective);

    const p: Float32Array = fu.planes;
    let f: Float32Array = fu.frustum;
    expect(p[0]).toBe(1.0);
    expect(p[1]).toBe(2.0);
    expect(p[2]).toBe(3.0);
    expect(p[3]).toBe(4.0);

    expect(f[0]).toBe(5.0);
    expect(f[1]).toBe(6.0);
    expect(f[2]).toBe(FrustumUniformType.Perspective);
    expect(fu.is2d).toBe(false);

    fu.testSetFrustum(7.0, 8.0, FrustumUniformType.Orthographic);
    f = fu.frustum;
    expect(f[0]).toBe(7.0);
    expect(f[1]).toBe(8.0);
    expect(f[2]).toBe(FrustumUniformType.Orthographic);
    expect(fu.is2d).toBe(false);

    fu.testSetFrustum(0.0, 1.0, FrustumUniformType.TwoDee);
    f = fu.frustum;
    expect(f[0]).toBe(0.0);
    expect(f[1]).toBe(1.0);
    expect(f[2]).toBe(FrustumUniformType.TwoDee);
    expect(fu.is2d).toBe(true);

    fu.testSetPlanes(1.0, 2.0, 3.0, 4.0);
    fu.testSetFrustum(5.0, 6.0, FrustumUniformType.Perspective);
  });
});
