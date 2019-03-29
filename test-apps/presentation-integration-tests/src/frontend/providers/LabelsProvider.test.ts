/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { LabelsProvider } from "@bentley/presentation-components";

describe("LabelsProvider", async () => {

  let imodel: IModelConnection;
  let provider: LabelsProvider;

  before(async () => {
    initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openSnapshot(testIModelName);
    provider = new LabelsProvider(imodel);
  });

  after(async () => {
    await imodel.closeSnapshot();
    terminate();
  });

  describe.skip("getLabel", () => {

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
      const props = await imodel.models.queryProps({ from: "bis.Model", only: false });
      const labels = await provider.getLabels(props.map((p) => ({ className: p.classFullName, id: p.id! })));
      expect(labels).to.matchSnapshot();
    });

  });

});
