/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Point3d, Range3d } from "@bentley/geometry-core";
import { computeTileChordTolerance, TileMetadata } from "../tile/TileMetadata";

describe("TileMetadata", () => {
  it("computes chord tolerance", () => {
    const expectTolerance = (expectedTolerance: number, range: Range3d, is3d: boolean, sizeMultiplier?: number) => {
      const metadata: TileMetadata = {
        contentRange: range,
        isLeaf: false,
        sizeMultiplier,
        emptySubRangeMask: 0,
        contentId: "",
        range,
      };

      const epsilon = 0.00001;
      const actualTolerance = computeTileChordTolerance(metadata, is3d);
      expect(Math.abs(expectedTolerance - actualTolerance)).most(epsilon);
    };

    const toleranceFromDiagonal = (diagonal: number) => diagonal / 1024;

    // null range
    expectTolerance(0, Range3d.createNull(), true);
    expectTolerance(0, Range3d.createNull(), false);
    expectTolerance(0, Range3d.createNull(), true, 10);
    expectTolerance(0, Range3d.createNull(), false, 10);

    // point range
    expectTolerance(0, Range3d.createXYZ(1, 2, -3), true);
    expectTolerance(0, Range3d.createXYZ(1, 2, -3), false);
    expectTolerance(0, Range3d.createXYZ(1, 2, -3), true, 10);
    expectTolerance(0, Range3d.createXYZ(1, 2, -3), false, 10);

    // zero length in at least one axis
    const tolerance5 = toleranceFromDiagonal(5);
    const tolerance25 = toleranceFromDiagonal(25);
    expectTolerance(tolerance25, Range3d.create(Point3d.create(100, -100, 0), Point3d.create(100, -100, 25)), true);
    expectTolerance(0, Range3d.create(Point3d.create(100, -100, 0), Point3d.create(100, -100, 25)), false);
    expectTolerance(tolerance5, Range3d.create(Point3d.create(0, 0, 0), Point3d.create(0, 3, 4)), true);
    expectTolerance(toleranceFromDiagonal(3), Range3d.create(Point3d.create(0, 0, 0), Point3d.create(0, 3, 4)), false);
    expectTolerance(tolerance5 / 3, Range3d.create(Point3d.create(0, 0, 0), Point3d.create(0, 3, 4)), true, 3);
    expectTolerance(toleranceFromDiagonal(3) / 3, Range3d.create(Point3d.create(0, 0, 0), Point3d.create(0, 3, 4)), false, 3);

    expectTolerance(tolerance5, Range3d.create(Point3d.create(0, 0, 0), Point3d.create(3, 4, 5)), false);
    expectTolerance(tolerance5 / 2, Range3d.create(Point3d.create(0, 0, 0), Point3d.create(3, 4, 5)), false, 2);
    expectTolerance(toleranceFromDiagonal(Math.sqrt(4 + 9 + 16)), Range3d.create(Point3d.create(0, 0, 0), Point3d.create(2, 3, 4)), true);
    expectTolerance(toleranceFromDiagonal(Math.sqrt(4 + 9 + 16)) / 2, Range3d.create(Point3d.create(0, 0, 0), Point3d.create(2, 3, 4)), true, 2);
  });
});
