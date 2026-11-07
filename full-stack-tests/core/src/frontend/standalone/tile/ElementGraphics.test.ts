/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Guid } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { PersistentGraphicsRequestProps } from "@itwin/core-common";
import { IModelApp, readElementGraphics } from "@itwin/core-frontend";
import { MockRender } from "@itwin/core-frontend/lib/cjs/internal/test-support";
import { TestUtility } from "../../TestUtility";
import { TestSnapshotConnection } from "../../TestSnapshotConnection";

describe("requestElementGraphics", () => {
  let imodel: TestSnapshotConnection;

  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("mirukuru.ibim");
  });

  afterAll(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  describe("quantization", () => {
    async function expectQuantized(requestQuantized: boolean | undefined, expected: boolean): Promise<void> {
      const requestProps: PersistentGraphicsRequestProps = {
        elementId: "0x29",
        id: Guid.createValue(),
        toleranceLog10: -3,
      };

      if (undefined !== requestQuantized)
        requestProps.quantizePositions = requestQuantized;

      const bytes = await IModelApp.tileAdmin.requestElementGraphics(imodel, requestProps);
      expect(bytes).not.toBeUndefined();

      let createdMesh = false;
      IModelApp.renderSystem.createMeshGeometry = (params, _origin) => {
        expect(params.vertices.usesUnquantizedPositions).toBe(!expected);
        createdMesh = true;
        return new MockRender.Geometry("mesh");
      };

      const gfx = await readElementGraphics(bytes!, imodel, "0", true);
      expect(gfx).not.toBeUndefined();
      expect(createdMesh).toBe(true);
    }

    it("is not applied by default", async () => {
      await expectQuantized(undefined, false);
    });

    it("is applied if `quantizePositions` is true", async () => {
      await expectQuantized(true, true);
    });

    it("is not applied if `quantizePositions` is false", async () => {
      await expectQuantized(false, false);
    });
  });

  describe("relative-to-center transform", async () => {
    let elemRtc: number[];

    beforeAll(async () => {
      const placement = (await imodel.elements.getPlacements("0x29", { type: "3d" }))[0];
      expect(placement).not.toBeUndefined();
      const range = placement.calculateRange();
      const rangeCenter = range.center;
      elemRtc = [rangeCenter.x, rangeCenter.y, rangeCenter.z];
    });

    async function expectRtc(options: {
      quantize?: boolean;
      absolute?: boolean;
      location?: Transform;
    }, expectedRtc: number[] | undefined,
    ): Promise<void> {
      const requestProps: PersistentGraphicsRequestProps = {
        elementId: "0x29",
        id: Guid.createValue(),
        toleranceLog10: -3,
        quantizePositions: options.quantize,
        useAbsolutePositions: options.absolute,
        location: options.location?.toJSON(),
      };

      const bytes = (await IModelApp.tileAdmin.requestElementGraphics(imodel, requestProps))!;
      expect(bytes).not.toBeUndefined();

      let createdMesh = false;
      IModelApp.renderSystem.createMeshGeometry = (params) => {
        expect(params.vertices.usesUnquantizedPositions).toBe(true !== options.quantize);
        createdMesh = true;
        return new MockRender.Geometry("mesh");
      };

      let actualRtc: number[] | undefined;
      IModelApp.renderSystem.createGraphicBranch = (branch, transform, branchOptions) => {
        actualRtc = transform.origin.toArray();
        return new MockRender.Branch(branch, transform, branchOptions);
      };

      const gfx = await readElementGraphics(bytes, imodel, "0", true);
      expect(gfx).not.toBeUndefined();
      expect(createdMesh).toBe(true);
      expect(undefined === actualRtc).toBe(undefined === expectedRtc);
      if (actualRtc && expectedRtc) {
        const expectAlmostEqual = (actual: number, expected: number) => expect(Math.abs(actual - expected)).most(0.00001);
        expectAlmostEqual(actualRtc[0], expectedRtc[0]);
        expectAlmostEqual(actualRtc[1], expectedRtc[1]);
        expectAlmostEqual(actualRtc[2], expectedRtc[2]);
      }
    }

    it("is applied by default", async () => {
      await expectRtc({}, elemRtc);
    });

    it("is not applied to quantized positions", async () => {
      await expectRtc({ quantize: true }, undefined);
    });

    it("is not applied if `useAbsolutePositions` is true", async () => {
      await expectRtc({ absolute: true }, undefined);
    });

    it("is applied if `useAbsolutePositions` is false", async () => {
      await expectRtc({ absolute: false }, elemRtc);
    });

    it("is adjusted based on location transform", async () => {
      await expectRtc({ location: Transform.createTranslationXYZ(100, -200, 500) }, [elemRtc[0] - 100, elemRtc[1] + 200, elemRtc[2] - 500]);
    });
  });
});
