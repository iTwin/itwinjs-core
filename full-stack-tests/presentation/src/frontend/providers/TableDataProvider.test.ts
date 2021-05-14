/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Id64 } from "@bentley/bentleyjs-core";
import { ModelProps } from "@bentley/imodeljs-common";
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { ContentSpecificationTypes, InstanceKey, KeySet, RelationshipDirection, RelationshipMeaning, Ruleset, RuleTypes } from "@bentley/presentation-common";
import { PresentationTableDataProvider } from "@bentley/presentation-components";
import { Presentation } from "@bentley/presentation-frontend";
import { SortDirection } from "@bentley/ui-core";
import { initialize, terminate } from "../../IntegrationTests";

const RULESET_MODIFIER: Ruleset = {
  id: "ruleset",
  rules: [{
    ruleType: RuleTypes.Content,
    specifications: [{
      specType: ContentSpecificationTypes.SelectedNodeInstances,
    }],
  }, {
    ruleType: RuleTypes.ContentModifier,
    class: {
      schemaName: "BisCore",
      className: "Model",
    },
    relatedProperties: [
      {
        propertiesSource: {
          relationship: {
            schemaName: "BisCore",
            className: "ModelContainsElements",
          },
          direction: RelationshipDirection.Forward,
        },
        handleTargetClassPolymorphically: true,
        relationshipMeaning: RelationshipMeaning.SameInstance,
        properties: [
          "UserLabel",
          "CodeValue",
        ],
      },
    ],
  }],
};

const RULESET: Ruleset = {
  id: "localization test",
  rules: [{
    ruleType: RuleTypes.Content,
    specifications: [{
      specType: ContentSpecificationTypes.SelectedNodeInstances,
    }],
  }],
};

interface MeaningfulInstances {
  repositoryModel: ModelProps;
  dictionaryModel: ModelProps;
  physicalModel: ModelProps;
}
const createMeaningfulInstances = async (imodel: IModelConnection): Promise<MeaningfulInstances> => {
  return {
    repositoryModel: (await imodel.models.queryProps({ from: "bis.RepositoryModel" }))[0],
    dictionaryModel: (await imodel.models.queryProps({ from: "bis.DictionaryModel", wantPrivate: true }))[0],
    physicalModel: (await imodel.models.queryProps({ from: "bis.PhysicalModel" }))[0],
  };
};

