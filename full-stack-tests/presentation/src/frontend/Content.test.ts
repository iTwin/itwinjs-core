/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon = require("sinon");
import { Id64 } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, InstanceKey, Ruleset, PresentationError, PresentationStatus, RuleTypes, ContentSpecificationTypes } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";

describe("Content", () => {

  let imodel: IModelConnection;
  const openIModel = async () => {
    imodel = await IModelConnection.openSnapshot("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).is.not.null;
  };

  before(async () => {
    await initialize();
    await openIModel();
  });

  after(() => {
    terminate();
  });

  describe("DistinctValues", () => {

    it("gets distinct content values", async () => {
      const ruleset: Ruleset = {
        id: "getRelatedDistinctValues",
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentRelatedInstances,
            relatedClasses: {
              schemaName: "BisCore",
              classNames: [
                "SubCategory",
                "LinkPartition",
                "DefinitionPartition",
                "PhysicalPartition",
              ],
            },
          }],
        }],
      };
      const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
      const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
      const keys = new KeySet([key1, key2]);
      const descriptor = await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset }, "Grid", keys, undefined);
      expect(descriptor).to.not.be.undefined;
      const field = descriptor!.getFieldByName("pc_bis_Element_Model");
      expect(field).to.not.be.undefined;
      const distinctValues = await Presentation.presentation.getDistinctValues({ imodel, rulesetOrId: ruleset }, descriptor!, keys, field!.name);
      expect(distinctValues).to.be.deep.equal([
        "Definition Model For DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default",
        "DgnV8Bridge",
      ]);
    });

  });

  describe("when request in the backend exceeds the backend timeout time", () => {

    let raceStub: sinon.SinonStub<[Iterable<unknown>], Promise<unknown>>;

    beforeEach(async () => {
      // re-initialize to set backend response timeout to 500 ms
      terminate();
      await initialize(500);
      await openIModel();

      // mock `Promise.race` to always reject
      const realRace = Promise.race;
      raceStub = sinon.stub(Promise, "race").callsFake(async (values) => {
        (values as any).push(new Promise((_resolve, reject) => { reject("something"); }));
        return realRace.call(Promise, values);
      });
    });

    afterEach(() => {
      raceStub.restore();
    });

    it("should throw PresentationError", async () => {
      const ruleset: Ruleset = {
        id: "test",
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
        }],
      };
      const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
      const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
      const keys = new KeySet([key1, key2]);
      await expect(Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset }, "Grid", keys, undefined))
        .to.be.eventually.rejectedWith(PresentationError).and.have.property("errorNumber", PresentationStatus.BackendTimeout);
    });

  });

});
