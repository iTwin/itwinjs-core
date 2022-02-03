/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { GeometricElement2dProps, GeometricElement3dProps, GeometryPartProps} from "@itwin/core-common";
import { Placement2d, Placement3d } from "@itwin/core-common";
import { SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";

describe("Elements", () => {
  let imodel: SnapshotConnection;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("CompatibilityTestSeed.bim");
  });

  after(async () => {
    await imodel.close();
    await TestUtility.shutdownFrontend();
  });

  it("loads element properties by identifier with options", async () => {
    for (let i = 0; i < 3; i++) {
      const code = {
        spec: "0xd",
        scope: "0x3c",
        value: `GeometryPart${i}`,
      };

      let byCode = await imodel.elements.loadProps(code) as GeometryPartProps;
      expect(byCode).not.to.be.undefined;
      expect(byCode.geom).to.be.undefined;

      const id = byCode.id!;
      let byId = await imodel.elements.loadProps(id) as GeometryPartProps;
      expect(byId).to.deep.equal(byCode);

      byCode = await imodel.elements.loadProps(code, { wantGeometry: false }) as GeometryPartProps;
      expect(byCode).to.deep.equal(byId);

      byId = await imodel.elements.loadProps(id, { wantGeometry: true }) as GeometryPartProps;
      const geom = byId.geom!;
      expect(geom).not.to.be.undefined;
      expect(geom.length).to.equal(2);
      expect(geom[0].header!.flags).to.equal(0);
      expect(geom[1].box!.baseX).to.equal(i + 1);
      expect(geom[1].box!.baseY).to.equal(i + 1);
    }
  });

  it("queries placements", async () => {
    const ids2d = await imodel.elements.queryIds({ from: "bis.GeometricElement2d" });
    expect(ids2d.size).to.equal(18);
    const ids3d = await imodel.elements.queryIds({ from: "bis.GeometricElement3d" });
    expect(ids3d.size).to.equal(6);

    const ids = Array.from(ids2d).concat(Array.from(ids3d));
    const placements = await imodel.elements.getPlacements(ids);
    expect(placements.length).to.equal(ids.length);

    for (const placement of placements) {
      const id = placement.elementId;
      if (ids2d.has(id)) {
        expect(placement).instanceof(Placement2d);
        const props = (await imodel.elements.getProps(id))[0] as GeometricElement2dProps;
        const actual = Placement2d.fromJSON(props.placement);
        expect(placement.calculateRange().isAlmostEqual(actual.calculateRange())).to.be.true;
      } else {
        expect(ids3d.has(id)).to.be.true;
        expect(placement).instanceof(Placement3d);
        const props = (await imodel.elements.getProps(id))[0] as GeometricElement3dProps;
        const actual = Placement3d.fromJSON(props.placement);
        expect(placement.calculateRange().isAlmostEqual(actual.calculateRange())).to.be.true;
      }
    }

    const placements2d = await imodel.elements.getPlacements(ids, { type: "2d" });
    expect(placements2d.map((x) => x.elementId).sort()).to.deep.equal(Array.from(ids2d).sort());

    const placements3d = await imodel.elements.getPlacements(ids, { type: "3d" });
    expect(placements3d.map((x) => x.elementId).sort()).to.deep.equal(Array.from(ids3d).sort());
  });

  it("queries individual placements", async () => {
    async function test(dim: "2d" | "3d"): Promise<void> {
      const ids = Array.from(await imodel.elements.queryIds({ from: `bis.GeometricElement${dim}`, limit: 1 }));
      expect(ids.length).to.equal(1);

      const placements = await imodel.elements.getPlacements(ids);
      expect(placements.length).to.equal(1);
      expect(placements[0].elementId).to.equal(ids[0]);

      if ("2d" === dim)
        expect(placements[0]).instanceof(Placement2d);
      else
        expect(placements[0]).instanceof(Placement3d);
    }

    await test("3d");
    await test("2d");
  });
});
