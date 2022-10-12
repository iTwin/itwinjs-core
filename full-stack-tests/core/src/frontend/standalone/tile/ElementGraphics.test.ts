/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { PersistentGraphicsRequestProps } from "@itwin/core-common";
import { IModelApp, MockRender, readElementGraphics, SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../../TestUtility";

describe.only("requestElementGraphics", () => {
  let imodel: SnapshotConnection;

  before(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
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
      expect(bytes).not.to.be.undefined;

      let createdMesh = false;
      IModelApp.renderSystem.createMeshGeometry = (params, _origin) => {
        expect(params.vertices.usesUnquantizedPositions).to.equal(!expected);
        createdMesh = true;
        return new MockRender.Geometry();
      };

      const gfx = await readElementGraphics(bytes!, imodel, "0", true);
      expect(gfx).not.to.be.undefined;
      expect(createdMesh).to.be.true;
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

  describe("relative-to-center transform", () => {
    async function expectRtc(options: {
      quantize?: boolean;
      absolute?: boolean;
      location?: Transform;
    }, expectedRtc: number[] | undefined
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
      expect(bytes).not.to.be.undefined;

      let createdMesh = false;
      IModelApp.renderSystem.createMeshGeometry = (params) => {
        expect(params.vertices.usesUnquantizedPositions).to.equal(true === options.quantize);
        // ###TODO inspect mesh geometry
        createdMesh = true;
        return new MockRender.Geometry();
      };

      let actualRtc: number[] | undefined;
      IModelApp.renderSystem.createGraphicBranch = (branch, transform, options) => {
        actualRtc = transform.origin.toArray();
        return new MockRender.Branch(branch, transform, options);
      };

      const gfx = await readElementGraphics(bytes, imodel, "0", true);
      expect(gfx).not.to.be.undefined;
      expect(createdMesh).to.be.true;
      expect(actualRtc).to.deep.equal(expectedRtc);
    }

    it("is applied by default", async () => {
      expectRtc({}, [12, 34, 56]);
    });

    it("is not applied to quantized positions", async () => {
    });

    it("is not applied if `useAbsolutePositions` is true", async () => {
    });

    it("is applied if `useAbsolutePositions` is false", async () => {
    });

    it("is adjusted based on location transform", async () => {
    });
  });
});
