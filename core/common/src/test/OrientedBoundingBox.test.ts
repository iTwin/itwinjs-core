/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Matrix3d, Point3d, Transform } from "@itwin/core-geometry";
import { OrientedBoundingBox } from "../geometry/OrientedBoundingBox";

describe.only("OrientedBoundingBox", () => {
  it("transforms", () => {
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
});
