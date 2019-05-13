/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";
import { Id64, BeDuration, using } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, InstanceKey, Ruleset, PresentationError } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";

describe("Content", () => {

  let imodel: IModelConnection;

  before(async () => {
    initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openSnapshot(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.closeSnapshot();
    terminate();
  });

  describe("DistinctValues", () => {

    it("gets distinct content values", async () => {
      const ruleset: Ruleset = require("../../test-rulesets/DistinctValues/getRelatedDistinctValues");
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
        const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
        const keys = new KeySet([key1, key2]);
        const descriptor = await Presentation.presentation.getContentDescriptor({ imodel, rulesetId: ruleset.id }, "Grid", keys, undefined);
        expect(descriptor).to.not.be.undefined;
        const distinctValues = await Presentation.presentation.getDistinctValues({ imodel, rulesetId: ruleset.id }, descriptor!, keys,
          "SubCategory_DefinitionPartition_LinkPartition_PhysicalPartition_Model");
        expect(distinctValues).to.be.deep.equal([
          "Definition Model For DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default",
          "DgnV8Bridge",
        ]);
      });
    });
  });

  describe.skip("when getContent request in the backend exceeds the backend result wait time", () => {
    let beDurationWaitStub: sinon.SinonStub<any[], any>;
    let resultWaitTime: number;

    beforeEach(() => {
      beDurationWaitStub = sinon.stub(BeDuration, "wait").callsFake(async (_ms: number) => {
        return new Promise<void>((resolve: any) => setTimeout(resolve, resultWaitTime));
      });
    });

    afterEach(() => {
      beDurationWaitStub.restore();
    });

    it("should throw PresentationError", async () => {
      const ruleset: Ruleset = require("../../test-rulesets/DistinctValues/getRelatedDistinctValues");
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
        resultWaitTime = 500;
        const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
        const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
        const keys = new KeySet([key1, key2]);
        const descriptor = await Presentation.presentation.getContentDescriptor({ imodel, rulesetId: ruleset.id }, "Grid", keys, undefined);
        expect(descriptor).to.not.be.undefined;
        resultWaitTime = 0;
        await expect(Presentation.presentation.getContent({ imodel, rulesetId: ruleset.id }, descriptor!, keys)).to.be.rejectedWith(PresentationError);
      });
    });
  });
});
