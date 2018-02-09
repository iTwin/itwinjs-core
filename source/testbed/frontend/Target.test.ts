/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { FrustumUniforms, FrustumUniformType, GLESClips } from "../../frontend/render/Target";
import { ClipVector } from "@bentley/geometry-core/lib/numerics/ClipVector";
import { ClipShape } from "@bentley/geometry-core/lib/numerics/ClipPrimitives";
import { ClipPlane } from "@bentley/geometry-core/lib/numerics/ClipPlanes";
import { Transform, RotMatrix } from "@bentley/geometry-core/lib/Transform";
import { Point3d } from "@bentley/geometry-core/lib/PointVector";

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

describe("GLESClips", () => {
  it("should create, store, and retrieve GLESClips", () => {
    const points: Point3d[] = [];
    points[0] = Point3d.create (1.0, 1.0, 0.0);
    points[1] = Point3d.create (2.0, 1.0, 0.0);
    points[2] = Point3d.create (2.0, 2.0, 0.0);
    points[3] = Point3d.create (1.0, 2.0, 0.0);
    const s = ClipShape.createShape (points, 1.0, 2.0);
    assert.isTrue (undefined !== s, "should be able to create ClipShape");
    if (undefined !== s) {
      const clipShapes: ClipShape[] = [];
      clipShapes[0] = s;
      const clipVector: ClipVector = ClipVector.createClipShapeClones (clipShapes);
      assert.isTrue (clipVector.isValid(), "should be able to create valid clipVector");

      const clips: GLESClips = new GLESClips();
      assert.isFalse (clips.isValid(), "default empty GLESClips should not be valid");
      assert.isTrue (0 === clips.getClipCount(), "default empty GLESClips should return count of 0");
      const clipPlanes: ClipPlane[] = [];
      const count = GLESClips.convertClipToPlanes (clipVector, clipPlanes);
      assert.isTrue (6 === count, "constructed clipVector should convert to 6 ClipPlanes");

      // Add a clip with an identity transform.
      let transform: Transform = Transform.createIdentity();
      clips.setClips (count, clipPlanes, transform);
      let clipVals: Float32Array = clips.getClips ();
      const expectedValues1: number[] = [0, 1, 0, -1, -1, 0, 0, 2, 0, -1, 0, 2, 1, 0, 0, -1, 0, 0, 1, -1, 0, 0, -1, 2];
      for (let i = 0; i < 24; ++i) {
        assert.isTrue (clipVals[i].valueOf() === expectedValues1[i], "clipVal[" + i + "] should be " + expectedValues1[i] + " but was " + clipVals[i].toString());
      }

      // Try adding a second clip.
      transform = Transform.createScaleAboutPoint (Point3d.create (1.0, 1.0, 1.0), 3.0);
      clips.setClips (count, clipPlanes, transform);
      assert.isTrue (clips.isValid(), "isValid() should return true after setting another clip");
      for (let i = 0; i < 24; ++i) {
        assert.isTrue (clipVals[i].valueOf() === expectedValues1[i], "clipVal[" + i + "] should still be " + expectedValues1[i] + " but is now " + clipVals[i].toString());
      }

      // Try clearing the clips.
      clips.clearClips();
      assert.isTrue (6 === clips.getClipCount(), "clipCount should still return 0 after clearing 2nd clip");
      assert.isTrue (clips.isValid(), "should be still be valid after clearing 2nd clip");
      clips.clearClips();
      assert.isTrue (0 === clips.getClipCount(), "clipCount should return 0 after clearClips()");
      assert.isFalse (clips.isValid(), "isValid() should return false after clearClips()");

      // Use a new clip with a scaled transform.
      transform = Transform.createScaleAboutPoint (Point3d.create (0.0, 0.0, 0.0), 2.0);
      clips.setClips (count, clipPlanes, transform);
      clipVals = clips.getClips ();
      const expectedValues2: number[] = [0, 1, 0, -2, -1, 0, 0, 4, 0, -1, 0, 4, 1, 0, 0, -2, 0, 0, 1, -2, 0, 0, -1, 4];
      for (let i = 0; i < 24; ++i) {
        assert.isTrue (clipVals[i].valueOf() === expectedValues2[i], "clipVal[" + i + "] should be " + expectedValues2[i] + " but was " + clipVals[i].toString());
      }

      // Use a new clip with a rotated transform.
      clips.clearClips();
      const rotMat = RotMatrix.createRowValues (0.0, 1.0, 0.0, -1.0, 0.0, 0.0, 0.0, 0.0, -1.0);
      transform = Transform.createOriginAndMatrix (Point3d.create (0.0, 0.0, 0.0), rotMat);
      clips.setClips (count, clipPlanes, transform);
      clipVals = clips.getClips ();
      const expectedValues3: number[] = [1, 0, 0, -1, 0, 1, 0, 2, -1, 0, 0, 2, 0, -1, 0, -1, 0, 0, -1, -1, 0, 0, 1, 2];
      for (let i = 0; i < 24; ++i) {
        assert.isTrue (clipVals[i].valueOf() === expectedValues3[i], "clipVal[" + i + "] should be " + expectedValues3[i] + " but was " + clipVals[i].toString());
      }
    }
  });
});
