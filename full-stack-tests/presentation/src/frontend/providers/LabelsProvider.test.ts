/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { PresentationLabelsProvider } from "@bentley/presentation-components";
import { initialize, terminate } from "../../IntegrationTests";

describe("LabelsProvider", async () => {

  let imodel: IModelConnection;
  let provider: PresentationLabelsProvider;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    provider = new PresentationLabelsProvider({ imodel });
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("getLabel", () => {

    it("returns correct label", async () => {
      const props = (await imodel.models.queryProps({ from: "bis.PhysicalModel" }))[0];
      const label = await provider.getLabel({ className: props.classFullName, id: props.id! });
      expect(label).to.matchSnapshot();
    });

  });

  describe("getLabels", () => {

    it("returns empty array for empty keys list", async () => {
      const labels = await provider.getLabels([]);
      expect(labels).to.deep.eq([]);
    });

    it("returns model labels", async () => {
      const props = await imodel.models.queryProps({ from: "bis.Model", where: "ECInstanceId <> 1", only: false });
      const labels = await provider.getLabels(props.map((p) => ({ className: p.classFullName, id: p.id! })));
      expect(labels).to.matchSnapshot();
    });

  });

});
