/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GeometryPartProps } from "@bentley/imodeljs-common";
import { IModelApp, SnapshotConnection } from "@bentley/imodeljs-frontend";

describe("Elements", () => {
  let imodel: SnapshotConnection;

  before(async () => {
    await IModelApp.startup();
    imodel = await SnapshotConnection.openFile("CompatibilityTestSeed.bim");
  });

  after(async () => {
    await imodel.close();
    await IModelApp.shutdown();
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
});
