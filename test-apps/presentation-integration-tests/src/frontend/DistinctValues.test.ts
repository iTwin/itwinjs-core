/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";
import { OpenMode, Id64, using } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, InstanceKey, Ruleset } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";

describe("DistinctValues", async () => {
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

  it("gets distinct content values", async () => {
    const ruleset: Ruleset = require("../../test-rulesets/DistinctValues/getRelatedDistinctValues");
    await using(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const key1: InstanceKey = { id: new Id64("0x1"), className: "BisCore:Subject" };
      const key2: InstanceKey = { id: new Id64("0x17"), className: "BisCore:SpatialCategory" };
      const keys = new KeySet([key1, key2]);
      const descriptor = await Presentation.presentation.getContentDescriptor({ imodel, rulesetId: ruleset.id }, "Grid", keys, undefined);
      expect(descriptor).to.not.be.undefined;
      const distinctValues = await Presentation.presentation.getDistinctValues({ imodel, rulesetId: ruleset.id }, descriptor!, keys,
        "SubCategory_DefinitionPartition_LinkPartition_PhysicalPartition_Model");
      expect(distinctValues).to.be.deep.equal(["Definition Model-0-M", "Repository Model-0-1"]);
    });
  });

});
