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
import { collect } from "../../../Utils";

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

  describe("Hierarchy Specifications", () => {
    describe("CustomNodeSpecification", () => {
      it("uses `type` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.CustomNodeSpecification.Type.Ruleset
        // The ruleset has a root node specification that returns a single custom node with specified parameters. There's
        // also a child node rule that assigns the child based on root node's type.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "CustomNode",
                  type: "T_ROOT_NODE",
                  label: "My Root Node",
                },
              ],
            },
            {
              ruleType: "ChildNodes",
              condition: `ParentNode.Type = "T_ROOT_NODE"`,
              specifications: [
                {
                  specType: "CustomNode",
                  type: "T_CHILD_NODE",
                  label: "My Child Node",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that node with correct type is returned
        const rootNodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(rootNodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              key: { type: "T_ROOT_NODE" },
            },
          ]);
        const childNodes = await Presentation.presentation
          .getNodesIterator({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[0].key })
          .then(async (x) => collect(x.items));
        expect(childNodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              key: { type: "T_CHILD_NODE" },
            },
          ]);
      });

      it("uses `label` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.CustomNodeSpecification.Label.Ruleset
        // The ruleset has a root node specification that returns a single custom node with specified parameters.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "CustomNode",
                  type: "T_MY_NODE",
                  label: "My Node",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that node with correct label is returned
        const nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              label: { displayValue: "My Node" },
            },
          ]);
      });

      it("uses `description` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.CustomNodeSpecification.Description.Ruleset
        // The ruleset has a root node specification that returns a single custom node and assigns it a description.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "CustomNode",
                  type: "T_MY_NODE",
                  label: "My Node",
                  description: "My node's description",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that node with correct description is returned
        const nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              description: "My node's description",
            },
          ]);
      });

      it("uses `imageId` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.CustomNodeSpecification.ImageId.Ruleset
        // The ruleset has a root node specification that returns a single custom node and assigns it an image identifier.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "CustomNode",
                  type: "T_MY_NODE",
                  label: "My Node",
                  imageId: "my-icon-identifier",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.CustomNodeSpecification.ImageId.Result
        // Verify that node with correct image identifier is returned
        const nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              imageId: "my-icon-identifier",
            },
          ]);
        // __PUBLISH_EXTRACT_END__
      });

      it("uses `hideNodesInHierarchy` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.CustomNodeSpecification.HideNodesInHierarchy.Ruleset
        // This ruleset produces a hierarchy that consists of two custom nodes. The parent node is hidden by
        // `hideNodesInHierarchy` attribute, thus its child appears one hierarchy level higher.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "CustomNode",
                  type: "parent",
                  label: "Parent",
                  hideNodesInHierarchy: true,
                },
              ],
            },
            {
              ruleType: "ChildNodes",
              condition: `ParentNode.Type = "parent"`,
              specifications: [
                {
                  specType: "CustomNode",
                  type: "child",
                  label: "Child",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify the Parent node is not displayed
        const nodes = await Presentation.presentation.getNodesIterator({ imodel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
        expect(nodes)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              key: { type: "child" },
              label: { displayValue: "Child" },
            },
          ]);
      });
    });
  });
});
