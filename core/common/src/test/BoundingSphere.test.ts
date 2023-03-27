/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Matrix3d, Point3d, Transform } from "@itwin/core-geometry";
import { BoundingSphere } from "../geometry/BoundingSphere";

describe("BoundingSphere", () => {
  it("ensures non-negative radius", () => {
    const sphere = new BoundingSphere(undefined, -1);
    expect(sphere.radius).to.equal(0);
  });

  it("transforms", () => {
    const sphere = new BoundingSphere(new Point3d(-1, 0, 2), 3);
    const expectTransformed = (transform: Transform, cx: number, cy: number, cz: number, r: number) => {
      const t = sphere.transformBy(transform);
      expect(t.center.x).to.equal(cx);
      expect(t.center.y).to.equal(cy);
      expect(t.center.z).to.equal(cz);
      expect(t.radius).to.equal(r);
    };

    expectTransformed(Transform.createIdentity(), -1, 0, 2, 3);
    expectTransformed(Transform.createTranslationXYZ(1, 2, 3), 0, 2, 5, 3);
    expectTransformed(Transform.createZero(), 0, 0, 0, 0);
    expectTransformed(Transform.createRefs(undefined, Matrix3d.createUniformScale(3)), -3, 0, 6, 9);
    expectTransformed(Transform.createRefs(undefined, Matrix3d.createScale(2, 1, 0.5)), -2, 0, 1, 6);
    expectTransformed(Transform.createRefs(undefined, Matrix3d.createUniformScale(-1)), 1, 0, -2, 3);
  });

  it("computes distance to closest point", () => {
    const sphere = new BoundingSphere(new Point3d(-1, 0, 2), 3);
    const expectDistance = (x: number, y: number, z: number, expectedDistance: number) => {
      expect(sphere.distanceToPoint(Point3d.fromJSON([x, y, z]))).to.equal(expectedDistance);
    };

    expectDistance(-1, 0, 2, 0);
    expectDistance(-2, 1, 3, 0);
    expectDistance(-1, 3, 2, 0);
    expectDistance(-1, -3, 2, 0);
    expectDistance(-1, 4, 2, 1);
    expectDistance(-1, -4, 2, 1);
    expectDistance(-4, 0, 2, 0);
    expectDistance(2, 0, 2, 0);
    expectDistance(-5, 0, 2, 1);
    expectDistance(3, 0, 2, 1);
    expectDistance(-1, 0, 5, 0);
    expectDistance(-1, 0, -1, 0);
    expectDistance(-1, 0, 6, 1);
    expectDistance(-1, 0, -2, 1);
  });

  it("computes closest point on sphere", () => {
    const sphere = new BoundingSphere(new Point3d(-1, 0, 2), 3);
    const expectClosestPoint = (x: number, y: number, z: number, expected: [number, number, number] | undefined) => {
      const actual = sphere.closestPointOnSurface({ x, y, z });
      if (undefined === expected) {
        expect(actual).to.be.undefined;
        return;
      }

      expect(actual).not.to.be.undefined;
      expect(actual!.x).to.equal(expected[0]);
      expect(actual!.y).to.equal(expected[1]);
      expect(actual!.z).to.equal(expected[2]);
    };

    expectClosestPoint(-1, 0, 2, undefined);
    expectClosestPoint(0, 1, 3, undefined);

    expectClosestPoint(-4, 0, 2, [-4, 0, 2]);
    expectClosestPoint(-5, 0, 2, [-4, 0, 2]);
    expectClosestPoint(2, 0, 2, [2, 0, 2]);
    expectClosestPoint(100, 0, 2, [2, 0, 2]);

    expectClosestPoint(-1, 3, 2, [-1 ,3, 2]);
    expectClosestPoint(-1, 3.5, 2, [-1, 3, 2]);
    expectClosestPoint(-1, -3, 2, [-1, -3, 2]);
    expectClosestPoint(-1, -20, 2, [-1, -3, 2]);
  });
});
