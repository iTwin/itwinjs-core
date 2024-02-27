/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../../IntegrationTests";
import { printRuleset } from "../../Utils";

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

  describe("Hierarchy Rules", () => {
    describe("NodeArtifacts", () => {
      it("uses `condition` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.NodeArtifacts.Condition.Ruleset
        // The ruleset has a root nodes rule that returns `bis.Model` nodes only if their child node
        // artifacts contain an artifact "IsSpecialChild". There's also a child nodes rule that produces
        // hidden child nodes for `bis.Model` and `bis.GeometricElement3d` nodes have the "IsSpecialChild" artifact value
        // set to `true`. This means only `bis.GeometricModel3d` nodes should be displayed as root nodes (no other
        // type of `bis.Model` should have `bis.GeometricElement3d` elements).
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: [{ schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true }],
                  hideExpression: `NOT ThisNode.ChildrenArtifacts.AnyMatches(x => x.IsSpecialChild)`,
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "ChildNodes",
              condition: `ParentNode.IsOfClass("Model", "BisCore")`,
              specifications: [
                {
                  specType: "RelatedInstanceNodes",
                  relationshipPaths: [
                    {
                      relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                      direction: "Forward",
                    },
                  ],
                  hideNodesInHierarchy: true,
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
              customizationRules: [
                {
                  ruleType: "NodeArtifacts",
                  condition: `ThisNode.IsOfClass("GeometricElement3d", "BisCore")`,
                  items: {
                    ["IsSpecialChild"]: `TRUE`,
                  },
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.NodeArtifacts.Condition.Result
        // Confirm we get only the GeometricModel3d
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes)
          .to.have.lengthOf(1)
          .and.containSubset([
            {
              key: { instanceKeys: [{ className: "BisCore:PhysicalModel" }] },
              hasChildren: undefined,
            },
          ]);
        // __PUBLISH_EXTRACT_END__
      });

      it("uses `items` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.NodeArtifacts.Items.Ruleset
        // The ruleset has a root nodes rule that returns `bis.Model` nodes only if their child node
        // artifacts contain an artifact "IsSpecialChild". There's also a child nodes rule that produces
        // hidden child nodes for `bis.Model` and the nodes have a calculated "IsSpecialChild" artifact value
        // that only evaluates to `true` for `bis.GeometricElement3d` elements. This means only `bis.GeometricModel3d`
        // models should be displayed as root nodes (no other type of `bis.Model` should have `bis.GeometricElement3d`
        // elements).
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: [{ schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true }],
                  hideExpression: `NOT ThisNode.ChildrenArtifacts.AnyMatches(x => x.IsSpecialChild)`,
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "ChildNodes",
              condition: `ParentNode.IsOfClass("Model", "BisCore")`,
              specifications: [
                {
                  specType: "RelatedInstanceNodes",
                  relationshipPaths: [
                    {
                      relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                      direction: "Forward",
                    },
                  ],
                  hideNodesInHierarchy: true,
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
              customizationRules: [
                {
                  ruleType: "NodeArtifacts",
                  items: {
                    ["IsSpecialChild"]: `this.IsOfClass("GeometricElement3d", "BisCore")`,
                  },
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.NodeArtifacts.Items.Result
        // Confirm we get only the GeometricModel3d
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes)
          .to.have.lengthOf(1)
          .and.containSubset([
            {
              key: { instanceKeys: [{ className: "BisCore:PhysicalModel" }] },
              hasChildren: undefined,
            },
          ]);
        // __PUBLISH_EXTRACT_END__
      });
    });
  });
});
