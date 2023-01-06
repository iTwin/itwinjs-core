/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import { IModelDb, StandaloneDb } from "@itwin/core-backend";
import { PresentationManager } from "@itwin/presentation-backend";
import { ChildNodeSpecificationTypes, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { initialize, terminate } from "../IntegrationTests";

describe("ReadWrite", () => {

  let manager: PresentationManager;
  let imodel: IModelDb;
  const testIModelPath = "assets/datasets/ReadWrite.ibim";

  function createIModelFromSeed() {
    if (fs.existsSync(testIModelPath))
      fs.unlinkSync(testIModelPath);
    fs.copyFileSync("assets/datasets/Properties_60InstancesWithUrl2.ibim", testIModelPath);
    return StandaloneDb.openFile(testIModelPath);
  }

  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  beforeEach(async () => {
    manager = new PresentationManager();
    imodel = createIModelFromSeed();
  });

  afterEach(async () => {
    imodel.close();
    fs.unlinkSync(testIModelPath);
    manager.dispose();
  });

  describe("Handling read-write operations", () => {

    it("handles schema import during nodes request", async () => {
      const ruleset: Ruleset = {
        id: "test",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "BisCore", classNames: ["Element"] },
            arePolymorphic: true,
            groupByClass: false,
          }],
        }],
      };
      const schema = `<?xml version="1.0" encoding="UTF-8"?>
        <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
            <ECSchemaReference name="BisCore" version="01.00" alias="bis" />
            <ECEntityClass typeName="TestElement">
                <BaseClass>bis:GraphicalElement3d</BaseClass>
                <ECProperty propertyName="s" typeName="string" />
            </ECEntityClass>
        </ECSchema>`;

      const nodesRequest = manager.getNodes({
        imodel,
        rulesetOrId: ruleset,
      });

      await imodel.importSchemaStrings([schema]);
      imodel.saveChanges();

      const nodes = await nodesRequest;
      expect(nodes.length).to.eq(85);
    });

  });

});
