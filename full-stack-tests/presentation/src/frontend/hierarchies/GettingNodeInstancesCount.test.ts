/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as faker from "faker";
import { using } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, ECInstancesNodeKey, getInstancesCount, KeySet, RegisteredRuleset, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";
import { collect } from "../../Utils";

describe("Hierarchies", () => {
  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  describe("Getting node instances count", () => {
    let imodel: IModelConnection;

    before(async () => {
      const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
      imodel = await SnapshotConnection.openFile(testIModelName);
    });

    after(async () => {
      await imodel.close();
    });

    it("correctly counts instances when key set contains grouping node keys", async () => {
      const ruleset: Ruleset = {
        id: faker.random.word(),
        rules: [
          {
            ruleType: RuleTypes.RootNodes,
            specifications: [
              {
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "BisCore", classNames: ["Model"] },
                arePolymorphic: true,
                groupByClass: true,
                groupByLabel: false,
              },
            ],
          },
        ],
      };
      await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
        const rootNodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset.id }).then(async (x) => collect(x.items));
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

        const definitionModelNodes = await Presentation.presentation
          .getNodesIterator({
            imodel,
            rulesetOrId: ruleset.id,
            parentKey: rootNodes[0].key,
          })
          .then(async (x) => collect(x.items));
        const dictionaryModelNodes = await Presentation.presentation
          .getNodesIterator({
            imodel,
            rulesetOrId: ruleset.id,
            parentKey: rootNodes[1].key,
          })
          .then(async (x) => collect(x.items));

        const keys = new KeySet([definitionModelNodes[0].key, ...(dictionaryModelNodes[0].key as ECInstancesNodeKey).instanceKeys, rootNodes[2].key]);
        const instancesCount = getInstancesCount(keys);
        expect(instancesCount).to.eq(4);
      });
    });
  });
});
