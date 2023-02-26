/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Point3d, Transform } from "@itwin/core-geometry";
import { BoundingSphere } from "../geometry/BoundingSphere";

describe.only("BoundingSphere", () => {
  it("ensures non-negative radius", () => {
    const sphere = new BoundingSphere(undefined, -1);
    expect(sphere.radius).to.equal(0);
  });

  it("transforms", () => {
  });

  it("computes closest point", () => {
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
});
