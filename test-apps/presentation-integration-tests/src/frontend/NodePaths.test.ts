/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";
import { OpenMode, Id64, using } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { InstanceKey, Ruleset } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";

describe("NodesPaths", () => {

  let imodel: IModelConnection;

  before(async () => {
    initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.closeStandalone();
    terminate();
  });

  it("gets filtered node paths", async () => {
    const ruleset: Ruleset = require("../../test-rulesets/NodePaths/getFilteredNodePaths");
    /* Hierarchy in the ruleset:
    filter r1
      filter ch1
      other ch2
      other ch3
        filter ch4
    other r2
    other r3
      other ch5
      filter ch6
    */
    await using(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const result = await Presentation.presentation.getFilteredNodePaths({ imodel, rulesetId: ruleset.id }, "filter");
      expect(result).to.matchSnapshot();
    });
  });

  it("gets node paths", async () => {
    const ruleset: Ruleset = require("../../test-rulesets/NodePaths/getNodePaths");
    /*
    [BisCore:RepositoryModel] 0x1
      [BisCore:Subject] 0x1
        [BisCore:DefinitionPartition] ECClassGroupingNode
          [BisCore:DefinitionPartition] 0x10
        [BisCore:LinkPartition] ECClassGroupingNode
          [BisCore:LinkPartition] 0xe
    */
    await using(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const key1: InstanceKey = { id: new Id64("0x1"), className: "BisCore:RepositoryModel" };
      const key2: InstanceKey = { id: new Id64("0x1"), className: "BisCore:Subject" };
      const key3: InstanceKey = { id: new Id64("0x10"), className: "BisCore:DefinitionPartition" };
      const key4: InstanceKey = { id: new Id64("0xe"), className: "BisCore:LinkPartition" };
      const keys: InstanceKey[][] = [[key1, key2, key3], [key1, key2, key4]];

      const result = await Presentation.presentation.getNodePaths({ imodel, rulesetId: ruleset.id }, keys, 1);
      expect(result).to.matchSnapshot();
    });
  });

});
