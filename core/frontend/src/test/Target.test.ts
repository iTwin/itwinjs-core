/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { FrustumUniforms, FrustumUniformType, ClipPlanesVolume, Clips } from "../webgl";
import { ClipVector, ClipShape, Point3d } from "@bentley/geometry-core";
import { IModelApp } from "../IModelApp";

describe("FrustumUniforms", () => {
  it("should create, store, and retrieve FrustumUniforms", () => {
    const fu = new FrustumUniforms();
    fu.setPlanes(1.0, 2.0, 3.0, 4.0);
    fu.setFrustum(5.0, 6.0, FrustumUniformType.Perspective);

    expect(fu.nearPlane).to.equal(5.0);
    expect(fu.farPlane).to.equal(6.0);
    expect(fu.type).to.equal(FrustumUniformType.Perspective);

    const p: Float32Array = fu.frustumPlanes;
    let f: Float32Array = fu.frustum;
    assert.isTrue(1.0 === p[0] && 2.0 === p[1] && 3.0 === p[2] && 4.0 === p[3], "should be able to retrieve same values of planes after setting them");
    assert.isTrue(5.0 === f[0] && 6.0 === f[1] && FrustumUniformType.Perspective === f[2], "should be able to retrieve same values of Perspective frustum after setting them");
    expect(fu.is2d).to.be.false;

    fu.setFrustum(7.0, 8.0, FrustumUniformType.Orthographic);
    f = fu.frustum;
    assert.isTrue(7.0 === f[0] && 8.0 === f[1] && FrustumUniformType.Orthographic === f[2], "should be able to retrieve same values of Orthographic frustum after setting them");
    expect(fu.is2d).to.be.false;

    fu.setFrustum(0.0, 1.0, FrustumUniformType.TwoDee);
    f = fu.frustum;
    assert.isTrue(0.0 === f[0] && 1.0 === f[1] && FrustumUniformType.TwoDee === f[2], "should be able to retrieve same values of TwoDee frustum after setting them");
    expect(fu.is2d).to.be.true;
  });
});

describe("Clips", () => {
  before(() => {
    IModelApp.startup();
  });
  after(() => {
    IModelApp.shutdown();
  });
  it("should create, store, and retrieve Clips", () => {
    const points: Point3d[] = [];
    points[0] = Point3d.create(1.0, 1.0, 0.0);
    points[1] = Point3d.create(2.0, 1.0, 0.0);
    points[2] = Point3d.create(2.0, 2.0, 0.0);
    points[3] = Point3d.create(1.0, 2.0, 0.0);
    const s = ClipShape.createShape(points, 1.0, 2.0);
    assert.isTrue(undefined !== s, "should be able to create ClipShape");
    if (undefined !== s) {
      const clipShapes: ClipShape[] = [];
      clipShapes[0] = s;
      const clipVector: ClipVector = ClipVector.create(clipShapes);
      assert.isTrue(clipVector.isValid, "should be able to create valid clipVector");

      const clips: Clips = new Clips();
      expect(clips.isValid).to.equal(false);
      expect(clips.count).to.equal(0);
      const clipVolume = ClipPlanesVolume.create(clipVector);
      expect(clipVolume).to.not.be.undefined;

      const data = clipVolume!.getTextureData() as Float32Array;
      expect(data).not.to.be.undefined;
      expect(data instanceof Float32Array).to.be.true;

      const expectedData = [0, 1, 0, -1, -1, 0, 0, 2, 0, -1, 0, 2, 1, 0, 0, -1, 0, 0, 1, -1, 0, 0, -1, 2];
      expect(data.length).to.equal(expectedData.length);
      for (let i = 0; i < data.length; i++)
        expect(data[i]).to.equal(expectedData[i]);
    }
  });
});
