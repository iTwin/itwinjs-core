/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { assert } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, NodeKey, RelationshipDirection, Ruleset, RuleTypes, StandardNodeTypes } from "@itwin/presentation-common";
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
        expect(nodes.length).to.eq(1);
        expect(nodes).to.containSubset([{
          label: { displayValue: "B" },
        }]);

        // Set DISPLAY_A_NODES to also get node A
        await Presentation.presentation.vars(ruleset.id).setBool("DISPLAY_A_NODES", true);
        nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes.length).to.eq(2);
        expect(nodes).to.containSubset([{
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
        expect(nodes.length).to.eq(1);
        expect(nodes).to.containSubset([{
          label: { displayValue: "B" },
        }]);
      });

      it("uses `customizationRules` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.CustomizationRules.Ruleset
        // The ruleset has a global label override rule and two root node rules that return nodes "A" and "B"
        // respectively.The "B" rule has a label override of its own.
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
        expect(nodes.length).to.eq(2);
        expect(nodes).to.containSubset([{
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
        expect(nodes.length).to.eq(1);
        expect(nodes).to.containSubset([{
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
        expect(nodes.length).to.eq(1);
        expect(nodes).to.containSubset([{
          label: { displayValue: "A" },
          isExpanded: true,
        }]);
      });

    });

    describe("Specifications", () => {

      it("uses `hideNodesInHierarchy` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.HideNodesInHierarchy.Ruleset
        // The ruleset contains a root node specification for "PhysicalModel" nodes which are grouped by class and hidden. This
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

        const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(classGroupingNodes.length).to.eq(1);
        expect(classGroupingNodes).to.containSubset([{
          label: { displayValue: "Physical Model" },
        }]);

        const customNode = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[0].key });
        expect(customNode.length).to.eq(1);
        expect(customNode).to.containSubset([{
          label: { displayValue: "Child" },
        }]);
      });

      it("uses `hideIfNoChildren` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.HideIfNoChildren.Ruleset
        // The ruleset contains a root node specification for "Model" nodes which are grouped by class and only
        // displayed if they have children. The child nodes rule is created only for "PhysicalModel" nodes, so only
        // that type of models are displayed at the root level.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true },
              hideIfNoChildren: true,
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.IsOfClass("PhysicalModel", "BisCore")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "child",
              label: "Child",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(classGroupingNodes.length).to.eq(1);
        expect(classGroupingNodes).to.containSubset([{
          label: { displayValue: "Physical Model" },
        }]);

        const modelNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[0].key });
        expect(modelNodes.length).to.eq(1);
        expect(modelNodes).to.containSubset([{
          label: { displayValue: "Properties_60InstancesWithUrl2" },
        }]);

        const customNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: modelNodes[0].key });
        expect(customNodes.length).to.eq(1);
        expect(customNodes).to.containSubset([{
          label: { displayValue: "Child" },
        }]);
      });

      it("uses `hideExpression` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.HideExpression.Ruleset
        // The ruleset contains a root node specification for "GroupInformationModel" and "PhysicalModel" nodes which
        // are grouped by class and hidden if there's a children artifact "isTestNode". The artifact is created only
        // for "GroupInformationModel" node by its custom child node. This means only "PhysicalModel" nodes
        // are displayed at the root level.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GroupInformationModel", "PhysicalModel"] },
              hideExpression: `ThisNode.ChildrenArtifacts.AnyMatches(x => x.isTestNode)`,
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.IsOfClass("GroupInformationModel", "BisCore")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "test",
              label: "Test Node",
            }],
            customizationRules: [{
              ruleType: RuleTypes.NodeArtifacts,
              items: {
                isTestNode: `TRUE`,
              },
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(classGroupingNodes.length).to.eq(1);
        expect(classGroupingNodes).to.containSubset([{
          key: { type: StandardNodeTypes.ECClassGroupingNode },
          label: { displayValue: "Physical Model" },
        }]);
      });

      it("uses `suppressSimilarAncestorsCheck` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.SuppressSimilarAncestorsCheck.Ruleset
        // The ruleset contains a root node specification that returns the root Subject node. Also, there are two
        // child node rules:
        // - For any Model node, return its child Element nodes.
        // - For any Element node, return its children Model nodes.
        // Children of the root Subject are all in the single RepositoryModel and some of their children are in the same
        // RepositoryModel as their parent. This means the RepositoryModel node has to be repeated in the hierarchy, but
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

        const rootSubjectNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(rootSubjectNodes.length).to.eq(1);
        expect(rootSubjectNodes).to.containSubset([{
          key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ className: "BisCore:Subject", id: "0x1" }] },
          label: { displayValue: "DgnV8Bridge" },
        }]);

        const rootSubjectChildNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootSubjectNodes[0].key });
        expect(rootSubjectChildNodes.length).to.eq(1);
        expect(rootSubjectChildNodes).to.containSubset([{
          key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ className: "BisCore:RepositoryModel", id: "0x1" }] },
        }]);

        const repositoryModelChildNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootSubjectChildNodes[0].key });
        expect(repositoryModelChildNodes.length).to.eq(11);
        expect(repositoryModelChildNodes).to.containSubset([{
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
        expect(repositoryModelNodes2.length).to.eq(1);
        expect(repositoryModelNodes2).to.containSubset([{
          key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ className: "BisCore:RepositoryModel", id: "0x1" }] },
        }]);
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.Priority.Ruleset
        // The ruleset has two specifications that return nodes for "PhysicalModel" and "SpatialCategory"
        // respectively.The specifications have different priorities and higher priority rule is handled
        // first - that's the reason the "SpatialCategory" node appears first in the result.
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

        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes.length).to.eq(2);
        expect(nodes).to.containSubset([{
          label: { displayValue: "Spatial Category" },
        }, {
          label: { displayValue: "Physical Model" },
        }]);
      });

      it("uses `doNotSort` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.DoNotSort.Ruleset
        // The ruleset has a specification that returns unsorted "Model" nodes - the order is undefined.
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

        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        const sorted = [...nodes].sort((lhs, rhs) => lhs.label.displayValue.localeCompare(rhs.label.displayValue));
        expect(nodes).to.not.deep.eq(sorted);
      });

      it("uses `groupByClass` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.GroupByClass.Ruleset
        // The ruleset contains a specification that returns "Model" nodes without grouping them
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

        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.not.be.empty;
        nodes.forEach((node) => expect(NodeKey.isClassGroupingNodeKey(node.key)).to.be.false);
      });

      it("uses `groupByLabel` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.GroupByLabel.Ruleset
        // The ruleset contains a specification that returns "ECPropertyDef" nodes without grouping them
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
        // The ruleset contains a root nodes' specification that returns "Model" nodes and a child nodes'
        // specification that returns a custom node. The "Model" nodes would have the custom node as a
        // child, but `hasChildren: "Never"` attribute overrides that.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [{ schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true }],
              hasChildren: "Never",
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "T_CHILD",
              label: "Child",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.not.be.empty;
        nodes.forEach((node) => expect(node.hasChildren).to.not.be.true);
      });

      it("uses `relatedInstances` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.RelatedInstances.Ruleset
        // The ruleset contains a root nodes' specification that returns nodes for Elements that are in
        // a Category containing "a" in either `UserLabel` or `CodeValue` property.
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

        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes.length).to.eq(2);
        expect(nodes).to.containSubset([{
          key: { type: StandardNodeTypes.ECClassGroupingNode, className: "Generic:PhysicalObject" },
        }, {
          key: { type: StandardNodeTypes.ECClassGroupingNode, className: "PCJ_TestSchema:TestClass" },
        }]);
      });

      it("uses `nestedRules` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Hierarchies.Specification.NestedRules.Ruleset
        // The ruleset contains two root nodes' specifications:
        // - The first one returns SpatialCategory nodes
        // - The second one returns PhysicalModel nodes and also has a nested child node rule
        //   that creates a static "child" node.
        // Nested rules apply only to nodes created by the same specification, so the static "child"
        // node is created only for the PhysicalModel, but not SpatialCategory.
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

        const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(rootNodes.length).to.eq(2);
        expect(rootNodes).to.containSubset([{
          key: { instanceKeys: [{ className: "BisCore:SpatialCategory" }] },
          hasChildren: undefined,
        }, {
          key: { instanceKeys: [{ className: "BisCore:PhysicalModel" }] },
          hasChildren: true,
        }]);

        const modelChildren = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: rootNodes[1].key });
        expect(modelChildren.length).to.eq(1);
        expect(modelChildren).to.containSubset([{
          label: { displayValue: "child" },
        }]);
      });

      describe("InstanceNodesOfSpecificClassesSpecification", () => {

        it("uses `classes` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.InstanceNodesOfSpecificClassesSpecification.Classes.Ruleset
          // The ruleset has a specification that returns nodes for instances of "BisCore.PhysicalModel" class and all
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

          const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(classGroupingNodes.length).to.eq(1);
          expect(classGroupingNodes).to.containSubset([{
            label: { displayValue: "Physical Model" },
          }]);

          const instanceNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[0].key });
          expect(instanceNodes.length).to.eq(1);
          expect(instanceNodes).to.containSubset([{
            label: { displayValue: "Properties_60InstancesWithUrl2" },
          }]);
        });

        it("uses `excludedClasses` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.InstanceNodesOfSpecificClassesSpecification.ExcludedClasses.Ruleset
          // The ruleset has a specification that returns nodes for all instances of "BisCore.Model" class
          // excluding instances of "BisCore.DefinitionModel", "BisCore.GroupInformationModel" and their subclasses.
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

          const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(classGroupingNodes.length).to.eq(3);
          expect(classGroupingNodes).to.containSubset([{
            label: { displayValue: "Document List" },
          }, {
            label: { displayValue: "Link Model" },
          }, {
            label: { displayValue: "Physical Model" },
          }]);
        });

        it("uses `instanceFilter` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.InstanceNodesOfSpecificClassesSpecification.InstanceFilter.Ruleset
          // The ruleset has a specification that returns nodes for "ViewDefinition" instances whose "CodeValue" ends with "View 1".
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

          const classGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(classGroupingNodes.length).to.eq(1);
          expect(classGroupingNodes).to.containSubset([{
            label: { displayValue: "Spatial View Definition" },
          }]);

          const instanceNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: classGroupingNodes[0].key });
          expect(instanceNodes.length).to.eq(1);
          expect(instanceNodes).to.containSubset([{
            label: { displayValue: "Default - View 1" },
          }]);
        });

      });

      describe("RelatedInstanceNodesSpecification", () => {

        it("uses `relationshipPaths` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.RelatedInstanceNodesSpecification.RelationshipPaths.Ruleset
          // The ruleset has a specification that returns PhysicalModel root nodes. The child node specification
          // returns GeometricElement3d instance nodes that are related to parent Model through ModelContainsElements
          // relationship by following it in forward direction (from Model to Element).
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

          const modelNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(modelNodes.length).to.eq(1);
          expect(modelNodes).to.containSubset([{
            key: { instanceKeys: [{ className: "BisCore:PhysicalModel" }] },
          }]);

          const elementClassGroupingNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: modelNodes[0].key });
          expect(elementClassGroupingNodes.length).to.eq(2);
          expect(elementClassGroupingNodes).to.containSubset([{
            label: { displayValue: "Physical Object" },
          }, {
            label: { displayValue: "TestClass" },
          }]);

          const elementNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset, parentKey: elementClassGroupingNodes[0].key });
          expect(elementNodes.length).to.eq(2);
          expect(elementNodes).to.containSubset([{
            key: { instanceKeys: [{ className: "Generic:PhysicalObject" }] },
          }, {
            key: { instanceKeys: [{ className: "Generic:PhysicalObject" }] },
          }]);
        });

      });

      describe("CustomNodeSpecification", () => {

        it("uses `type` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Hierarchies.CustomNodeSpecification.Type.Ruleset
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

          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes.length).to.eq(1);
          expect(nodes).to.containSubset([{
            key: { type: "T_MY_NODE" },
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

          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes.length).to.eq(1);
          expect(nodes).to.containSubset([{
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

          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes.length).to.eq(1);
          expect(nodes).to.containSubset([{
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

          const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
          expect(nodes.length).to.eq(1);
          expect(nodes).to.containSubset([{
            imageId: "my-icon-identifier",
          }]);
        });

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
