/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Ruleset, RuleTypes, ChildNodeSpecificationTypes } from "@bentley/presentation-common";
import { PresentationManager } from "@bentley/presentation-frontend";

describe("Multiple frontends for one backend", async () => {

  describe("Rulesets", () => {

    let imodel: IModelConnection;
    let frontends: PresentationManager[];

    before(async () => {
      initialize();

      const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
      imodel = await IModelConnection.openSnapshot(testIModelName);
      expect(imodel).is.not.null;

      frontends = [0, 1].map(() => PresentationManager.create());
    });

    after(async () => {
      await imodel.closeSnapshot();
      frontends.forEach((f) => f.dispose());
      terminate();
    });

    it("Handles multiple simultaneous requests from different frontends with different rulesets with same id", async () => {
      const rulesets: Ruleset[] = [];
      rulesets[0] = {
        id: "test",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.CustomNode,
            type: "test",
            label: "label 0",
            description: "description 0",
            imageId: "image 0",
          }],
        }],
      };
      rulesets[1] = {
        id: "test",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.CustomNode,
            type: "test",
            label: "label 1",
            description: "description 1",
            imageId: "image 1",
          }],
        }],
      };

      const registeredRulesets = await Promise.all(frontends.map(async (f, i) => f.rulesets().add(rulesets[i])));

      const nodes = await Promise.all(frontends.map(async (f) => f.getNodes({ imodel, rulesetId: "test" })));
      frontends.forEach((_f, i) => {
        expect(nodes[i][0].label).to.eq(`label ${i}`);
      });

      registeredRulesets.forEach((r) => r.dispose());
    });

  });

});
