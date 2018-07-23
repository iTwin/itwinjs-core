/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { FrustumUniforms, FrustumUniformType, ClipPlanesVolume, Clips } from "@bentley/imodeljs-frontend/lib/rendering";
import { ClipVector, ClipShape, Point3d } from "@bentley/geometry-core";
import { WebGLTestContext } from "./WebGLTestContext";

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

describe.skip("Clips", () => {
  before(() => {
    WebGLTestContext.startup();
  });
  after(() => {
    WebGLTestContext.shutdown();
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
      const clipVector: ClipVector = ClipVector.createClipShapeClones(clipShapes);
      assert.isTrue(clipVector.isValid(), "should be able to create valid clipVector");

      const clips: Clips = new Clips();
      expect(clips.isValid).to.equal(false);
      expect(clips.count).to.equal(0);
      const clipVolume = ClipPlanesVolume.create(clipVector);
      expect(clipVolume).to.not.be.undefined;
      expect(clipVolume!.texture !== undefined);
      clips.set(clipVolume!.texture!.height, clipVolume!.texture!);

      // Test texture data of ClipPlanesVolume
      /*
      const clipVolumeTextureBytes: Float32Array = new Float32Array(clips.texture!.dataBytes!);
      const expectedValues1: number[] = [0, 1, 0, 1, -1, 0, 0, -2, 0, -1, 0, -2, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, -1, -2];
      for (let i = 0; i < 24; ++i) {
        assert.isTrue(clipVolumeTextureBytes[i] === expectedValues1[i], "clipVal[" + i + "] should be " + expectedValues1[i] + " but was " + clipVolumeTextureBytes[i]);
      }
      */

      // Try another clip.
      /*
      let transform = Transform.createScaleAboutPoint(Point3d.create(1.0, 1.0, 1.0), 3.0);
      clipVector.transformInPlace(transform);
      clipVolume!.apply(clips, transform);
      expect(clips.isValid).to.be.true;
      for (let i = 0; i < 24; ++i) {
        assert.isTrue(clipVals[i].valueOf() === expectedValues1[i], "clipVal[" + i + "] should still be " + expectedValues1[i] + " but is now " + clipVals[i].toString());
      }
      */

      // Try clearing the clips.
      /*
      clips.clear();
      expect(clips.count).to.equal(6);
      expect(clips.isValid).to.be.true;
      clips.clear();
      expect(clips.count).to.equal(0);
      expect(clips.isValid).to.be.false;
      */

      // Use a new clip with a scaled transform.
      /*
      transform = Transform.createScaleAboutPoint(Point3d.create(0.0, 0.0, 0.0), 2.0);
      clipVolume!.apply(clips, transform);
      clipVals = clips.clips;
      const expectedValues2: number[] = [0, 1, 0, -2, -1, 0, 0, 4, 0, -1, 0, 4, 1, 0, 0, -2, 0, 0, 1, -2, 0, 0, -1, 4];
      for (let i = 0; i < 24; ++i) {
        assert.isTrue(clipVals[i].valueOf() === expectedValues2[i], "clipVal[" + i + "] should be " + expectedValues2[i] + " but was " + clipVals[i].toString());
      }
      */

      // Use a new clip with a rotated transform.
      /*
      clips.clear();
      const rotMat = RotMatrix.createRowValues(0.0, 1.0, 0.0, -1.0, 0.0, 0.0, 0.0, 0.0, -1.0);
      transform = Transform.createOriginAndMatrix(Point3d.create(0.0, 0.0, 0.0), rotMat);
      clipVolume!.apply(clips, transform);
      clipVals = clips.clips;
      const expectedValues3: number[] = [1, 0, 0, -1, 0, 1, 0, 2, -1, 0, 0, 2, 0, -1, 0, -1, 0, 0, -1, -1, 0, 0, 1, 2];
      for (let i = 0; i < 24; ++i) {
        assert.isTrue(clipVals[i].valueOf() === expectedValues3[i], "clipVal[" + i + "] should be " + expectedValues3[i] + " but was " + clipVals[i].toString());
      }
      */
    }
  });
});
