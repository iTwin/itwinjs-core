/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { PresentationManager } from "@itwin/presentation-frontend";
import { initialize, resetBackend, terminate } from "../../IntegrationTests";
import { collect } from "../../Utils";

describe("Hierarchies", () => {
  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  describe("Multiple backends for one frontend", () => {
    let imodel: IModelConnection;
    let frontend: PresentationManager;

    before(async () => {
      const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
      imodel = await SnapshotConnection.openFile(testIModelName);
    });

    after(async () => {
      await imodel.close();
    });

    beforeEach(async () => {
      frontend = PresentationManager.create();
    });

    afterEach(async () => {
      frontend.dispose();
    });

    it("gets child nodes after backend is reset", async () => {
      const ruleset: Ruleset = {
        id: "localization test",
        rules: [
          {
            ruleType: RuleTypes.RootNodes,
            specifications: [
              {
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "root",
                label: "root",
              },
            ],
          },
          {
            ruleType: RuleTypes.ChildNodes,
            condition: 'ParentNode.Type = "root"',
            specifications: [
              {
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "child",
                label: "child",
              },
            ],
          },
        ],
      };
      const props = { imodel, rulesetOrId: ruleset };

      const rootNodes = await frontend.getNodesIterator(props).then(async (x) => collect(x.items));
      expect(rootNodes.length).to.eq(1);
      expect(rootNodes[0].key.type).to.eq("root");

      resetBackend();

      const childNodes = await frontend
        .getNodesIterator({
          ...props,
          parentKey: rootNodes[0].key,
        })
        .then(async (x) => collect(x.items));
      expect(childNodes.length).to.eq(1);
      expect(childNodes[0].key.type).to.eq("child");
    });
  });
});
