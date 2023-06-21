/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { expect } from "chai";
import { BatchType } from "../FeatureTable";
import {
  ClassifierTileTreeId, computeTileChordTolerance, ContentIdProvider, EdgeOptions, IModelTileTreeId, iModelTileTreeIdToString,
  parseTileTreeIdAndContentId, PrimaryTileTreeId, defaultTileOptions as realDefaultTileOptions, TileMetadata, TileOptions, TreeFlags,
} from "../tile/TileMetadata";

// NB: These tests were written when defaultTileOptions specified indexed edges as the default. Now, compact edges are the default.
// Adjust the defaults used by the tests to continue to use indexed; additional tests for compact have been added.
const defaultEdgeOptions: EdgeOptions = { ...realDefaultTileOptions.edgeOptions, type: "indexed" };
const defaultTileOptions: TileOptions = { ...realDefaultTileOptions, edgeOptions: defaultEdgeOptions };

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
      const actualTolerance = computeTileChordTolerance(metadata, is3d, 512);
      expect(Math.abs(expectedTolerance - actualTolerance)).most(epsilon);
      expect(actualTolerance).least(computeTileChordTolerance(metadata, is3d, 2048));
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
    const primaryId = (edgesRequired = true, enforceDisplayPriority = false, sectionCut?: string, animationId?: string): IModelTileTreeId => {
      return {
        type: BatchType.Primary,
        edges: edgesRequired ? { type: "non-indexed", smooth: false } : false,
        animationId,
        enforceDisplayPriority,
        sectionCut,
      };
    };

    const classifierId = (expansion = 1, planar = true, animationId?: string): IModelTileTreeId => {
      return {
        type: planar ? BatchType.PlanarClassifier : BatchType.VolumeClassifier,
        expansion,
        animationId,
      };
    };

    interface TestCase {
      // inputs
      id: IModelTileTreeId;
      ignoreProjectExtents?: true;
      noOptimizeBReps?: true;
      useSmallerTiles?: true;
      maxVersion?: number;
      // expected
      baseId: string;
      flags: TreeFlags;
    }

    const kNone = TreeFlags.None;
    const kExtents = TreeFlags.UseProjectExtents;
    const kBReps = TreeFlags.OptimizeBRepProcessing;
    const kPriority = TreeFlags.EnforceDisplayPriority;
    const kLarger = TreeFlags.UseLargerTiles;
    const kDefaults = kExtents | kBReps | kLarger;
    const kAll = kDefaults | kPriority;

    const testCases: TestCase[] = [
      {
        id: primaryId(),
        baseId: "",
        flags: kDefaults,
      },
      {
        id: primaryId(false),
        baseId: "E:0_",
        flags: kDefaults,
      },
      {
        id: primaryId(true),
        ignoreProjectExtents: true,
        baseId: "",
        flags: kBReps | kLarger,
      },
      {
        id: primaryId(true),
        noOptimizeBReps: true,
        baseId: "",
        flags: kExtents | kLarger,
      },
      {
        id: primaryId(true),
        noOptimizeBReps: true,
        ignoreProjectExtents: true,
        baseId: "",
        flags: kLarger,
      },
      {
        id: primaryId(true),
        noOptimizeBReps: true,
        ignoreProjectExtents: true,
        useSmallerTiles: true,
        baseId: "",
        flags: kNone,
      },
      {
        id: primaryId(true),
        useSmallerTiles: true,
        baseId: "",
        flags: kExtents | kBReps,
      },
      {
        id: primaryId(true),
        useSmallerTiles: true,
        noOptimizeBReps: true,
        baseId: "",
        flags: kExtents,
      },
      {
        id: primaryId(false),
        ignoreProjectExtents: true,
        baseId: "E:0_",
        flags: kBReps | kLarger,
      },
      {
        id: primaryId(false, true),
        ignoreProjectExtents: true,
        baseId: "E:0_",
        flags: kPriority | kBReps | kLarger,
      },
      {
        id: primaryId(true, true),
        baseId: "",
        flags: kAll,
      },
      {
        id: primaryId(false, false, "abcxyz"),
        baseId: "E:0_Sabcxyzs",
        flags: kDefaults,
      },
      {
        id: primaryId(true, true, "fakeclip"),
        baseId: "Sfakeclips",
        flags: kAll,
      },
      {
        id: primaryId(true, false, undefined, "0x123"),
        baseId: "A:0x123_",
        flags: kDefaults,
      },
      {
        id: primaryId(false, false, undefined, "0xfde"),
        ignoreProjectExtents: true,
        baseId: "A:0xfde_E:0_",
        flags: kBReps | kLarger,
      },
      {
        id: primaryId(false, false, "clippy", "0x5c"),
        baseId: "A:0x5c_E:0_Sclippys",
        flags: kDefaults,
      },
      // Animation and display priority are incompatible - animation wins
      {
        id: primaryId(true, true, undefined, "0x1a"),
        baseId: "A:0x1a_",
        flags: kDefaults,
      },

      {
        id: classifierId(),
        baseId: "CP:1.000000_",
        flags: kDefaults,
      },
      {
        id: classifierId(0.250000),
        baseId: "CP:0.250000_",
        flags: kDefaults,
      },
      {
        id: classifierId(2.500000, false),
        baseId: "C:2.500000_",
        flags: kDefaults,
      },
      {
        id: classifierId(3, false, "0xabc"),
        baseId: "C:3.000000_A:0xabc_",
        flags: kDefaults,
      },
      {
        id: classifierId(12.00001234),
        baseId: "CP:12.000012_",
        flags: kDefaults,
      },
      {
        id: classifierId(123456789.0),
        baseId: "CP:123456789.000000_",
        flags: kDefaults,
      },
      // Planar classifiers can ignore project extents.
      {
        id: classifierId(),
        ignoreProjectExtents: true,
        baseId: "CP:1.000000_",
        flags: kBReps | kLarger,
      },
      // Volume classifiers always use project extents.
      {
        id: classifierId(1, false),
        ignoreProjectExtents: true,
        baseId: "C:1.000000_",
        flags: kDefaults,
      },
    ];

    for (const test of testCases) {
      const options = {
        ...defaultTileOptions,
        useProjectExtents: true !== test.ignoreProjectExtents,
        useLargerTiles: true !== test.useSmallerTiles,
        optimizeBRepProcessing: true !== test.noOptimizeBReps,
      };

      if (undefined !== test.maxVersion)
        options.maximumMajorTileFormatVersion = test.maxVersion;

      const modelId = "0x1c";
      const actual = iModelTileTreeIdToString(modelId, test.id, options);

      const expected = `${options.maximumMajorTileFormatVersion.toString(16)}_${test.flags.toString(16)}-${test.baseId}${modelId}`;
      expect(actual).to.equal(expected);
    }
  });

  it("computes TileOptions from tree and content Ids", () => {
    interface Options {
      version: number;
      instancing?: boolean;
      elision?: boolean;
      noPatterns?: boolean;
      externalTextures?: boolean;
      projectExtents?: boolean;
      optimizeBReps?: boolean;
      useLargerTiles?: boolean;
      indexedEdges?: boolean;
      allPolyfaceEdges?: boolean;
    }

    function test(treeId: string, contentId: string, expected: Options | "content" | "tree"): void {
      if (typeof expected === "string") {
        expect(() => TileOptions.fromTreeIdAndContentId(treeId, contentId)).to.throw(`Invalid ${expected} Id`);
      } else {
        const options: TileOptions = {
          maximumMajorTileFormatVersion: expected.version,
          enableInstancing: true === expected.instancing,
          enableImprovedElision: true === expected.elision,
          ignoreAreaPatterns: true === expected.noPatterns,
          enableExternalTextures: true === expected.externalTextures,
          useProjectExtents: true === expected.projectExtents,
          useLargerTiles: true === expected.useLargerTiles,
          optimizeBRepProcessing: true === expected.optimizeBReps,
          disableMagnification: false,
          alwaysSubdivideIncompleteTiles: false,
          edgeOptions: {
            type: expected.indexedEdges ? "indexed" : "non-indexed",
            smooth: true === expected.allPolyfaceEdges,
          },
        };

        expect(TileOptions.fromTreeIdAndContentId(treeId, contentId)).to.deep.equal(options);
      }
    }

    test("", "", "tree");
    test("4_1-0x1c", "", "content");
    test("", "-0-1-2-3-4-5", "tree");

    test("blah", "blah", "tree");
    test("4_0-0x1c", "blah", "content");
    test("4-1_0x1c", "-0-1-2-3-4-5", "tree");
    test("4_1-0x1c", "0-1-2-3-4-5", "content");

    test("4_0-0x1c", "-0-0", { version: 4 });
    test("Ad_1", "-0-0", { version: 0xad, projectExtents: true });
    test("f_2", "-0-0", { version: 15 });
    test("f_3", "-0-0", { version: 15, projectExtents: true });
    test("f_4", "-0-0", { version: 15, optimizeBReps: true });
    test("f_8", "-0-0", { version: 15, useLargerTiles: true });

    test("4_0", "-3-0", { version: 4, elision: true, instancing: true });
    test("4_0", "-c-5", { version: 4, noPatterns: true, externalTextures: true });
    test("a_1", "-F-2", { version: 10, projectExtents: true, noPatterns: true, externalTextures: true, instancing: true, elision: true });
  });

  it("parseTileTreeIdAndContentId round trips", () => {
    function test(modelId: Id64String, treeId: IModelTileTreeId, contentId: ReturnType<typeof ContentIdProvider.prototype.specFromId>, tileOptions: TileOptions) {
      const treeIdStr = iModelTileTreeIdToString(modelId, treeId, tileOptions);
      const contentIdStr = ContentIdProvider.create(true, tileOptions).idFromSpec(contentId);
      const parsed = parseTileTreeIdAndContentId(treeIdStr, contentIdStr);

      expect(parsed.modelId).to.equal(modelId);
      expect(parsed.options).to.deep.equal(tileOptions);

      // Sometimes ContentIdSpec and IModelTileTreeId will be slightly different due to "undefined" properties being included. However, this has no effect on further processing.
      // Strings are compared here because the parsed values will typically be used to generate them.
      expect(iModelTileTreeIdToString(parsed.modelId, parsed.treeId, parsed.options)).to.equal(treeIdStr);
      expect(ContentIdProvider.create(true, parsed.options).idFromSpec(parsed.contentId)).to.equal(contentIdStr);
    }

    expect(typeof defaultTileOptions.edgeOptions).to.equal("object");
    const defaultNoIndexedEdges: TileOptions = { ...defaultTileOptions, edgeOptions: { ...defaultEdgeOptions, type: "non-indexed" } };
    const defaultNoEdges: TileOptions = { ...defaultNoIndexedEdges, edgeOptions: { type: "non-indexed", smooth: false } };
    const defaultNoSmoothEdges: TileOptions = { ...defaultTileOptions, edgeOptions: { ...defaultEdgeOptions, smooth: false } };

    test("0x1c", { type: BatchType.Primary, edges: false } as PrimaryTileTreeId, { depth: 2, i: 5, j: 400, k: 16, multiplier: 8 }, realDefaultTileOptions);
    test("0x1c", { type: BatchType.Primary, edges: false } as PrimaryTileTreeId, { depth: 2, i: 5, j: 400, k: 16, multiplier: 8 }, { ...realDefaultTileOptions, enableInstancing: false });
    test("0x1c", { type: BatchType.Primary, edges: false } as PrimaryTileTreeId, { depth: 2, i: 5, j: 400, k: 16, multiplier: 8 }, { ...realDefaultTileOptions, enableImprovedElision: false });
    test("0x1c", { type: BatchType.Primary, edges: false } as PrimaryTileTreeId, { depth: 2, i: 5, j: 400, k: 16, multiplier: 8 }, { ...realDefaultTileOptions, ignoreAreaPatterns: true });
    test("0x1c", { type: BatchType.Primary, edges: false } as PrimaryTileTreeId, { depth: 2, i: 5, j: 400, k: 16, multiplier: 8 }, { ...realDefaultTileOptions, enableExternalTextures: false });
    test("0x1c", { type: BatchType.Primary, edges: false } as PrimaryTileTreeId, { depth: 2, i: 5, j: 400, k: 16, multiplier: 8 }, { ...realDefaultTileOptions, useProjectExtents: false });
    // disableMagnification and alwaysSubdivideIncompleteTiles intentionally left out - they're not included in tileTreeId and contentId strings
    test("0x1c", { type: BatchType.Primary, edges: false } as PrimaryTileTreeId, { depth: 2, i: 5, j: 400, k: 16, multiplier: 8 }, { ...realDefaultTileOptions, enableInstancing: false, enableImprovedElision: false, ignoreAreaPatterns: true, enableExternalTextures: false, useProjectExtents: false });

    test("0x1d", { type: BatchType.Primary, edges: { type: "non-indexed", smooth: false } } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoEdges);
    test("0x1d", { type: BatchType.Primary, edges: { type: "non-indexed", smooth: false }, enforceDisplayPriority: true } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoEdges);
    test("0x1d", { type: BatchType.Primary, edges: { type: "non-indexed", smooth: false }, animationId: "0x105" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoEdges);
    test("0x1000000d", { type: BatchType.Primary, edges: false, animationId: "0x105", animationTransformNodeId: 50 } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, realDefaultTileOptions);

    test("0x1d", { type: BatchType.Primary, edges: { type: "non-indexed", smooth: false }, sectionCut: "010_1_0_-5_30_0_-1_5e-11____" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoEdges);

    test("0x1d", { type: BatchType.Primary, edges: { type: "indexed", smooth: false } } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoSmoothEdges);
    test("0x1d", { type: BatchType.Primary, edges: { type: "indexed", smooth: false }, enforceDisplayPriority: true } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoSmoothEdges);
    test("0x1d", { type: BatchType.Primary, edges: { type: "indexed", smooth: false }, animationId: "0x105" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoSmoothEdges);
    test("0x1d", { type: BatchType.Primary, edges: { type: "indexed", smooth: false }, sectionCut: "010_1_0_-5_30_0_-1_5e-11____" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoSmoothEdges);

    test("0x1d", { type: BatchType.Primary, edges: { type: "non-indexed", smooth: true } } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoIndexedEdges);
    test("0x1d", { type: BatchType.Primary, edges: { type: "non-indexed", smooth: true }, enforceDisplayPriority: true } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoIndexedEdges);
    test("0x1d", { type: BatchType.Primary, edges: { type: "non-indexed", smooth: true }, animationId: "0x105" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoIndexedEdges);
    test("0x1000000d", { type: BatchType.Primary, edges: false, animationId: "0x105", animationTransformNodeId: 50 } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, realDefaultTileOptions);

    test("0x1d", { type: BatchType.Primary, edges: { type: "non-indexed", smooth: true }, sectionCut: "010_1_0_-5_30_0_-1_5e-11____" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoIndexedEdges);

    test("0x1d", { type: BatchType.Primary, edges: { type: "indexed", smooth: true } } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultTileOptions);
    test("0x1d", { type: BatchType.Primary, edges: { type: "indexed", smooth: true }, enforceDisplayPriority: true } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultTileOptions);
    test("0x1d", { type: BatchType.Primary, edges: { type: "indexed", smooth: true }, animationId: "0x105" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultTileOptions);
    test("0x1d", { type: BatchType.Primary, edges: { type: "indexed", smooth: true }, sectionCut: "010_1_0_-5_30_0_-1_5e-11____" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultTileOptions);

    test("0x1d", { type: BatchType.VolumeClassifier, expansion: 50 } as ClassifierTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoEdges);
    test("0x1000000d", { type: BatchType.VolumeClassifier, expansion: 50, animationId: "0x50000001" } as ClassifierTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoEdges);
    test("0x1000000d", { type: BatchType.VolumeClassifier, expansion: 50, animationId: "0x50000001", animationTransformNodeId: 500 } as ClassifierTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoEdges);

    test("0x1d", { type: BatchType.PlanarClassifier, expansion: 50 } as ClassifierTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoEdges);
    test("0x1000000d", { type: BatchType.PlanarClassifier, expansion: 50, animationId: "0x50000001" } as ClassifierTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoEdges);
    test("0x1000000d", { type: BatchType.PlanarClassifier, expansion: 50, animationId: "0x50000001", animationTransformNodeId: 500 } as ClassifierTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, defaultNoEdges);

    const realDefaultNoSmoothEdges: TileOptions  = { ...realDefaultTileOptions, edgeOptions: { type: "compact", smooth: false } };

    test("0x1d", { type: BatchType.Primary, edges: { type: "compact", smooth: false } } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, realDefaultNoSmoothEdges);
    test("0x1d", { type: BatchType.Primary, edges: { type: "compact", smooth: false }, enforceDisplayPriority: true } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, realDefaultNoSmoothEdges);
    test("0x1d", { type: BatchType.Primary, edges: { type: "compact", smooth: false }, animationId: "0x105" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, realDefaultNoSmoothEdges);
    test("0x1d", { type: BatchType.Primary, edges: { type: "compact", smooth: false }, sectionCut: "010_1_0_-5_30_0_-1_5e-11____" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, realDefaultNoSmoothEdges);
    test("0x1d", { type: BatchType.Primary, edges: { type: "compact", smooth: true } } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, realDefaultTileOptions);
    test("0x1d", { type: BatchType.Primary, edges: { type: "compact", smooth: true }, enforceDisplayPriority: true } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, realDefaultTileOptions);
    test("0x1d", { type: BatchType.Primary, edges: { type: "compact", smooth: true }, animationId: "0x105" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, realDefaultTileOptions);
    test("0x1d", { type: BatchType.Primary, edges: { type: "compact", smooth: true }, sectionCut: "010_1_0_-5_30_0_-1_5e-11____" } as PrimaryTileTreeId, { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 }, realDefaultTileOptions);
  });

  it("parses TileTreeId and ContentId strings", () => {
    interface Options {
      modelId: Id64String;
      treeId: IModelTileTreeId;
      contentId: ReturnType<typeof ContentIdProvider.prototype.specFromId>;
      tileOptions: {
        version: number;
        instancing?: boolean;
        elision?: boolean;
        noPatterns?: boolean;
        externalTextures?: boolean;
        projectExtents?: boolean;
        optimizeBReps?: boolean;
        largerTiles?: boolean;
      };
    }

    function test(treeId: string, contentId: string, expected: Options | string) {
      if (typeof expected === "string") {
        expect(() => parseTileTreeIdAndContentId(treeId, contentId)).to.throw(`Invalid ${expected} Id`);
      } else {
        const edges = BatchType.Primary === expected.treeId.type && false !== expected.treeId.edges ? expected.treeId.edges : undefined;
        const options: TileOptions = {
          maximumMajorTileFormatVersion: expected.tileOptions.version,
          enableInstancing: true === expected.tileOptions.instancing,
          enableImprovedElision: true === expected.tileOptions.elision,
          ignoreAreaPatterns: true === expected.tileOptions.noPatterns,
          enableExternalTextures: true === expected.tileOptions.externalTextures,
          useProjectExtents: true === expected.tileOptions.projectExtents,
          disableMagnification: false,
          alwaysSubdivideIncompleteTiles: false,
          edgeOptions: edges ?? { type: "non-indexed", smooth: false },
          optimizeBRepProcessing: true === expected.tileOptions.optimizeBReps,
          useLargerTiles: true === expected.tileOptions.largerTiles,
        };
        const parsed = parseTileTreeIdAndContentId(treeId, contentId);

        expect(parsed.options).to.deep.equal(options);
        expect(parsed.modelId).to.equal(expected.modelId);
        expect(parsed.contentId).to.deep.equal(expected.contentId);
        expect(parsed.treeId).to.deep.equal(expected.treeId);
      }
    }

    test("", "", "tree");
    test("4_1-0x1c", "", "content");
    test("", "-0-1-2-3-4-5", "tree");

    test("blah", "blah", "tree");
    test("4_0-0x1c", "blah", "content");

    test("4_0-0x00a", "-0-1-2-3-4-5", "tree");
    test("4_0-0x1c", "-0-1-2-3", "content");
    test("4_0-0x1c", "0-1-2-3-4", "content");

    test("19_d-S010_1_0_-5_30_0_-1_5e-11____s0x1d", "-b-14-32-4-1-1", {
      tileOptions: {
        elision: true,
        instancing: true,
        noPatterns: false,
        version: 25,
        projectExtents: true,
        externalTextures: true,
        optimizeBReps: true,
        largerTiles: true,
      },
      modelId: "0x1d",
      treeId: {
        type: BatchType.Primary,
        edges: { type: "non-indexed", smooth: false },
        sectionCut: "010_1_0_-5_30_0_-1_5e-11____",
        animationId: undefined,
        enforceDisplayPriority: undefined,
      },
      contentId: { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 },
    });

    test("19_d-E:3_S010_1_0_-5_30_0_-1_5e-11____s0x1d", "-b-14-32-4-1-1", {
      tileOptions: {
        elision: true,
        instancing: true,
        noPatterns: false,
        version: 25,
        projectExtents: true,
        externalTextures: true,
        optimizeBReps: true,
        largerTiles: true,
      },
      modelId: "0x1d",
      treeId: {
        type: BatchType.Primary,
        edges: { type: "non-indexed", smooth: true },
        sectionCut: "010_1_0_-5_30_0_-1_5e-11____",
        animationId: undefined,
        enforceDisplayPriority: undefined,
      },
      contentId: { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 },
    });

    test("19_d-E:4_S010_1_0_-5_30_0_-1_5e-11____s0x1d", "-b-14-32-4-1-1", {
      tileOptions: {
        elision: true,
        instancing: true,
        noPatterns: false,
        version: 25,
        projectExtents: true,
        externalTextures: true,
        optimizeBReps: true,
        largerTiles: true,
      },
      modelId: "0x1d",
      treeId: {
        type: BatchType.Primary,
        edges: { type: "indexed", smooth: true },
        sectionCut: "010_1_0_-5_30_0_-1_5e-11____",
        animationId: undefined,
        enforceDisplayPriority: undefined,
      },
      contentId: { depth: 20, i: 50, j: 4, k: 1, multiplier: 1 },
    });

    test("19_1-S010_1_0_-5_30_0_-1_5e-11____0x1d", "-b-14-32-4-1-1", "tree"); // removed 's' after sectionCut
    test("19_1-C50.000000_A:0x50000001_#1f4_0x1000000d", "-b-14-32-4-1-1", "tree"); // removed ':' after C (VolumeClassifier)
    test("19_1-C:50.000000-A:0x50000001_#1f4_0x1000000d", "-b-14-32-4-1-1", "tree"); // replaced '_' with '-'
    test("19_1-C:50.000000A:0x50000001_#1f4_0x1000000d", "-b-14-32-4-1-1", "tree"); // removed '_'
    test("19_1-C:50.000000_AB:0x50000001_#1f4_0x1000000d", "-b-14-32-4-1-1", "tree"); // added 'B'
    test("19_1-C:50.000000_A:0x050000001_#1f4_0x1000000d", "-b-14-32-4-1-1", "tree"); // invalid Id64
    test("19_1-C:50.000000_A:0x50000001_1f4_0x1000000d", "-b-14-32-4-1-1", "tree"); // removed '#'
    test("19_1-C:50.000000_A:0x50000001_#1fg4_0x1000000d", "-b-14-32-4-1-1", "tree"); // invalid hexadecimal number (1fg4)
    test("19_1-C:50.000000_A:0x50000001_#ggg_0x1000000d", "-b-14-32-4-1-1", "tree"); // invalid hexadecimal number (ggg)
  });
});
