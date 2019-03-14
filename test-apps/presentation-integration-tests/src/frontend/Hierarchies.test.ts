/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { initialize, terminate } from "../IntegrationTests";
import { Id64, using } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  InstanceKey, Ruleset, RuleTypes, RuleSpecificationTypes,
  KeySet, ECInstanceNodeKey, getInstancesCount, RegisteredRuleset,
} from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";

describe("Hierarchies", () => {

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

  describe("NodesPaths", () => {

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
      await using(await Presentation.presentation.rulesets().add(ruleset), async (_r) => {
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
      await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
        const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:RepositoryModel" };
        const key2: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
        const key3: InstanceKey = { id: Id64.fromString("0x10"), className: "BisCore:DefinitionPartition" };
        const key4: InstanceKey = { id: Id64.fromString("0xe"), className: "BisCore:LinkPartition" };
        const keys: InstanceKey[][] = [[key1, key2, key3], [key1, key2, key4]];

        const result = await Presentation.presentation.getNodePaths({ imodel, rulesetId: ruleset.id }, keys, 1);
        expect(result).to.matchSnapshot();
      });

    });

  });

  describe("Counting instances of selected nodes", () => {

    it("correctly counts instances when key set contains grouping node keys", async () => {
      const ruleset: Ruleset = {
        id: faker.random.word(),
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: RuleSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "BisCore", classNames: ["Model"] },
            arePolymorphic: true,
            groupByClass: true,
            groupByLabel: false,
          }],
        }],
      };
      await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
        const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetId: ruleset.id });
        expect(rootNodes).to.matchSnapshot();
        /*
        The result should look like this (all grouping nodes):
          Label                 Grouped Instances Count
          Definition Model      1
          Dictionary Model      1
          Document List         2
          Group Model           1
          Link Model            1
          Physical Model        1
          Repository Model      1

        we're going to count instances for:
          - one of the definition model node keys
          - dictionary model's instance key
          - document list grouping node key
        the result should be 1 + 1 + 2 = 4
        */

        const definitionModelNodes = await Presentation.presentation.getNodes(
          { imodel, rulesetId: ruleset.id }, rootNodes[0].key);
        const dictionaryModelNodes = await Presentation.presentation.getNodes(
          { imodel, rulesetId: ruleset.id }, rootNodes[1].key);

        const keys = new KeySet([
          definitionModelNodes[0].key,
          (dictionaryModelNodes[0].key as ECInstanceNodeKey).instanceKey,
          rootNodes[2].key,
        ]);
        const instancesCount = getInstancesCount(keys);
        expect(instancesCount).to.eq(4);
      });
    });

  });

});
