/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import { OpenMode, Id64 } from "@bentley/bentleyjs-core";
import { InstanceKey, PresentationRuleSet } from "@bentley/ecpresentation-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import "@helpers/Snapshots";

before(() => {
  initialize();
});

after(() => {
  terminate();
});

describe("NodesPaths", async () => {

  let imodel: IModelConnection;

  before(async () => {
    const testIModelName: string = "assets/datasets/1K.bim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.closeStandalone();
  });

  /*
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
  it("gets filtered node paths", async () => {
    const ruleset: PresentationRuleSet = require("../../test-rulesets/getFilteredNodePaths");
    await ECPresentation.presentation.addRuleSet(ruleset);
    const options = { imodel, rulesetId: ruleset.ruleSetId };
    const result = await ECPresentation.presentation.getFilteredNodePaths(options, "filter");
    expect(result).to.matchSnapshot();
  });

  it("gets node paths", async () => {
    const ruleset: PresentationRuleSet = require("../../test-rulesets/getNodePaths");
    await ECPresentation.presentation.addRuleSet(ruleset);
    const key1: InstanceKey = { id: new Id64("0x1"), className: "BisCore:RepositoryModel" };
    const key2: InstanceKey = { id: new Id64("0x1"), className: "BisCore:Subject" };
    const key3: InstanceKey = { id: new Id64("0x12"), className: "BisCore:PhysicalPartition" };
    const key4: InstanceKey = { id: new Id64("0xe"), className: "BisCore:LinkPartition" };
    const keys: InstanceKey[][] = [[key1, key2, key3], [key1, key2, key4]];
    const options = { imodel, rulesetId: ruleset.ruleSetId };

    const result = await ECPresentation.presentation.getNodePaths(options, keys, 1);
    expect(result).to.matchSnapshot();
  });

});