describe("TableDataProvider", async () => {

  let imodel: IModelConnection;
  let instances: MeaningfulInstances;
  let provider: PresentationTableDataProvider;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    instances = await createMeaningfulInstances(imodel);
  });

  beforeEach(async () => {
    provider = new PresentationTableDataProvider({ imodel, ruleset: RULESET, pageSize: 10 });
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("getColumns", () => {

    it("returns columns for a single instance", async () => {
      provider.keys = new KeySet([instances.physicalModel]);
      const columns = await provider.getColumns();
      expect(columns).to.matchSnapshot();
    });

    it("returns columns for multiple instances", async () => {
      provider.keys = new KeySet([instances.repositoryModel, instances.physicalModel]);
      const columns = await provider.getColumns();
      expect(columns).to.matchSnapshot();
    });

    it("returns extracted columns from instances which have SameInstance relationshipMeaning", async () => {
      provider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" } ]);
      const columns = await provider.getColumns();
      expect(columns.length).to.eq(32);
    });

  });

  describe("getRowsCount", () => {

    it("returns total number of instances when less than page size", async () => {
      provider.keys = new KeySet([instances.repositoryModel, instances.physicalModel]);
      const count = await provider.getRowsCount();
      expect(count).to.eq(2);
    });

    it("returns total number of instances when more than page size", async () => {
      const keys = await imodel.elements.queryProps({ from: "bis.PhysicalElement", limit: 20 });
      provider.keys = new KeySet(keys);
      const count = await provider.getRowsCount();
      expect(count).to.eq(20);
    });

  });

  describe("getRow", () => {

    it("returns first row", async () => {
      provider.keys = new KeySet([instances.physicalModel]);
      const row = await provider.getRow(0);
      expect(row).to.matchSnapshot();
    });

    it("returns row with extracted cells from instances which have SameInstance relationshipMeaning", async () => {
      provider.keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
      const row = await provider.getRow(0);
      expect(row.cells.length).to.eq(32);
    });

    it("returns row with merged cells from instances which have SameInstance relationshipMeaning and more than one value in it", async () => {
      provider = new PresentationTableDataProvider({
        imodel, ruleset: RULESET_MODIFIER, pageSize: 10,
      });
      provider.keys = new KeySet([instances.physicalModel]);

      const row = await provider.getRow(0);
      expect(row.cells[0].mergedCellsCount).to.be.undefined;
      expect(row.cells[1].mergedCellsCount).to.eq(2);
      expect(row.cells[2].mergedCellsCount).to.be.undefined;
      expect(row.cells[3].mergedCellsCount).to.eq(2);
      expect(row.cells[4].mergedCellsCount).to.be.undefined;
    });

    it("returns undefined when requesting row with invalid index", async () => {
      provider.keys = new KeySet([instances.physicalModel]);
      const row = await provider.getRow(1);
      expect(row).to.be.undefined;
    });

  });

  it("requests backend only once to get first page", async () => {
    const getContentDescriptorSpy = sinon.spy(Presentation.presentation.rpcRequestsHandler, "getContentDescriptor");
    const getPagedContentSpy = sinon.spy(Presentation.presentation.rpcRequestsHandler, "getPagedContent");
    const getPagedContentSetSpy = sinon.spy(Presentation.presentation.rpcRequestsHandler, "getPagedContentSet");
    provider.keys = new KeySet([instances.physicalModel]);
    provider.pagingSize = 10;

    // request count and first page
    const count = await provider.getRowsCount();
    const row = await provider.getRow(0);

    expect(count).to.not.eq(0);
    expect(row).to.not.be.undefined;
    expect(getContentDescriptorSpy).to.not.be.called;
    expect(getPagedContentSpy).to.be.calledOnce;
    expect(getPagedContentSetSpy).to.not.be.called;
  });

  describe("sorting", () => {

    it("sorts instances ascending", async () => {
      // provide keys so that instances by default aren't sorted in either way
      provider.keys = new KeySet([instances.physicalModel, instances.dictionaryModel, instances.repositoryModel]);
      await provider.sort(0, SortDirection.Ascending); // sort by display label (column index = 0)
      const rows = await Promise.all([0, 1, 2].map(async (index: number) => provider.getRow(index)));
      // expected order:
      // "" (repository model)
      // "BisCore.DictionaryModel" (dictionary model)
      // "Properties_60InstancesWithUrl2" (physical model)
      expect(rows).to.matchSnapshot();
    });

    it("sorts instances descending", async () => {
      // provide keys so that instances by default aren't sorted in either way
      provider.keys = new KeySet([instances.physicalModel, instances.dictionaryModel, instances.repositoryModel]);
      await provider.sort(0, SortDirection.Descending); // sort by display label (column index = 0)
      const rows = await Promise.all([0, 1, 2].map(async (index: number) => provider.getRow(index)));
      // expected order:
      // "Properties_60InstancesWithUrl2" (physical model)
      // "BisCore.DictionaryModel" (dictionary model)
      // "" (repository model)
      expect(rows).to.matchSnapshot();
    });

  });

  describe("filtering", () => {

    it("filters instances", async () => {
      provider.keys = new KeySet([instances.physicalModel, instances.dictionaryModel, instances.repositoryModel]);
      const columns = await provider.getColumns();
      provider.filterExpression = `${columns[0].key} = "Properties_60InstancesWithUrl2"`;
      expect(await provider.getRowsCount()).to.eq(1);
      const row = await provider.getRow(0);
      const rowKey = InstanceKey.fromJSON(JSON.parse(row.key));
      expect(rowKey.id).to.eq(Id64.fromString(instances.physicalModel.id!));
    });

  });

});
