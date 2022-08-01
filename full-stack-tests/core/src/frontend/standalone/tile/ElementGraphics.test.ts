/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { PersistentGraphicsRequestProps } from "@itwin/core-common";
import { IModelApp, MockRender, readElementGraphics, SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../../TestUtility";

describe("requestElementGraphics", () => {
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

  it("does not quantize positions by default", async () => {
    await expectQuantized(undefined, false);
  });

  it("quantizes positions if explicitly requested", async () => {
    await expectQuantized(true, true);
  });

  it("produces unquantized positions if explicitly requested", async () => {
    await expectQuantized(false, false);
  });
});
