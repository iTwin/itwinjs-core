/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { assert } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { NodeKey, Ruleset, StandardNodeTypes } from "@itwin/presentation-common";
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

  describe("Hierarchy Specifications", () => {
    it("uses `hideNodesInHierarchy` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Specification.HideNodesInHierarchy.Ruleset
      // The ruleset contains a root node specification for `bis.PhysicalModel` nodes which are grouped by class and hidden. This
      // means class grouping nodes are displayed, but instance nodes are hidden and instead their children are displayed. The
      // children are determined by another rule.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["PhysicalModel"], arePolymorphic: true },
                hideNodesInHierarchy: true,
              },
            ],
          },
          {
            ruleType: "ChildNodes",
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

      // Verify PhysicalModel's class grouping node is displayed, but the instance node - not
      const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(classGroupingNodes)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            label: { displayValue: "Physical Model" },
          },
        ]);

      const customNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[0].key });
      expect(customNodes)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            label: { displayValue: "Child" },
          },
        ]);
    });

    it("uses `hideIfNoChildren` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Specification.HideIfNoChildren.Ruleset
      // The ruleset contains root node specifications for two custom nodes which are only
      // displayed if they have children. One of them has children and the other - not, so
      // only one of them is displayed
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "CustomNode",
                type: "2d",
                label: "2d Elements",
                hideIfNoChildren: true,
              },
              {
                specType: "CustomNode",
                type: "3d",
                label: "3d Elements",
                hideIfNoChildren: true,
              },
            ],
          },
          {
            ruleType: "ChildNodes",
            condition: `ParentNode.Type = "2d"`,
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["GeometricElement2d"], arePolymorphic: true },
              },
            ],
          },
          {
            ruleType: "ChildNodes",
            condition: `ParentNode.Type = "3d"`,
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["GeometricElement3d"], arePolymorphic: true },
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Verify that only 3d elements' custom node is loaded
      const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(rootNodes)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            key: { type: "3d" },
            label: { displayValue: "3d Elements" },
            hasChildren: true,
          },
        ]);

      const element3dNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[0].key });
      expect(element3dNodes).to.not.be.empty;
    });

    it("uses `hideExpression` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Specification.HideExpression.Ruleset
      // The ruleset contains root node specifications for two custom nodes which are only
      // displayed if they have children. One of them has children and the other - not, so
      // only one of them is displayed
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "CustomNode",
                type: "2d",
                label: "2d Elements",
                hideExpression: `ThisNode.HasChildren = FALSE`,
              },
              {
                specType: "CustomNode",
                type: "3d",
                label: "3d Elements",
                hideExpression: `ThisNode.HasChildren = FALSE`,
              },
            ],
          },
          {
            ruleType: "ChildNodes",
            condition: `ParentNode.Type = "2d"`,
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["GeometricElement2d"], arePolymorphic: true },
              },
            ],
          },
          {
            ruleType: "ChildNodes",
            condition: `ParentNode.Type = "3d"`,
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["GeometricElement3d"], arePolymorphic: true },
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Verify that only 3d elements' custom node is loaded
      const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(rootNodes)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            key: { type: "3d" },
            label: { displayValue: "3d Elements" },
            hasChildren: true,
          },
        ]);

      const element3dNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[0].key });
      expect(element3dNodes).to.not.be.empty;
    });

    it("uses `suppressSimilarAncestorsCheck` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Specification.SuppressSimilarAncestorsCheck.Ruleset
      // The ruleset contains a root node specification that returns the root `bis.Subject` node. Also, there are two
      // child node rules:
      // - For any `bis.Model` node, return its contained `bis.Element` nodes.
      // - For any `bis.Element` node, return its children `bis.Model` nodes.
      // Children of the root `bis.Subject` are all in the single `bis.RepositoryModel` and some of their children are in the same
      // `bis.RepositoryModel` as their parent. This means the `bis.RepositoryModel` node has to be repeated in the hierarchy, but
      // that wouldn't happen due to duplicate nodes prevention, unless the `suppressSimilarAncestorsCheck` flag is set.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["Subject"] },
                instanceFilter: `this.ECInstanceId = 1`,
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
                groupByClass: false,
                groupByLabel: false,
              },
            ],
          },
          {
            ruleType: "ChildNodes",
            condition: `ParentNode.IsOfClass("Element", "BisCore")`,
            specifications: [
              {
                specType: "RelatedInstanceNodes",
                relationshipPaths: [
                  [
                    {
                      relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                      direction: "Forward",
                    },
                    {
                      relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                      direction: "Backward",
                    },
                  ],
                ],
                suppressSimilarAncestorsCheck: true,
                groupByClass: false,
                groupByLabel: false,
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Verify that RepositoryModel is repeated in the hierarchy
      const rootSubjectNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(rootSubjectNodes)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ className: "BisCore:Subject", id: "0x1" }] },
            label: { displayValue: "DgnV8Bridge" },
          },
        ]);

      const rootSubjectChildNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootSubjectNodes[0].key });
      expect(rootSubjectChildNodes)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ className: "BisCore:RepositoryModel", id: "0x1" }] },
          },
        ]);

      const repositoryModelChildNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootSubjectChildNodes[0].key });
      expect(repositoryModelChildNodes)
        .to.have.lengthOf(11)
        .and.to.containSubset([
          {
            label: { displayValue: "DgnV8Bridge" },
          },
          {
            label: { displayValue: "BisCore.RealityDataSources" },
          },
          {
            label: { displayValue: "BisCore.DictionaryModel" },
          },
          {
            label: { displayValue: "Properties_60InstancesWithUrl2.dgn" },
          },
          {
            label: { displayValue: "DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default" },
          },
          {
            label: { displayValue: "Converted Groups" },
          },
          {
            label: { displayValue: "Converted Drawings" },
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
            label: { displayValue: "Properties_60InstancesWithUrl2" },
          },
        ]);

      const repositoryModelNodes2 = await Presentation.presentation.getNodes({
        imodel,
        rulesetOrId: ruleset,
        parentKey: repositoryModelChildNodes.find((n) => n.label.displayValue === "DgnV8Bridge")!.key,
      });
      expect(repositoryModelNodes2)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ className: "BisCore:RepositoryModel", id: "0x1" }] },
          },
        ]);
    });

    it("uses `priority` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Specification.Priority.Ruleset
      // This ruleset produces a list of `bis.PhysicalModel` and `bis.SpatialCategory` instances and groups them by
      // class. "Spatial Category" group will appear first because it has been given a higher priority value.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                priority: 1,
                classes: { schemaName: "BisCore", classNames: ["PhysicalModel"], arePolymorphic: true },
              },
              {
                specType: "InstanceNodesOfSpecificClasses",
                priority: 2,
                classes: { schemaName: "BisCore", classNames: ["SpatialCategory"], arePolymorphic: true },
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Verify that SpatialCategory comes before PhysicalModel
      const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(nodes).to.have.lengthOf(2);
      expect(nodes[0]).to.containSubset({
        label: { displayValue: "Spatial Category" },
      });
      expect(nodes[1]).to.containSubset({
        label: { displayValue: "Physical Model" },
      });
    });

    it("uses `doNotSort` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Specification.DoNotSort.Ruleset
      // The ruleset has a specification that returns unsorted `bis.Model` nodes - the order is undefined.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: [{ schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true }],
                doNotSort: true,
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Verify that nodes were returned unsorted
      const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      const sorted = [...nodes].sort((lhs, rhs) => lhs.label.displayValue.localeCompare(rhs.label.displayValue));
      expect(nodes).to.not.deep.eq(sorted);
    });

    it("uses `groupByClass` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Specification.GroupByClass.Ruleset
      // The ruleset contains a specification that returns `bis.Model` nodes without grouping them
      // by class.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: [{ schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true }],
                groupByClass: false,
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Verify that Models were not grouped by class
      const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(nodes).to.not.be.empty;
      nodes.forEach((node) => expect(NodeKey.isClassGroupingNodeKey(node.key)).to.be.false);
    });

    it("uses `groupByLabel` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Specification.GroupByLabel.Ruleset
      // The ruleset contains a specification that returns `meta.ECPropertyDef` nodes without grouping them
      // by label.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: [{ schemaName: "ECDbMeta", classNames: ["ECPropertyDef"] }],
                groupByLabel: false,
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Verify that instances were not grouped by label
      const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      const classGroupingNode = classGroupingNodes.find((node) => {
        assert(NodeKey.isClassGroupingNodeKey(node.key));
        return node.key.className === "ECDbMeta:ECPropertyDef";
      })!;
      const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNode.key });
      expect(nodes).to.not.be.empty;
      nodes.forEach((node) => expect(NodeKey.isLabelGroupingNodeKey(node.key)).to.be.false);
    });

    it("uses `hasChildren` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Specification.HasChildren.Ruleset
      // This ruleset produces a hierarchy of a single root node that hosts a list of `Model` instances. Assuming all
      // iModels contain at least one model, the result of this ruleset can be computed quicker by setting
      // `hasChildren` attribute to `"Always"`.
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
                hasChildren: "Always",
              },
            ],
          },
          {
            ruleType: "ChildNodes",
            condition: `ParentNode.Type="T_ROOT_NODE"`,
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: [{ schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true }],
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Verify that the custom node has `hasChildren` flag and children
      const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(rootNodes)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            key: { type: "T_ROOT_NODE" },
            hasChildren: true,
          },
        ]);

      const modelClassGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[0].key });
      expect(modelClassGroupingNodes)
        .to.have.lengthOf(7)
        .and.to.containSubset([
          {
            key: { type: StandardNodeTypes.ECClassGroupingNode },
            label: { displayValue: "Definition Model" },
          },
          {
            key: { type: StandardNodeTypes.ECClassGroupingNode },
            label: { displayValue: "Dictionary Model" },
          },
          {
            key: { type: StandardNodeTypes.ECClassGroupingNode },
            label: { displayValue: "Document List" },
          },
          {
            key: { type: StandardNodeTypes.ECClassGroupingNode },
            label: { displayValue: "Group Model" },
          },
          {
            key: { type: StandardNodeTypes.ECClassGroupingNode },
            label: { displayValue: "Link Model" },
          },
          {
            key: { type: StandardNodeTypes.ECClassGroupingNode },
            label: { displayValue: "Physical Model" },
          },
          {
            key: { type: StandardNodeTypes.ECClassGroupingNode },
            label: { displayValue: "Repository Model" },
          },
        ]);
    });

    it("uses `relatedInstances` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Specification.RelatedInstances.Ruleset
      // The ruleset contains a root nodes' specification that returns nodes for `bis.Elements` that are in
      // a category containing "a" in either `UserLabel` or `CodeValue` property.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: [{ schemaName: "BisCore", classNames: ["GeometricElement3d"], arePolymorphic: true }],
                relatedInstances: [
                  {
                    relationshipPath: [
                      {
                        relationship: { schemaName: "BisCore", className: "GeometricElement3dIsInCategory" },
                        direction: "Forward",
                      },
                    ],
                    alias: "category",
                    isRequired: true,
                  },
                ],
                instanceFilter: `category.UserLabel ~ "%a%" OR category.CodeValue ~ "%a%"`,
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Verify that Elements whose Category contains "a" in either UserLabel or CodeValue are returned
      const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(nodes)
        .to.have.lengthOf(2)
        .and.to.containSubset([
          {
            key: { type: StandardNodeTypes.ECClassGroupingNode, className: "Generic:PhysicalObject" },
          },
          {
            key: { type: StandardNodeTypes.ECClassGroupingNode, className: "PCJ_TestSchema:TestClass" },
          },
        ]);
    });

    it("uses `nestedRules` attribute", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Specification.NestedRules.Ruleset
      // The ruleset contains two root nodes' specifications:
      // - The first one returns `bis.SpatialCategory` nodes
      // - The second one returns `bis.PhysicalModel` nodes and also has a nested child node rule
      //   that creates a static "child" node.
      // Nested rules apply only to nodes created by the same specification, so the static "child"
      // node is created only for the `bis.PhysicalModel`, but not `bis.SpatialCategory`.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: [{ schemaName: "BisCore", classNames: ["SpatialCategory"] }],
                groupByClass: false,
              },
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: [{ schemaName: "BisCore", classNames: ["PhysicalModel"] }],
                groupByClass: false,
                nestedRules: [
                  {
                    ruleType: "ChildNodes",
                    specifications: [
                      {
                        specType: "CustomNode",
                        type: "T_CHILD",
                        label: "child",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Verify that PhysicalModel node has a child node
      const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(rootNodes)
        .to.have.lengthOf(2)
        .and.to.containSubset([
          {
            key: { instanceKeys: [{ className: "BisCore:SpatialCategory" }] },
            hasChildren: undefined,
          },
          {
            key: { instanceKeys: [{ className: "BisCore:PhysicalModel" }] },
            hasChildren: true,
          },
        ]);

      const modelChildren = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[1].key });
      expect(modelChildren)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            label: { displayValue: "child" },
          },
        ]);
    });
  });
});
