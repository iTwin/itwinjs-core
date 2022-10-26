/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */
import { expect } from "chai";
import * as fs from "fs";
import { SnapshotDb } from "@itwin/core-backend";
import { PresentationManager } from "@itwin/presentation-backend";
import { ChildNodeSpecificationTypes, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { initialize, terminate } from "../IntegrationTests";

describe("ReadWrite", () => {

  let manager: PresentationManager;
  let imodel: SnapshotDb;
  const testIModelName: string = "assets/datasets/ReadWrite.ibim";

  function createSnapshotFromSeed(testFileName: string, seedFileName: string): SnapshotDb {
    const seedDb = SnapshotDb.openFile(seedFileName);
    const testDb = SnapshotDb.createFrom(seedDb, testFileName);
    seedDb.close();
    return testDb;
  }

  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  beforeEach(async () => {
    manager = new PresentationManager();
    imodel = createSnapshotFromSeed(testIModelName, "assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  afterEach(async () => {
    imodel.close();
    fs.unlinkSync(testIModelName);
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

      console.log(`[${new Date().toISOString()}] before nodes request`);
      const nodesRequest = manager.getNodes({
        imodel,
        rulesetOrId: ruleset,
      });

      console.log(`[${new Date().toISOString()}] before schemas import`);
      await imodel.importSchemaStrings([schema]);

      console.log(`[${new Date().toISOString()}] before commit`);
      imodel.saveChanges();

      console.log(`[${new Date().toISOString()}] before awaiting nodes`);
      const nodes = await nodesRequest;
      console.log(`[${new Date().toISOString()}] after awaiting nodes`);

      expect(nodes.length).to.eq(85);
    });

  });

});
