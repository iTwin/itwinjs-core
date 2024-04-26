/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { KeySet, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";
import { printRuleset } from "../Utils";

describe("Learning Snippets", () => {
  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("RelationshipPathSpecification", () => {
    it("using single-step specification", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RelationshipPathSpecification.SingleStep.Ruleset
      // This ruleset defines a specification that returns content for given `bis.Model` instances. The
      // content is created for model elements found by following the `bis.ModelContainsElements`
      // relationship and picking only `bis.PhysicalElement` type of elements.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "Content",
            condition: `SelectedNode.IsOfClass("Model", "BisCore")`,
            specifications: [
              {
                specType: "ContentRelatedInstances",
                relationshipPaths: [
                  {
                    relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                    direction: "Forward",
                    targetClass: { schemaName: "BisCore", className: "PhysicalElement" },
                  },
                ],
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that all model elements are selected
      const physicalModelContent = await Presentation.presentation.getContentIterator({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
        descriptor: {},
      });
      expect(physicalModelContent?.total).to.eq(62);

      // Ensure that non-physical model elements are not selected
      const definitionModelContent = await Presentation.presentation.getContentIterator({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:DefinitionModel", id: "0x16" }]),
        descriptor: {},
      });
      expect(definitionModelContent).to.be.undefined;
    });

    it("using multi-step specification", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RelationshipPathSpecification.MultiStep.Ruleset
      // This ruleset defines a specification that returns content for given `bis.GeometricModel3d` instances. The
      // content is created for categories of model elements found by following the `bis.ModelContainsElements` and
      // `bis.GeometricElement3dIsInCategory` relationships.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "Content",
            condition: `SelectedNode.IsOfClass("GeometricModel3d", "BisCore")`,
            specifications: [
              {
                specType: "ContentRelatedInstances",
                relationshipPaths: [
                  [
                    {
                      relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                      direction: "Forward",
                    },
                    {
                      relationship: { schemaName: "BisCore", className: "GeometricElement3dIsInCategory" },
                      direction: "Forward",
                    },
                  ],
                ],
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that all model elements are selected
      const physicalModelContent = await Presentation.presentation.getContentIterator({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
        descriptor: {},
      });
      expect(physicalModelContent?.total).to.eq(1);
    });
  });
});
