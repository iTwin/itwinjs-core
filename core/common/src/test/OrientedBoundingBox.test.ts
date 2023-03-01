/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Matrix3d, Point3d, Transform } from "@itwin/core-geometry";
import { OrientedBoundingBox } from "../geometry/OrientedBoundingBox";

describe("OrientedBoundingBox", () => {
  it("transforms", () => {
    const obb = new OrientedBoundingBox(Point3d.fromJSON([-1, 0, 2]), Matrix3d.fromJSON([1, 0, 0, 0, 2, 0, 0, 0, 3]));
    const expectTransformed = (transform: Transform, cx: number, cy: number, cz: number, axes: number[]) => {
      const t = obb.transformBy(transform);
      expect(t.center.x).to.equal(cx);
      expect(t.center.y).to.equal(cy);
      expect(t.center.z).to.equal(cz);
      expect(t.halfAxes.isAlmostEqual(Matrix3d.fromJSON(axes))).to.be.true;
    };

    expectTransformed(Transform.createIdentity(), -1, 0, 2, [1, 0, 0, 0, 2, 0, 0, 0, 3]);
    expectTransformed(Transform.createTranslationXYZ(1, 2, 3), 0, 2, 5, [1, 0, 0, 0, 2, 0, 0, 0, 3]);
    expectTransformed(Transform.createZero(), 0, 0, 0, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expectTransformed(Transform.createRefs(undefined, Matrix3d.createUniformScale(3)), -3, 0, 6, [3, 0, 0, 0, 6, 0, 0, 0, 9]);
    expectTransformed(Transform.createRefs(undefined, Matrix3d.createScale(2, 1, 0.5)), -2, 0, 1, [2, 0, 0, 0, 2, 0, 0, 0, 1.5]);
    expectTransformed(Transform.createRefs(undefined, Matrix3d.createUniformScale(-1)), 1, 0, -2, [-1, 0, 0, 0, -2, 0, 0, 0, -3]);
  });

  it("computes distance to closest point", () => {
    const obb = new OrientedBoundingBox(Point3d.fromJSON([-1, 0, 2]), Matrix3d.fromJSON([1, 0, 0, 0, 2, 0, 0, 0, 3]));
    const expectDistance = (x: number, y: number, z: number, expectedDistance: number) => {
      expect(obb.distanceToPoint(Point3d.fromJSON([x, y, z]))).to.equal(expectedDistance);
    };

    expectDistance(-1, 0, 2, 0);
    expectDistance(-1.5, -1, 3, 0);
    expectDistance(-2, 2, 5, 0);

    expectDistance(-2, 0, 2, 0);
    expectDistance(-3, 0, 2, 1);
    expectDistance(-3, 2, 2, 1);
    expectDistance(-3, -1, 2, 1);
    expectDistance(0, 0, 2, 0);
    expectDistance(1, 0, 2, 1);
    expectDistance(2, 0, -1, 2);
    expectDistance(3, 0, 5, 3);

    expectDistance(-1, 2, 2, 0);
    expectDistance(-1, 3, 2, 1);
    expectDistance(-1, -2, 2, 0);
    expectDistance(-1, -3, 2, 1);

    expectDistance(-1, 0, 5, 0);
    expectDistance(-1, 0, 6, 1);
    expectDistance(-1, 0, -1, 0);
    expectDistance(-1, 0, -2, 1);

    expectDistance(-3, 3, 0, Math.sqrt(2));
    expectDistance(-3, 3, 6, Math.sqrt(3));
  });

  it("finds closest point on surface", () => {
    const obb = new OrientedBoundingBox(Point3d.fromJSON([-1, 0, 2]), Matrix3d.fromJSON([1, 0, 0, 0, 2, 0, 0, 0, 3]));
    const expectClosestPoint = (x: number, y: number, z: number, expected: [number, number, number] | undefined) => {
      const actual = obb.closestPointOnSurface({ x, y, z });
      if (undefined === expected) {
        expect(actual).to.be.undefined;
        return;
      }

      expect(actual).not.to.be.undefined;
      expect(actual!.x).to.equal(expected[0]);
      expect(actual!.y).to.equal(expected[1]);
      expect(actual!.z).to.equal(expected[2]);
    };

    expectClosestPoint(-3, 0, 2, [-2, 0, 2]);
    expectClosestPoint(-2, 0, 2, [-2, 0, 2]);
    expectClosestPoint(-0.5, 0, 2, undefined);
    expectClosestPoint(0, 0, 2, [0, 0, 2]);
    expectClosestPoint(5, 0, 2, [0, 0, 2]);

    expectClosestPoint(-1, 1, 2, undefined);
    expectClosestPoint(-1, 2, 2, [-1, 2, 2]);
    expectClosestPoint(-1, 4, 2, [-1, 2, 2]);
    expectClosestPoint(-1, -1, 2, undefined);
    expectClosestPoint(-1, -2, 2, [-1, -2, 2]);
    expectClosestPoint(-1, -3, 2, [-1, -2, 2]);

    expectClosestPoint(-1, 0, 4, undefined);
    expectClosestPoint(-1, 0, 5, [-1, 0, 5]);
    expectClosestPoint(-1, 0, 100, [-1, 0, 5]);
    expectClosestPoint(-1, 0, -1, [-1, 0, -1]);
    expectClosestPoint(-1, 0, -123, [-1, 0, -1]);

    expectClosestPoint(-1, 0, 2, undefined);
    expectClosestPoint(-1.5, 1, 0, undefined);
    expectClosestPoint(-1.5, 1, -4, [-1.5, 1, -1]);
    expectClosestPoint(1, 4, 2, [0, 2, 2]);
  });
});
