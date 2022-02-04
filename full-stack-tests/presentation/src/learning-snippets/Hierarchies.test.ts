/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import deepEqual from "deep-equal";
import { sort } from "fast-sort";
import { assert } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import {
  ChildNodeSpecificationTypes, GroupingSpecificationTypes, InstanceKey, NodeKey, QuerySpecificationTypes, RelationshipDirection, Ruleset, RuleTypes,
  SameLabelInstanceGroupApplicationStage, StandardNodeTypes,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";

describe("Learning Snippets", () => {

  describe("Hierarchies", () => {

    let imodel: IModelConnection;

    beforeEach(async () => {
      await initialize();
      imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    });

    afterEach(async () => {
      await imodel.close();
      await terminate();
    });

    describe("Rules", () => {

      it("uses `ParentNode` symbol in rule condition", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Condition.ParentNodeSymbol
        // This ruleset defines a tree with node "A" at the top and node "B" as child of "A".
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "A",
              label: "A",
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.Type = "A"`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "B",
              label: "B",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Expect A root node with a B child
        const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(rootNodes).to.containSubset([{
          label: { displayValue: "A" },
        }]);

        const childNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[0].key });
        expect(childNodes).to.containSubset([{
          label: { displayValue: "B" },
        }]);
      });

      it("uses ruleset variables in rule condition", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Condition.RulesetVariables.Ruleset
        // This ruleset defines two rules that can be enabled or disabled by setting variable DISPLAY_A_NODES and
        // DISPLAY_B_NODES values.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            condition: `GetVariableBoolValue("DISPLAY_A_NODES")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "A",
              label: "A",
            }],
          }, {
            ruleType: RuleTypes.RootNodes,
            condition: `GetVariableBoolValue("DISPLAY_B_NODES")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "B",
              label: "B",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // No variables set - no nodes
        let nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.be.empty;

        // Set DISPLAY_B_NODES to get node B
        await Presentation.presentation.vars(ruleset.id).setBool("DISPLAY_B_NODES", true);
        nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.have.lengthOf(1).and.to.containSubset([{
          label: { displayValue: "B" },
        }]);

        // Set DISPLAY_A_NODES to also get node A
        await Presentation.presentation.vars(ruleset.id).setBool("DISPLAY_A_NODES", true);
        nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.have.lengthOf(2).and.to.containSubset([{
          label: { displayValue: "A" },
        }, {
          label: { displayValue: "B" },
        }]);
      });

      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.RequiredSchemas.Ruleset
        // The ruleset has one root node rule that returns `bis.ExternalSourceAspect` instances. The
        // ECClass was introduced in BisCore version 1.0.2, so the rule needs a `requiredSchemas` attribute
        // to only use the rule if the version meets the requirement.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [{
                schemaName: "BisCore",
                classNames: ["ExternalSourceAspect"],
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // The iModel uses BisCore older than 1.0.2 - no nodes should be returned
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.be.empty;
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Priority.Ruleset
        // The ruleset has two root node rules that return nodes "A" and "B" respectively. The rules
        // have different priorities and higher priority rule is handled first - it's node appears first.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            priority: 1,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "A",
              label: "A",
            }],
          }, {
            ruleType: RuleTypes.RootNodes,
            priority: 2,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "B",
              label: "B",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify B comes before A
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.containSubset([{
          label: { displayValue: "B" },
        }, {
          label: { displayValue: "A" },
        }]);
      });

      it("uses `onlyIfNotHandled` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.OnlyIfNotHandled.Ruleset
        // The ruleset has two root node rules that return nodes "A" and "B" respectively. The "A" rule has
        // lower priority and `onlyIfNotHandled` attribute, which allows it to be overriden by higher priority rules.
        // The "B" rule does exactly that.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            priority: 1,
            onlyIfNotHandled: true,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "A",
              label: "A",
            }],
          }, {
            ruleType: RuleTypes.RootNodes,
            priority: 2,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "B",
              label: "B",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Expect only "B" node, as the rule for "A" is skipped due to `onlyIfNotHandled` attribute
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.have.lengthOf(1).and.to.containSubset([{
          label: { displayValue: "B" },
        }]);
      });

      it("uses `customizationRules` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.CustomizationRules.Ruleset
        // The ruleset has a global label override rule and two root node rules that return nodes "A" and "B"
        // respectively. The "B" rule has a label override of its own.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            // This label override applies to all nodes in the hierarchy
            ruleType: RuleTypes.LabelOverride,
            label: `"Global: " & ThisNode.Label`,
          }, {
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "A",
              label: "A",
            }],
          }, {
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "B",
              label: "B",
            }],
            customizationRules: [{
              // This label override applies only to nodes created at its scope and takes
              // precedence over the global rule
              ruleType: RuleTypes.LabelOverride,
              label: `"Nested: " & ThisNode.Label`,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Expect global label override to be applied on "A" and nested label override to be applied on "B"
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.have.lengthOf(2).and.to.containSubset([{
          label: { displayValue: "Global: A" },
        }, {
          label: { displayValue: "Nested: B" },
        }]);
      });

      it("uses `subConditions` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.SubConditions.Ruleset
        // The ruleset has a root node rule with a schemas requirement and 2 sub-conditions. The latter are only used if schemas
        // requirement is met. Each sub-condition can have additional conditions.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            // the schemas requirement gets applied to both sub-conditions
            requiredSchemas: [{ name: "BisCore", minVersion: "1.0.1" }],
            subConditions: [{
              condition: `TRUE`,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "A",
                label: "A",
              }],
            }, {
              condition: `FALSE`,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "B",
                label: "B",
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // The root node rule meets schema requirement, but only the first sub-condition's condition
        // attribute evaluates to `true` - expect only the "A" node.
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.have.lengthOf(1).and.to.containSubset([{
          label: { displayValue: "A" },
        }]);
      });

      it("uses `autoExpand` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.AutoExpand.Ruleset
        // The ruleset defines a root node "A" which should be automatically expanded. The flag is only
        // set if the node actually has children.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            autoExpand: true,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "A",
              label: "A",
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.Type = "A"`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "B",
              label: "B",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // The root node is expected to have `isExpanded = true`
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.have.lengthOf(1).and.to.containSubset([{
          label: { displayValue: "A" },
          isExpanded: true,
        }]);
      });

    });

    describe("Specifications", () => {

      it("uses `hideNodesInHierarchy` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.HideNodesInHierarchy.Ruleset
        // The ruleset contains a root node specification for `bis.PhysicalModel` nodes which are grouped by class and hidden. This
        // means class grouping nodes are displayed, but instance nodes are hidden and instead their children are displayed. The
        // children are determined by another rule.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["PhysicalModel"], arePolymorphic: true },
              hideNodesInHierarchy: true,
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "child",
              label: "Child",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify PhysicalModel's class grouping node is displayed, but the instance node - not
        const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(classGroupingNodes).to.have.lengthOf(1).and.to.containSubset([{
          label: { displayValue: "Physical Model" },
        }]);

        const customNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[0].key });
        expect(customNodes).to.have.lengthOf(1).and.to.containSubset([{
          label: { displayValue: "Child" },
        }]);
      });

      it("uses `hideIfNoChildren` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.HideIfNoChildren.Ruleset
        // The ruleset contains root node specifications for two custom nodes which are only
        // displayed if they have children. One of them has children and the other - not, so
        // only one of them is displayed
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "2d",
              label: "2d Elements",
              hideIfNoChildren: true,
            }, {
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "3d",
              label: "3d Elements",
              hideIfNoChildren: true,
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.Type = "2d"`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricElement2d"], arePolymorphic: true },
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.Type = "3d"`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricElement3d"], arePolymorphic: true },
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that only 3d elements' custom node is loaded
        const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(rootNodes).to.have.lengthOf(1).and.to.containSubset([{
          key: { type: "3d" },
          label: { displayValue: "3d Elements" },
          hasChildren: true,
        }]);

        const element3dNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[0].key });
        expect(element3dNodes).to.not.be.empty;
      });

      it("uses `hideExpression` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.HideExpression.Ruleset
        // The ruleset contains root node specifications for two custom nodes which are only
        // displayed if they have children. One of them has children and the other - not, so
        // only one of them is displayed
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "2d",
              label: "2d Elements",
              hideExpression: `ThisNode.HasChildren = FALSE`,
            }, {
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "3d",
              label: "3d Elements",
              hideExpression: `ThisNode.HasChildren = FALSE`,
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.Type = "2d"`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricElement2d"], arePolymorphic: true },
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.Type = "3d"`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricElement3d"], arePolymorphic: true },
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that only 3d elements' custom node is loaded
        const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(rootNodes).to.have.lengthOf(1).and.to.containSubset([{
          key: { type: "3d" },
          label: { displayValue: "3d Elements" },
          hasChildren: true,
        }]);

        const element3dNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[0].key });
        expect(element3dNodes).to.not.be.empty;
      });

      it("uses `suppressSimilarAncestorsCheck` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.SuppressSimilarAncestorsCheck.Ruleset
        // The ruleset contains a root node specification that returns the root `bis.Subject` node. Also, there are two
        // child node rules:
        // - For any `bis.Model` node, return its contained `bis.Element` nodes.
        // - For any `bis.Element` node, return its children `bis.Model` nodes.
        // Children of the root `bis.Subject` are all in the single `bis.RepositoryModel` and some of their children are in the same
        // `bis.RepositoryModel` as their parent. This means the `bis.RepositoryModel` node has to be repeated in the hierarchy, but
        // that wouldn't happen due to duplicate nodes prevention, unless the `suppressSimilarAncestorsCheck` flag is set.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["Subject"] },
              instanceFilter: `this.ECInstanceId = 1`,
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.IsOfClass("Model", "BisCore")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
              relationshipPaths: [{
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Forward,
              }],
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.IsOfClass("Element", "BisCore")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
              relationshipPaths: [[{
                relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                direction: RelationshipDirection.Forward,
              }, {
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Backward,
              }]],
              suppressSimilarAncestorsCheck: true,
              groupByClass: false,
              groupByLabel: false,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that RepositoryModel is repeated in the hierarchy
        const rootSubjectNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(rootSubjectNodes).to.have.lengthOf(1).and.to.containSubset([{
          key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ className: "BisCore:Subject", id: "0x1" }] },
          label: { displayValue: "DgnV8Bridge" },
        }]);

        const rootSubjectChildNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootSubjectNodes[0].key });
        expect(rootSubjectChildNodes).to.have.lengthOf(1).and.to.containSubset([{
          key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ className: "BisCore:RepositoryModel", id: "0x1" }] },
        }]);

        const repositoryModelChildNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootSubjectChildNodes[0].key });
        expect(repositoryModelChildNodes).to.have.lengthOf(11).and.to.containSubset([{
          label: { displayValue: "DgnV8Bridge" },
        }, {
          label: { displayValue: "BisCore.RealityDataSources" },
        }, {
          label: { displayValue: "BisCore.DictionaryModel" },
        }, {
          label: { displayValue: "Properties_60InstancesWithUrl2.dgn" },
        }, {
          label: { displayValue: "DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default" },
        }, {
          label: { displayValue: "Converted Groups" },
        }, {
          label: { displayValue: "Converted Drawings" },
        }, {
          label: { displayValue: "Converted Sheets" },
        }, {
          label: { displayValue: "Definition Model For DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default" },
        }, {
          label: { displayValue: "Properties_60InstancesWithUrl2" },
        }, {
          label: { displayValue: "Properties_60InstancesWithUrl2" },
        }]);

        const repositoryModelNodes2 = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: repositoryModelChildNodes.find((n) => n.label.displayValue === "DgnV8Bridge")!.key });
        expect(repositoryModelNodes2).to.have.lengthOf(1).and.to.containSubset([{
          key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ className: "BisCore:RepositoryModel", id: "0x1" }] },
        }]);
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.Priority.Ruleset
        // This ruleset produces a list of `bis.PhysicalModel` and `bis.SpatialCategory` instances and groups them by
        // class. "Spatial Category" group will appear first because it has been given a higher priority value.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              priority: 1,
              classes: { schemaName: "BisCore", classNames: ["PhysicalModel"], arePolymorphic: true },
            }, {
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              priority: 2,
              classes: { schemaName: "BisCore", classNames: ["SpatialCategory"], arePolymorphic: true },
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that SpatialCategory comes before PhysicalModel
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.have.lengthOf(2).and.to.containSubset([{
          label: { displayValue: "Spatial Category" },
        }, {
          label: { displayValue: "Physical Model" },
        }]);
      });

      it("uses `doNotSort` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.DoNotSort.Ruleset
        // The ruleset has a specification that returns unsorted `bis.Model` nodes - the order is undefined.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [{ schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true }],
              doNotSort: true,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that nodes were returned unsorted
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        const sorted = [...nodes].sort((lhs, rhs) => lhs.label.displayValue.localeCompare(rhs.label.displayValue));
        expect(nodes).to.not.deep.eq(sorted);
      });

      it("uses `groupByClass` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.GroupByClass.Ruleset
        // The ruleset contains a specification that returns `bis.Model` nodes without grouping them
        // by class.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [{ schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true }],
              groupByClass: false,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that Models were not grouped by class
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.not.be.empty;
        nodes.forEach((node) => expect(NodeKey.isClassGroupingNodeKey(node.key)).to.be.false);
      });

      it("uses `groupByLabel` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.GroupByLabel.Ruleset
        // The ruleset contains a specification that returns `meta.ECPropertyDef` nodes without grouping them
        // by label.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [{ schemaName: "ECDbMeta", classNames: ["ECPropertyDef"] }],
              groupByLabel: false,
            }],
          }],
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
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.HasChildren.Ruleset
        // This ruleset produces a hierarchy of a single root node that hosts a list of `Model` instances. Assuming all
        // iModels contain at least one model, the result of this ruleset can be computed quicker by setting
        // `hasChildren` attribute to `"Always"`.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "T_ROOT_NODE",
              label: "My Root Node",
              hasChildren: "Always",
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.Type="T_ROOT_NODE"`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [{ schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that the custom node has `hasChildren` flag and children
        const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(rootNodes).to.have.lengthOf(1).and.to.containSubset([{
          key: { type: "T_ROOT_NODE" },
          hasChildren: true,
        }]);

        const modelClassGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[0].key });
        expect(modelClassGroupingNodes).to.have.lengthOf(7).and.to.containSubset([{
          key: { type: StandardNodeTypes.ECClassGroupingNode },
          label: { displayValue: "Definition Model" },
        }, {
          key: { type: StandardNodeTypes.ECClassGroupingNode },
          label: { displayValue: "Dictionary Model" },
        }, {
          key: { type: StandardNodeTypes.ECClassGroupingNode },
          label: { displayValue: "Document List" },
        }, {
          key: { type: StandardNodeTypes.ECClassGroupingNode },
          label: { displayValue: "Group Model" },
        }, {
          key: { type: StandardNodeTypes.ECClassGroupingNode },
          label: { displayValue: "Link Model" },
        }, {
          key: { type: StandardNodeTypes.ECClassGroupingNode },
          label: { displayValue: "Physical Model" },
        }, {
          key: { type: StandardNodeTypes.ECClassGroupingNode },
          label: { displayValue: "Repository Model" },
        }]);
      });

      it("uses `relatedInstances` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.RelatedInstances.Ruleset
        // The ruleset contains a root nodes' specification that returns nodes for `bis.Elements` that are in
        // a category containing "a" in either `UserLabel` or `CodeValue` property.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [{ schemaName: "BisCore", classNames: ["GeometricElement3d"], arePolymorphic: true }],
              relatedInstances: [{
                relationshipPath: [{
                  relationship: { schemaName: "BisCore", className: "GeometricElement3dIsInCategory" },
                  direction: RelationshipDirection.Forward,
                }],
                alias: "category",
                isRequired: true,
              }],
              instanceFilter: `category.UserLabel ~ "%a%" OR category.CodeValue ~ "%a%"`,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that Elements whose Category contains "a" in either UserLabel or CodeValue are returned
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.have.lengthOf(2).and.to.containSubset([{
          key: { type: StandardNodeTypes.ECClassGroupingNode, className: "Generic:PhysicalObject" },
        }, {
          key: { type: StandardNodeTypes.ECClassGroupingNode, className: "PCJ_TestSchema:TestClass" },
        }]);
      });

      it("uses `nestedRules` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.NestedRules.Ruleset
        // The ruleset contains two root nodes' specifications:
        // - The first one returns `bis.SpatialCategory` nodes
        // - The second one returns `bis.PhysicalModel` nodes and also has a nested child node rule
        //   that creates a static "child" node.
        // Nested rules apply only to nodes created by the same specification, so the static "child"
        // node is created only for the `bis.PhysicalModel`, but not `bis.SpatialCategory`.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [{ schemaName: "BisCore", classNames: ["SpatialCategory"] }],
              groupByClass: false,
            }, {
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [{ schemaName: "BisCore", classNames: ["PhysicalModel"] }],
              groupByClass: false,
              nestedRules: [{
                ruleType: RuleTypes.ChildNodes,
                specifications: [{
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "T_CHILD",
                  label: "child",
                }],
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Verify that PhysicalModel node has a child node
        const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(rootNodes).to.have.lengthOf(2).and.to.containSubset([{
          key: { instanceKeys: [{ className: "BisCore:SpatialCategory" }] },
          hasChildren: undefined,
        }, {
          key: { instanceKeys: [{ className: "BisCore:PhysicalModel" }] },
          hasChildren: true,
        }]);

        const modelChildren = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[1].key });
        expect(modelChildren).to.have.lengthOf(1).and.to.containSubset([{
          label: { displayValue: "child" },
        }]);
      });

      describe("InstanceNodesOfSpecificClassesSpecification", () => {

        it("uses `classes` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.InstanceNodesOfSpecificClassesSpecification.Classes.Ruleset
          // The ruleset has a specification that returns nodes for instances of `bis.PhysicalModel` class and all
          // its subclasses.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "BisCore", classNames: ["PhysicalModel"], arePolymorphic: true },
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Verify that PhysicalModel nodes were returned, grouped by class
          const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(classGroupingNodes).to.have.lengthOf(1).and.to.containSubset([{
            label: { displayValue: "Physical Model" },
          }]);

          const instanceNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[0].key });
          expect(instanceNodes).to.have.lengthOf(1).and.to.containSubset([{
            label: { displayValue: "Properties_60InstancesWithUrl2" },
          }]);
        });

        it("uses `excludedClasses` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.InstanceNodesOfSpecificClassesSpecification.ExcludedClasses.Ruleset
          // The ruleset has a specification that returns nodes for all instances of `bis.Model` class
          // excluding instances of `bis.DefinitionModel`, `bis.GroupInformationModel` and their subclasses.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true },
                excludedClasses: { schemaName: "BisCore", classNames: ["DefinitionModel", "GroupInformationModel"], arePolymorphic: true },
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Verify that DefinitionModel and GroupInformationModel nodes are not included
          const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(classGroupingNodes).to.have.lengthOf(3).and.to.containSubset([{
            label: { displayValue: "Document List" },
          }, {
            label: { displayValue: "Link Model" },
          }, {
            label: { displayValue: "Physical Model" },
          }]);
        });

        it("uses `instanceFilter` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.InstanceNodesOfSpecificClassesSpecification.InstanceFilter.Ruleset
          // The ruleset has a specification that returns nodes for `bis.ViewDefinition` instances whose
          // `CodeValue` property value ends with "View 1".
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
                instanceFilter: `this.CodeValue ~ "%View 1"`,
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Verify that ViewDefinition nodes ending with "View 1" are not included
          const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(classGroupingNodes).to.have.lengthOf(1).and.to.containSubset([{
            label: { displayValue: "Spatial View Definition" },
          }]);

          const instanceNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[0].key });
          expect(instanceNodes).to.have.lengthOf(1).and.to.containSubset([{
            label: { displayValue: "Default - View 1" },
          }]);
        });

      });

      describe("RelatedInstanceNodesSpecification", () => {

        it("uses `relationshipPaths` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.RelatedInstanceNodesSpecification.RelationshipPaths.Ruleset
          // The ruleset has a specification that returns `bis.PhysicalModel` root nodes. The child node specification
          // returns `bis.GeometricElement3d` instance nodes that are related to their model through `bis.ModelContainsElements`
          // relationship by following it in forward direction (from `bis.Model` to `bis.Element`).
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "BisCore", classNames: ["PhysicalModel"] },
                groupByClass: false,
              }],
            }, {
              ruleType: RuleTypes.ChildNodes,
              condition: `ParentNode.IsOfClass("Model", "BisCore")`,
              specifications: [{
                specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
                relationshipPaths: [{
                  relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                  direction: RelationshipDirection.Forward,
                  targetClass: { schemaName: "BisCore", className: "GeometricElement3d" },
                }],
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Verify that correct Model Elements are returned, grouped by class
          const modelNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(modelNodes).to.have.lengthOf(1).and.to.containSubset([{
            key: { instanceKeys: [{ className: "BisCore:PhysicalModel" }] },
          }]);

          const elementClassGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: modelNodes[0].key });
          expect(elementClassGroupingNodes).to.have.lengthOf(2).and.to.containSubset([{
            label: { displayValue: "Physical Object" },
          }, {
            label: { displayValue: "TestClass" },
          }]);

          const elementNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: elementClassGroupingNodes[0].key });
          expect(elementNodes).to.have.lengthOf(2).and.to.containSubset([{
            key: { instanceKeys: [{ className: "Generic:PhysicalObject" }] },
          }, {
            key: { instanceKeys: [{ className: "Generic:PhysicalObject" }] },
          }]);
        });

      });

      describe("CustomNodeSpecification", () => {

        it("uses `type` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.CustomNodeSpecification.Type.Ruleset
          // The ruleset has a root node specification that returns a single custom node with specified parameters. There's
          // also a child node rule that assigns the child based on root node's type.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_ROOT_NODE",
                label: "My Root Node",
              }],
            }, {
              ruleType: RuleTypes.ChildNodes,
              condition: `ParentNode.Type = "T_ROOT_NODE"`,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_CHILD_NODE",
                label: "My Child Node",
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Verify that node with correct type is returned
          const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(rootNodes).to.have.lengthOf(1).and.to.containSubset([{
            key: { type: "T_ROOT_NODE" },
          }]);
          const childNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[0].key });
          expect(childNodes).to.have.lengthOf(1).and.to.containSubset([{
            key: { type: "T_CHILD_NODE" },
          }]);
        });

        it("uses `label` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.CustomNodeSpecification.Label.Ruleset
          // The ruleset has a root node specification that returns a single custom node with specified parameters.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_MY_NODE",
                label: "My Node",
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Verify that node with correct label is returned
          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes).to.have.lengthOf(1).and.to.containSubset([{
            label: { displayValue: "My Node" },
          }]);
        });

        it("uses `description` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.CustomNodeSpecification.Description.Ruleset
          // The ruleset has a root node specification that returns a single custom node and assigns it a description.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_MY_NODE",
                label: "My Node",
                description: "My node's description",
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Verify that node with correct description is returned
          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes).to.have.lengthOf(1).and.to.containSubset([{
            description: "My node's description",
          }]);
        });

        it("uses `imageId` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.CustomNodeSpecification.ImageId.Ruleset
          // The ruleset has a root node specification that returns a single custom node and assigns it an image identifier.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_MY_NODE",
                label: "My Node",
                imageId: "my-icon-identifier",
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // __PUBLISH_EXTRACT_START__ Hierarchies.CustomNodeSpecification.ImageId.Result
          // Verify that node with correct image identifier is returned
          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes).to.have.lengthOf(1).and.to.containSubset([{
            imageId: "my-icon-identifier",
          }]);
          // __PUBLISH_EXTRACT_END__
        });

        it("uses `hideNodesInHierarchy` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.CustomNodeSpecification.HideNodesInHierarchy.Ruleset
          // This ruleset produces a hierarchy that consists of two custom nodes. The parent node is hidden by
          // `hideNodesInHierarchy` attribute, thus its child appears one hierarchy level higher.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "parent",
                label: "Parent",
                hideNodesInHierarchy: true,
              }],
            }, {
              ruleType: RuleTypes.ChildNodes,
              condition: `ParentNode.Type = "parent"`,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "child",
                label: "Child",
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Verify the Parent node is not displayed
          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes).to.have.lengthOf(1).and.to.containSubset([{
            key: { type: "child" },
            label: { displayValue: "Child" },
          }]);
        });

      });

      describe("CustomQueryInstanceNodesSpecification", () => {

        it("uses `queries` attribute with StringQuerySpecification", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.CustomQueryInstanceNodesSpecification.StringQuerySpecification.Ruleset
          // The ruleset has a root nodes' specification that uses a given query to get all `bis.Model` instances.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomQueryInstanceNodes,
                queries: [{
                  specType: QuerySpecificationTypes.String,
                  class: { schemaName: "BisCore", className: "Model" },
                  query: `SELECT * FROM bis.Model`,
                }],
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Verify that Model nodes are returned
          const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(classGroupingNodes).to.have.lengthOf(7).and.to.containSubset([{
            label: { displayValue: "Definition Model" },
          }, {
            label: { displayValue: "Dictionary Model" },
          }, {
            label: { displayValue: "Document List" },
          }, {
            label: { displayValue: "Group Model" },
          }, {
            label: { displayValue: "Link Model" },
          }, {
            label: { displayValue: "Physical Model" },
          }, {
            label: { displayValue: "Repository Model" },
          }]);

          const modelNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[5].key });
          expect(modelNodes).to.have.lengthOf(1).and.to.containSubset([{
            label: { displayValue: "Properties_60InstancesWithUrl2" },
          }]);
        });

        it("uses `queries` attribute with ECPropertyValueQuerySpecification", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.CustomQueryInstanceNodesSpecification.ECPropertyValueQuerySpecification.Ruleset
          // The ruleset has a root nodes' specification that returns `MyDomain.MyParentElement` nodes. It also has
          // a children specification that returns `MyDomain.MyChildElement` children for `MyDomain.MyParentElement`
          // parent nodes using `ChildrenQuery` property value of the parent element.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "MyDomain", classNames: ["MyParentElement"], arePolymorphic: true },
                groupByClass: false,
              }],
            }, {
              ruleType: RuleTypes.ChildNodes,
              condition: `ParentNode.IsOfClass("MyParentElement", "MyDomain")`,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomQueryInstanceNodes,
                queries: [{
                  specType: QuerySpecificationTypes.ECPropertyValue,
                  class: { schemaName: "MyDomain", className: "MyChildElement" },
                  parentPropertyName: "ChildrenQuery",
                }],
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // our test iModel doesn't have any elements with ECSQL queries as their property values, so
          // we can't construct any ruleset that would actually return nodes for this test case
          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes).to.be.empty;
        });

      });

    });

    describe("Grouping", () => {

      it("uses `condition` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Grouping.Condition.Ruleset
        // There's a hierarchy of `bis.Model` instances and their elements. In addition, there's a grouping rule for `bis.Element`
        // that only takes effect if element's model has `IsPrivate` flag set to `true`.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true },
              groupByClass: false,
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.IsOfClass("Model", "BisCore")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
              relationshipPaths: [{
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Forward,
              }],
              groupByClass: false,
              groupByLabel: false,
            }],
            customizationRules: [{
              ruleType: RuleTypes.Grouping,
              class: { schemaName: "BisCore", className: "Element" },
              condition: `ParentNode.ECInstance.IsPrivate`,
              groups: [{
                specType: GroupingSpecificationTypes.Property,
                propertyName: "CodeValue",
                createGroupForSingleItem: true,
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Confirm that only private models have children grouped by property
        const modelNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(modelNodes).to.have.lengthOf(8).and.containSubset([{
          label: { displayValue: "BisCore.DictionaryModel" },
        }, {
          label: { displayValue: "BisCore.RealityDataSources" },
        }, {
          label: { displayValue: "Converted Drawings" },
        }, {
          label: { displayValue: "Converted Groups" },
        }, {
          label: { displayValue: "Converted Sheets" },
        }, {
          label: { displayValue: "Definition Model For DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default" },
        }, {
          label: { displayValue: "Properties_60InstancesWithUrl2" },
        }, {
          // Note: Due to bug #776790 the label of RepositoryModel is not calculated correctly and it gets the
          // localized "Not Specified" label. Confirm that's the expected model using its id.
          key: { instanceKeys: [{ id: "0x1" }] },
        }]);

        const privateModels = ["BisCore.DictionaryModel", "BisCore.RealityDataSources"];
        await Promise.all(modelNodes.map(async (modelNode) => {
          if (!modelNode.hasChildren)
            return;

          const expectedChildrenType = privateModels.includes(modelNode.label.displayValue) ? StandardNodeTypes.ECPropertyGroupingNode : StandardNodeTypes.ECInstancesNode;
          const childNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: modelNode.key });
          childNodes.forEach((childNode) => {
            expect(childNode.key.type).to.eq(expectedChildrenType, `Unexpected child node type for model "${modelNode.label.displayValue}".`);
          });
        }));
      });

      it("uses `createGroupForSingleItem` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Grouping.Specification.CreateGroupForSingleItem.Ruleset
        // There's a root nodes rule that returns nodes for all `bis.Element` instances and there's a grouping rule
        // that groups those elements by `CodeValue` property. The grouping rule has the `createGroupForSingleItem`
        // flag, so property grouping nodes are created even if they group only a single element.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
              groupByClass: false,
            }],
            customizationRules: [{
              ruleType: RuleTypes.Grouping,
              class: { schemaName: "BisCore", className: "Element" },
              groups: [{
                specType: GroupingSpecificationTypes.Property,
                propertyName: "CodeValue",
                createGroupForSingleItem: true,
              }],
            }],
          }],
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

      describe("ClassGroup", () => {

        it("uses `baseClass` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.Grouping.ClassGroup.BaseClass.Ruleset
          // The ruleset contains a root nodes rule for `bis.Element` instances and a grouping rule that puts
          // all `bis.PhysicalElement` instances into a class group.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
                groupByClass: false,
                groupByLabel: false,
              }],
              customizationRules: [{
                ruleType: RuleTypes.Grouping,
                class: { schemaName: "BisCore", className: "Element" },
                groups: [{
                  specType: GroupingSpecificationTypes.Class,
                  baseClass: { schemaName: "BisCore", className: "PhysicalElement" },
                }],
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Confirm there's a class grouping node for PhysicalElement
          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes).to.have.lengthOf(43).and.to.containSubset([{
            key: {
              type: StandardNodeTypes.ECClassGroupingNode,
              className: "BisCore:PhysicalElement",
              groupedInstancesCount: 62,
            },
          }]);
        });

      });

      describe("PropertyGroup", () => {

        it("uses `createGroupForUnspecifiedValues` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.Grouping.PropertyGroup.CreateGroupForUnspecifiedValues.Ruleset
          // The ruleset contains a root nodes rule for `bis.Element` instances and a grouping rule that groups them
          // by `UserLabel` property. By default all nodes whose instance doesn't have a value for the property would
          // be placed under a "Not Specified" grouping node, but the grouping rule has this behavior disabled through
          // the `createGroupForUnspecifiedValues` attribute.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
                groupByClass: false,
              }],
              customizationRules: [{
                ruleType: RuleTypes.Grouping,
                class: { schemaName: "BisCore", className: "Element" },
                groups: [{
                  specType: GroupingSpecificationTypes.Property,
                  propertyName: "UserLabel",
                  createGroupForUnspecifiedValues: false,
                }],
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Confirm there's no "Not Specified" node
          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes).to.not.containSubset([{
            key: {
              type: StandardNodeTypes.ECPropertyGroupingNode,
              propertyName: "UserLabel",
              groupingValues: [null],
            },
          }]);
        });

        it("uses `imageId` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.Grouping.PropertyGroup.ImageId.Ruleset
          // The ruleset contains a root nodes rule for `bis.Element` instances and a grouping rule that groups them
          // by `UserLabel` property. The grouping rule also sets an image identifier for all grouping nodes.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
                groupByClass: false,
              }],
              customizationRules: [{
                ruleType: RuleTypes.Grouping,
                class: { schemaName: "BisCore", className: "Element" },
                groups: [{
                  specType: GroupingSpecificationTypes.Property,
                  propertyName: "UserLabel",
                  imageId: "my-icon-identifier",
                  createGroupForSingleItem: true,
                }],
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // __PUBLISH_EXTRACT_START__ Hierarchies.Grouping.PropertyGroup.ImageId.Result
          // Confirm that all grouping nodes got the `imageId`
          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes).to.not.be.empty;
          nodes.forEach((node) => {
            expect(node).to.containSubset({
              key: {
                type: StandardNodeTypes.ECPropertyGroupingNode,
                propertyName: "UserLabel",
              },
              imageId: "my-icon-identifier",
            });
          });
          // __PUBLISH_EXTRACT_END__
        });

        it("uses `ranges` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.Grouping.PropertyGroup.Ranges.Ruleset
          // The ruleset contains a root nodes rule for `bis.GeometricElement3d` and a grouping rule that groups them
          // by `Yaw` property into 3 ranges: "Negative", "Positive" and "Zero".
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "BisCore", classNames: ["GeometricElement3d"], arePolymorphic: true },
                groupByClass: false,
              }],
              customizationRules: [{
                ruleType: RuleTypes.Grouping,
                class: { schemaName: "BisCore", className: "GeometricElement3d" },
                groups: [{
                  specType: GroupingSpecificationTypes.Property,
                  propertyName: "Yaw",
                  ranges: [{
                    fromValue: "0",
                    toValue: "0",
                    label: "Zero",
                  }, {
                    fromValue: "-360",
                    toValue: "0",
                    label: "Negative",
                  }, {
                    fromValue: "0",
                    toValue: "360",
                    label: "Positive",
                  }],
                }],
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Confirm that elements were correctly grouped into ranges
          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes).to.have.lengthOf(2).and.to.containSubset([{
            key: { type: StandardNodeTypes.ECPropertyGroupingNode, propertyName: "Yaw", groupedInstancesCount: 2 },
            label: { displayValue: "Negative" },
          }, {
            key: { type: StandardNodeTypes.ECPropertyGroupingNode, propertyName: "Yaw", groupedInstancesCount: 60 },
            label: { displayValue: "Zero" },
          }]);
        });

      });

      describe("SameLabelInstanceGroup", () => {

        it("uses `applicationStage = Query` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.Grouping.SameLabelInstanceGroup.ApplicationStage.Query.Ruleset
          // The ruleset contains a root nodes rule for `bis.SubCategory` instances. The grouping rule
          // tells the rules engine to group them by label by creating a single ECInstances node for grouped instances.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "BisCore", classNames: ["SubCategory"] },
                groupByClass: false,
              }],
              customizationRules: [{
                ruleType: RuleTypes.Grouping,
                class: { schemaName: "BisCore", className: "SubCategory" },
                groups: [{
                  specType: GroupingSpecificationTypes.SameLabelInstance,
                  applicationStage: SameLabelInstanceGroupApplicationStage.Query,
                }],
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Confirm that at least some nodes are merged from multiple elements
          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes).to.satisfy(() => nodes.length > 0 && nodes.some((node) => {
            return NodeKey.isInstancesNodeKey(node.key)
              // confirm the node is merged from more than 1 instance
              && node.key.instanceKeys.length > 1
              // confirm all instances are of SubCategory class
              && node.key.instanceKeys.every((key) => key.className === "BisCore:SubCategory");
          }));
        });

        it("uses `applicationStage = PostProcess` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.Grouping.SameLabelInstanceGroup.ApplicationStage.PostProcess.Ruleset
          // The ruleset contains a root nodes rule for `bis.InformationPartitionElement` and `bis.Model` instances. The grouping rules
          // tells the rules engine to group them by label. `bis.InformationPartitionElement` and `bis.Model` classes have no common base class,
          // so two different grouping rules are required to define this kind of grouping and that also means that `Query` type
          // of grouping is not possible - grouping at `PostProcessing` step is required.
          const ruleset: Ruleset = {
            id: "example",
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: {
                  schemaName: "BisCore",
                  classNames: ["InformationPartitionElement", "Model"],
                  arePolymorphic: true,
                },
                groupByClass: false,
                groupByLabel: false,
              }],
              customizationRules: [{
                ruleType: RuleTypes.Grouping,
                class: { schemaName: "BisCore", className: "InformationPartitionElement" },
                groups: [{
                  specType: GroupingSpecificationTypes.SameLabelInstance,
                  applicationStage: SameLabelInstanceGroupApplicationStage.PostProcess,
                }],
              }, {
                ruleType: RuleTypes.Grouping,
                class: { schemaName: "BisCore", className: "Model" },
                groups: [{
                  specType: GroupingSpecificationTypes.SameLabelInstance,
                  applicationStage: SameLabelInstanceGroupApplicationStage.PostProcess,
                }],
              }],
            }],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Confirm that at least some nodes are merged from multiple elements
          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes).to.have.lengthOf(8).and.to.containSubset([{
            key: { instanceKeys: (actual: InstanceKey[]) => deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:DefinitionPartition", "BisCore:DictionaryModel"]) },
            label: { displayValue: "BisCore.DictionaryModel" },
          }, {
            key: { instanceKeys: (actual: InstanceKey[]) => deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:LinkModel", "BisCore:LinkPartition"]) },
            label: { displayValue: "BisCore.RealityDataSources" },
          }, {
            key: { instanceKeys: (actual: InstanceKey[]) => deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:DocumentListModel", "BisCore:DocumentPartition"]) },
            label: { displayValue: "Converted Drawings" },
          }, {
            key: { instanceKeys: (actual: InstanceKey[]) => deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:GroupInformationPartition", "Generic:GroupModel"]) },
            label: { displayValue: "Converted Groups" },
          }, {
            key: { instanceKeys: (actual: InstanceKey[]) => deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:DocumentListModel", "BisCore:DocumentPartition"]) },
            label: { displayValue: "Converted Sheets" },
          }, {
            key: { instanceKeys: (actual: InstanceKey[]) => deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:DefinitionModel", "BisCore:DefinitionPartition"]) },
            label: { displayValue: "Definition Model For DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default" },
          }, {
            key: { instanceKeys: (actual: InstanceKey[]) => deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:PhysicalModel", "BisCore:PhysicalPartition"]) },
            label: { displayValue: "Properties_60InstancesWithUrl2" },
          }, {
            key: { instanceKeys: (actual: InstanceKey[]) => deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:RepositoryModel"]) },
          }]);
        });

      });

    });

    describe("Node Artifacts", () => {

      it("uses `condition` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.NodeArtifacts.Condition.Ruleset
        // The ruleset has a root nodes rule that returns `bis.Model` nodes only if their child node
        // artifacts contain an artifact "IsSpecialChild". There's also a child nodes rule that produces
        // hidden child nodes for `bis.Model` and `bis.GeometricElement3d` nodes have the "IsSpecialChild" artifact value
        // set to `true`. This means only `bis.GeometricModel3d` nodes should be displayed as root nodes (no other
        // type of `bis.Model` should have `bis.GeometricElement3d` elements).
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [{ schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true }],
              hideExpression: `NOT ThisNode.ChildrenArtifacts.AnyMatches(x => x.IsSpecialChild)`,
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.IsOfClass("Model", "BisCore")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
              relationshipPaths: [{
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Forward,
              }],
              hideNodesInHierarchy: true,
              groupByClass: false,
              groupByLabel: false,
            }],
            customizationRules: [{
              ruleType: RuleTypes.NodeArtifacts,
              condition: `ThisNode.IsOfClass("GeometricElement3d", "BisCore")`,
              items: {
                ["IsSpecialChild"]: `TRUE`,
              },
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Hierarchies.NodeArtifacts.Condition.Result
        // Confirm we get only the GeometricModel3d
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.have.lengthOf(1).and.containSubset([{
          key: { instanceKeys: [{ className: "BisCore:PhysicalModel" }] },
          hasChildren: undefined,
        }]);
        // __PUBLISH_EXTRACT_END__
      });

      it("uses `items` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.NodeArtifacts.Items.Ruleset
        // The ruleset has a root nodes rule that returns `bis.Model` nodes only if their child node
        // artifacts contain an artifact "IsSpecialChild". There's also a child nodes rule that produces
        // hidden child nodes for `bis.Model` and the nodes have a calculated "IsSpecialChild" artifact value
        // that only evaluates to `true` for `bis.GeometricElement3d` elements. This means only `bis.GeometricModel3d`
        // models should be displayed as root nodes (no other type of `bis.Model` should have `bis.GeometricElement3d`
        // elements).
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [{ schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true }],
              hideExpression: `NOT ThisNode.ChildrenArtifacts.AnyMatches(x => x.IsSpecialChild)`,
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.IsOfClass("Model", "BisCore")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
              relationshipPaths: [{
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Forward,
              }],
              hideNodesInHierarchy: true,
              groupByClass: false,
              groupByLabel: false,
            }],
            customizationRules: [{
              ruleType: RuleTypes.NodeArtifacts,
              items: {
                ["IsSpecialChild"]: `this.IsOfClass("GeometricElement3d", "BisCore")`,
              },
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Hierarchies.NodeArtifacts.Items.Result
        // Confirm we get only the GeometricModel3d
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.have.lengthOf(1).and.containSubset([{
          key: { instanceKeys: [{ className: "BisCore:PhysicalModel" }] },
          hasChildren: undefined,
        }]);
        // __PUBLISH_EXTRACT_END__
      });

    });

  });

});

function printRuleset(ruleset: Ruleset) {
  if (process.env.PRINT_RULESETS) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(ruleset, undefined, 2));
  }
}
