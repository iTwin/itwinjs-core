/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "./IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { ModelProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/ecpresentation-common";
import { GridDataProvider, SortDirection } from "@bentley/ecpresentation-controls";
import "@helpers/Snapshots";

before(() => {
  initialize();
});

after(() => {
  terminate();
});

interface MeaningfulInstances {
  repositoryModel: ModelProps;
  functionalModel: ModelProps;
  physicalModel: ModelProps;
}
const createMeaningfulInstances = async (imodel: IModelConnection): Promise<MeaningfulInstances> => {
  return {
    repositoryModel: (await imodel.models.queryProps({ from: "bis.RepositoryModel" }))[0],
    functionalModel: (await imodel.models.queryProps({ from: "func.FunctionalModel" }))[0],
    physicalModel: (await imodel.models.queryProps({ from: "bis.PhysicalModel" }))[0],
  };
};

describe("GridDataProvider", async () => {

  let imodel: IModelConnection;
  let instances: MeaningfulInstances;
  let provider: GridDataProvider;
  before(async () => {
    const testIModelName: string = "assets/datasets/1K.bim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
    instances = await createMeaningfulInstances(imodel);
    provider = new GridDataProvider(imodel.iModelToken, "SimpleContent");
  });
  after(async () => {
    await imodel.closeStandalone();
  });

  describe("getColumns", () => {

    it("returns columns for a single instance", async () => {
      provider.keys = new KeySet([instances.functionalModel]);
      const columns = await provider.getColumns();
      expect(columns).to.matchSnapshot();
    });

    it("returns columns for multiple instances", async () => {
      provider.keys = new KeySet([instances.functionalModel, instances.physicalModel]);
      const columns = await provider.getColumns();
      expect(columns).to.matchSnapshot();
    });

  });

  describe("getRowsCount", () => {

    it("returns total number of instances when less than page size", async () => {
      provider.keys = new KeySet([instances.functionalModel, instances.physicalModel]);
      const count = await provider.getRowsCount();
      expect(count).to.eq(2);
    });

    it("returns total number of instances when more than page size", async () => {
      const keys = await imodel.elements.queryProps({ from: "functional.FunctionalElement", limit: 99 });
      provider.keys = new KeySet(keys);
      const count = await provider.getRowsCount();
      expect(count).to.eq(99);
    });

  });

  describe("getRow", () => {

    it("returns first row", async () => {
      provider.keys = new KeySet([instances.functionalModel]);
      const row = await provider.getRow(0);
      expect(row).to.matchSnapshot();
    });

    it("returns undefined when requesting row with invalid index", async () => {
      provider.keys = new KeySet([instances.functionalModel]);
      const row = await provider.getRow(1);
      expect(row).to.be.undefined;
    });

  });

  describe("getLoadedRow", () => {

    it("returns undefined when row not loaded", async () => {
      provider.keys = new KeySet([instances.functionalModel]);
      const row = provider.getLoadedRow(0);
      expect(row).to.be.undefined;
    });

    it("returns a row when it's loaded", async () => {
      provider.keys = new KeySet([instances.functionalModel]);
      await provider.getRow(0);
      const row = provider.getLoadedRow(0);
      expect(row).to.not.be.undefined;
    });

  });

  describe("sort", () => {

    it("sorts instances ascending", async () => {
      // provide keys so that instances by default aren't sorted in either way
      provider.keys = new KeySet([instances.physicalModel, instances.functionalModel, instances.repositoryModel]);
      await provider.sort(0, SortDirection.Ascending); // sort by display label (column index = 0)
      const rows = await Promise.all([0, 1, 2].map((index: number) => {
        return provider.getRow(index);
      }));
      expect(rows).to.matchSnapshot();
    });

    it("sorts instances descending", async () => {
      // provide keys so that instances by default aren't sorted in either way
      provider.keys = new KeySet([instances.physicalModel, instances.functionalModel, instances.repositoryModel]);
      await provider.sort(0, SortDirection.Descending); // sort by display label (column index = 0)
      const rows = await Promise.all([0, 1, 2].map((index: number) => {
        return provider.getRow(index);
      }));
      expect(rows).to.matchSnapshot();
    });

  });

  describe("[set] imodelToken", () => {

    it("invalidates content after imodelToken changes", async () => {
      provider.keys = new KeySet([instances.functionalModel]);
      await provider.getRow(0);
      let row = provider.getLoadedRow(0);
      expect(row).to.not.be.undefined;
      provider.imodelToken = { ...imodel.iModelToken };
      row = provider.getLoadedRow(0);
      expect(row).to.be.undefined;
    });

  });

});
