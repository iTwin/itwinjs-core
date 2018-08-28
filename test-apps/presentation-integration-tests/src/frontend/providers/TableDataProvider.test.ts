/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { OpenMode, Id64 } from "@bentley/bentleyjs-core";
import { ModelProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, instanceKeyFromJSON } from "@bentley/presentation-common";
import PresentationTableDataProvider from "@bentley/presentation-components/lib/table/DataProvider";
import { SortDirection } from "@bentley/ui-core/lib/enums/SortDirection";

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

describe("TableDataProvider", async () => {

  let imodel: IModelConnection;
  let instances: MeaningfulInstances;
  let provider: PresentationTableDataProvider;

  before(async () => {
    initialize();
    const testIModelName: string = "assets/datasets/1K.bim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
    instances = await createMeaningfulInstances(imodel);
    provider = new PresentationTableDataProvider(imodel, "SimpleContent", 10);
  });

  after(async () => {
    await imodel.closeStandalone();
    terminate();
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
      const keys = await imodel.elements.queryProps({ from: "functional.FunctionalElement", limit: 20 });
      provider.keys = new KeySet(keys);
      const count = await provider.getRowsCount();
      expect(count).to.eq(20);
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

  // WIP: sorting by display label doesn't work until `dev` is merged to `master`
  describe.skip("sorting", () => {

    it("sorts instances ascending", async () => {
      // provide keys so that instances by default aren't sorted in either way
      provider.keys = new KeySet([instances.physicalModel, instances.functionalModel, instances.repositoryModel]);
      await provider.sort(0, SortDirection.Ascending); // sort by display label (column index = 0)
      const rows = await Promise.all([0, 1, 2].map((index: number) => provider.getRow(index)));
      expect(rows).to.matchSnapshot();
    });

    it("sorts instances descending", async () => {
      // provide keys so that instances by default aren't sorted in either way
      provider.keys = new KeySet([instances.physicalModel, instances.functionalModel, instances.repositoryModel]);
      await provider.sort(0, SortDirection.Descending); // sort by display label (column index = 0)
      const rows = await Promise.all([0, 1, 2].map((index: number) => provider.getRow(index)));
      expect(rows).to.matchSnapshot();
    });

  });

  // WIP: filtering by display label doesn't work until `dev` is merged to `master`
  describe.skip("filtering", () => {

    it("filters instances", async () => {
      provider.keys = new KeySet([instances.physicalModel, instances.functionalModel, instances.repositoryModel]);
      provider.filterExpression = `DisplayLabel = "Functional Model-0-H"`;
      expect(await provider.getRowsCount()).to.eq(1);
      const row = await provider.getRow(0);
      const rowKey = instanceKeyFromJSON(JSON.parse(row!.key));
      expect(rowKey.id.value).to.eq(new Id64(instances.functionalModel.id).value);
    });

  });

});
