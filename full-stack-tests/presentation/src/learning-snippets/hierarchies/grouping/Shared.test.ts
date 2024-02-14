/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { Ruleset, StandardNodeTypes } from "@itwin/presentation-common";
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

  describe("Hierarchy Grouping", () => {
    it("uses `condition` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Grouping.Condition.Ruleset
      // There's a hierarchy of `bis.Model` instances and their elements. In addition, there's a grouping rule for `bis.Element`
      // that only takes effect if element's model has `IsPrivate` flag set to `true`.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true },
                groupByClass: false,
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
                groupByClass: false,
                groupByLabel: false,
              },
            ],
            customizationRules: [
              {
                ruleType: "Grouping",
                class: { schemaName: "BisCore", className: "Element" },
                condition: `ParentNode.ECInstance.IsPrivate`,
                groups: [
                  {
                    specType: "Property",
                    propertyName: "CodeValue",
                    createGroupForSingleItem: true,
                  },
                ],
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Confirm that only private models have children grouped by property
      const modelNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(modelNodes)
        .to.have.lengthOf(8)
        .and.containSubset([
          {
            label: { displayValue: "BisCore.DictionaryModel" },
          },
          {
            label: { displayValue: "BisCore.RealityDataSources" },
          },
          {
            label: { displayValue: "Converted Drawings" },
          },
          {
            label: { displayValue: "Converted Groups" },
          },
          {
            label: { displayValue: "Converted Sheets" },
          },
          {
            label: { displayValue: "Definition Model For DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default" },
          },
          {
            label: { displayValue: "Properties_60InstancesWithUrl2" },
          },
          {
            // Note: Due to bug #776790 the label of RepositoryModel is not calculated correctly and it gets the
            // localized "Not Specified" label. Confirm that's the expected model using its id.
            key: { instanceKeys: [{ id: "0x1" }] },
          },
        ]);

      const privateModels = ["BisCore.DictionaryModel", "BisCore.RealityDataSources"];
      await Promise.all(
        modelNodes.map(async (modelNode) => {
          if (!modelNode.hasChildren) {
            return;
          }

          const expectedChildrenType = privateModels.includes(modelNode.label.displayValue)
            ? StandardNodeTypes.ECPropertyGroupingNode
            : StandardNodeTypes.ECInstancesNode;
          const childNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: modelNode.key });
          childNodes.forEach((childNode) => {
            expect(childNode.key.type).to.eq(expectedChildrenType, `Unexpected child node type for model "${modelNode.label.displayValue}".`);
          });
        }),
      );
    });

    it("uses `createGroupForSingleItem` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Grouping.Specification.CreateGroupForSingleItem.Ruleset
      // There's a root nodes rule that returns nodes for all `bis.Element` instances and there's a grouping rule
      // that groups those elements by `CodeValue` property. The grouping rule has the `createGroupForSingleItem`
      // flag, so property grouping nodes are created even if they group only a single element.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
                groupByClass: false,
              },
            ],
            customizationRules: [
              {
                ruleType: "Grouping",
                class: { schemaName: "BisCore", className: "Element" },
                groups: [
                  {
                    specType: "Property",
                    propertyName: "CodeValue",
                    createGroupForSingleItem: true,
                  },
                ],
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Confirm all nodes are property grouping nodes
      const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(nodes).to.be.not.empty;
      nodes.forEach((node) => {
        expect(node.key.type).to.eq(StandardNodeTypes.ECPropertyGroupingNode);
      });
    });
  });
});
