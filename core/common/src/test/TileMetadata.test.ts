/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Point3d, Range3d } from "@bentley/geometry-core";
import { BatchType } from "../FeatureTable";
import {
  computeTileChordTolerance,
  defaultTileOptions,
  IModelTileTreeId,
  iModelTileTreeIdToString,
  TileMetadata,
  TreeFlags,
} from "../tile/TileMetadata";

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

  it("stringifies tree Ids", () => {
    const primaryId = (edgesRequired = true, enforceDisplayPriority = false, sectionCut?: string, anim?: { id: string, node?: number }): IModelTileTreeId => {
      return {
        type: BatchType.Primary,
        edgesRequired,
        animationId: anim?.id,
        animationTransformNodeId: anim?.node,
        enforceDisplayPriority,
        sectionCut,
      };
    };

    const classifierId = (expansion = 1, planar = true, anim?: { id: string, node: number }): IModelTileTreeId => {
      return {
        type: planar ? BatchType.PlanarClassifier : BatchType.VolumeClassifier,
        expansion,
        animationId: anim?.id,
        animationTransformNodeId: anim?.node,
      };
    };

    interface TestCase {
      // inputs
      id: IModelTileTreeId;
      ignoreProjectExtents?: true;
      maxVersion?: number;
      // expected
      baseId: string;
      flags: TreeFlags;
    }

    const kNone = TreeFlags.None;
    const kExtents = TreeFlags.UseProjectExtents;
    const kPriority = TreeFlags.EnforceDisplayPriority;
    const kAll = kExtents | kPriority;

    const testCases: TestCase[] = [
      {
        id: primaryId(),
        baseId: "",
        flags: kExtents,
      },
      {
        id: primaryId(false),
        baseId: "E:0_",
        flags: kExtents,
      },
      {
        id: primaryId(true),
        ignoreProjectExtents: true,
        baseId: "",
        flags: kNone,
      },
      {
        id: primaryId(false),
        ignoreProjectExtents: true,
        baseId: "E:0_",
        flags: kNone,
      },
      {
        id: primaryId(false, true),
        ignoreProjectExtents: true,
        baseId: "E:0_",
        flags: kPriority,
      },
      {
        id: primaryId(true, true),
        baseId: "",
        flags: kAll,
      },
      {
        id: primaryId(false, false, "abcxyz"),
        baseId: "E:0_Sabcxyzs",
        flags: kExtents,
      },
      {
        id: primaryId(true, true, "fakeclip"),
        baseId: "Sfakeclips",
        flags: kAll,
      },
      {
        id: primaryId(true, false, undefined, { id: "0x123", node: 0x5a }),
        baseId: "A:0x123_#5a_",
        flags: kExtents,
      },
      {
        id: primaryId(false, false, undefined, { id: "0xfde" }),
        ignoreProjectExtents: true,
        baseId: "A:0xfde_#ffffffff_E:0_",
        flags: kNone,
      },
      {
        id: primaryId(false, false, "clippy", { id: "0x5c", node: 32 }),
        baseId: "A:0x5c_#20_E:0_Sclippys",
        flags: kExtents,
      },
      // Animation and display priority are incompatible - animation wins
      {
        id: primaryId(true, true, undefined, { id: "0x1a", node: 5 }),
        baseId: "A:0x1a_#5_",
        flags: kExtents,
      },

      {
        id: classifierId(),
        baseId: "CP:1.000000_",
        flags: kExtents,
      },
      {
        id: classifierId(0.250000),
        baseId: "CP:0.250000_",
        flags: kExtents,
      },
      {
        id: classifierId(2.500000, false),
        baseId: "C:2.500000_",
        flags: kExtents,
      },
      {
        id: classifierId(3, false, { id: "0xabc", node: 0xfe }),
        baseId: "C:3.000000_A:0xabc_#fe_",
        flags: kExtents,
      },
      {
        id: classifierId(12.00001234),
        baseId: "CP:12.000012_",
        flags: kExtents,
      },
      {
        id: classifierId(123456789.0),
        baseId: "CP:123456789.000000_",
        flags: kExtents,
      },
      // Planar classifiers can ignore project extents.
      {
        id: classifierId(),
        ignoreProjectExtents: true,
        baseId: "CP:1.000000_",
        flags: kNone,
      },
      // Volume classifiers always use project extents.
      {
        id: classifierId(1, false),
        ignoreProjectExtents: true,
        baseId: "C:1.000000_",
        flags: kExtents,
      },
    ];

    for (const test of testCases) {
      const options = { ...defaultTileOptions, useProjectExtents: true !== test.ignoreProjectExtents };
      if (undefined !== test.maxVersion)
        options.maximumMajorTileFormatVersion = test.maxVersion;

      const modelId = "0x1c";
      const actual = iModelTileTreeIdToString(modelId, test.id, options);

      const expected = `${options.maximumMajorTileFormatVersion.toString(16)}_${test.flags.toString(16)}-${test.baseId}${modelId}`;
      expect(actual).to.equal(expected);
    }
  });
});
