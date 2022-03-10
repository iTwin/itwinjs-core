/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import {
  ChildNodeSpecificationTypes, ContentSpecificationTypes, InstanceLabelOverrideValueSpecificationType, KeySet, RelationshipDirection,
  Ruleset, RuleTypes, VariableValueTypes,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";

describe("Learning Snippets", () => {

  describe("Rules", () => {

    let imodel: IModelConnection;

    beforeEach(async () => {
      await initialize();
      imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    });

    afterEach(async () => {
      await imodel.close();
      await terminate();
    });

    describe("ExtendedDataRule", () => {

      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ExtendedDataRule.RequiredSchemas.Ruleset
        // The ruleset has rule that returns content of given input instances. Also there is an extended data rule
        // to add additional data for `bis.ExternalSourceAspect` instances content. `bis.ExternalSourceAspect` ECClass was
        // introduced in BisCore version 1.0.2, so the rule needs a `requiredSchemas` attribute to only use the rule
        // if the version meets the requirement.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.SelectedNodeInstances,
            }],
          },
          {
            ruleType: RuleTypes.ExtendedData,
            requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
            condition: "ThisNode.IsOfClass(\"ExternalSourceAspect\", \"BisCore\")",
            items: {
              iconName: "\"external-source-icon\"",
            },
          }],
        };
        // __PUBLISH_EXTRACT_END__

        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Element", id: "0x61" }]),
          descriptor: {},
        });
        expect(content?.contentSet).to.be.lengthOf(1).and.to.not.containSubset([
          { extendedData: { iconName: "external-source-icon" } },
        ]);
      });

      it("uses `condition` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ExtendedDataRule.Condition.Ruleset
        // The ruleset has root node rule that returns custom nodes "A" and "B". Also there is an extended data rule
        // to add additional data to "B" nodes.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              label: "A",
              type: "A",
            }, {
              specType: ChildNodeSpecificationTypes.CustomNode,
              label: "B",
              type: "B",
            }],
          },
          {
            ruleType: RuleTypes.ExtendedData,
            condition: "ThisNode.Type = \"B\"",
            items: {
              iconName: "\"custom-icon\"",
            },
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // __PUBLISH_EXTRACT_START__ ExtendedDataRule.Condition.Result
        // Ensure only "B" node has `extendedData` property.
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(2).and.to.containSubset([{
          label: { displayValue: "A" },
          extendedData: undefined,
        }, {
          label: { displayValue: "B" },
          extendedData: {
            iconName: "custom-icon",
          },
        }]);
        // __PUBLISH_EXTRACT_END__
      });

      it("uses `items` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ExtendedDataRule.Items.Ruleset
        // The ruleset has root node rule that returns custom "A" node. Also there is an extended data rule
        // to add additional data to node.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              label: "A",
              type: "A",
            }],
          },
          {
            ruleType: RuleTypes.ExtendedData,
            items: {
              iconName: "\"custom-icon\"",
              fontColor: "\"custom-font-color\"",
              typeDescription: "\"Node is of type \" & ThisNode.Type",
            },
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // __PUBLISH_EXTRACT_START__ ExtendedDataRule.Items.Result
        // Ensure node has `extendedData` property containing items defined in rule.
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(1).and.to.containSubset([{
          label: { displayValue: "A" },
          extendedData: {
            iconName: "custom-icon",
            fontColor: "custom-font-color",
            typeDescription: "Node is of type A",
          },
        }]);
        // __PUBLISH_EXTRACT_END__
      });

    });

    describe("Sorting", () => {

      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Sorting.RequiredSchemas.Ruleset
        // The ruleset has root node rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there is a customization rule to sort
        // instances by `Pitch` property. Sorting rule requires `BisCore` schema to be higher than 1.0.2.
        // If this requirement is not met sorting rule does not take effect.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: " x ",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Roll" } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Pitch" } },
              ],
            }],
          }, {
            ruleType: RuleTypes.PropertySorting,
            requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
            propertyName: "Pitch",
          }],
        };
        // __PUBLISH_EXTRACT_END__

        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

    });

    describe("PropertySortingRule", () => {

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ PropertySortingRule.Priority.Ruleset
        // The ruleset has root node rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there are two customization rules to sort
        // instances by `Roll` and `Pitch` properties. The rules have different priorities and higher priority
        // rule is handled first.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: " x ",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Roll" } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Pitch" } },
              ],
            }],
          }, {
            ruleType: RuleTypes.PropertySorting,
            priority: 1,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            propertyName: "Roll",
          }, {
            ruleType: RuleTypes.PropertySorting,
            priority: 2,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            propertyName: "Pitch",
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that nodes are sorted by `Pitch` property
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

      it("uses `condition` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ PropertySortingRule.Condition.Ruleset
        // The ruleset has root node rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there are customization rule to sort
        // instances by `Pitch` property.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: " x ",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Roll" } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Pitch" } },
              ],
            }],
          }, {
            ruleType: RuleTypes.PropertySorting,
            condition: "TRUE",
            propertyName: "Pitch",
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that nodes are sorted by `Pitch` property
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
          rulesetVariables: [{ id: "SORT_INSTANCES", type: VariableValueTypes.Bool, value: true }],
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

      it("uses `class` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ PropertySortingRule.Class.Ruleset
        // The ruleset has root node rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there are customization rule to sort
        // `bis.SpatialViewDefinition` instances by `Pitch` property
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: " x ",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Roll" } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Pitch" } },
              ],
            }],
          }, {
            ruleType: RuleTypes.PropertySorting,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            propertyName: "Pitch",
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that nodes are sorted by `Pitch` property
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

      it("uses `isPolymorphic` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ PropertySortingRule.IsPolymorphic.Ruleset
        // This ruleset lists `bis.SpatialViewDefinition` instances with their `Roll` and `Pitch` properties as instance
        // labels. Sorting rule targets `bis.ViewDefinition3d`, the base class of `bis.SpatialViewDefinition`, so to
        // sort instances of the derived classes, `isPolymorphic` attribute needs to be `true`.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: " x ",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Roll" } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Pitch" } },
              ],
            }],
          }, {
            ruleType: RuleTypes.PropertySorting,
            class: { schemaName: "BisCore", className: "ViewDefinition3d" },
            isPolymorphic: true,
            propertyName: "Pitch",
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that nodes of `bis.SpatialViewDefinition` class instances are sorted
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

      it("uses `propertyName` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ PropertySortingRule.PropertyName.Ruleset
        // The ruleset has root node rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there are customization rule to sort
        // instances of any class by `Pitch` property.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: " x ",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Roll" } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Pitch" } },
              ],
            }],
          }, {
            ruleType: RuleTypes.PropertySorting,
            propertyName: "Pitch",
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that nodes are sorted by `Pitch` property
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

      it("uses `sortAscending` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ PropertySortingRule.SortAscending.Ruleset
        // The ruleset has root node rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there are customization rule to sort
        // instances by `Pitch` property in descending order
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: " x ",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Roll" } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Pitch" } },
              ],
            }],
          }, {
            ruleType: RuleTypes.PropertySorting,
            propertyName: "Pitch",
            sortAscending: false,
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that nodes are sorted by `Pitch` in descending order
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
      });

    });

    describe("DisabledSortingRule", () => {

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ DisabledSortingRule.Priority.Ruleset
        // The ruleset has root node rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there are two customization rules to sort
        // instances by `Roll` property and to disable `bis.SpatialViewDefinition` instances sorting.
        // The disabled sorting rule has higher priority and it is handled first.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: " x ",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Roll" } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "Pitch" } },
              ],
            }],
          }, {
            ruleType: RuleTypes.PropertySorting,
            priority: 1,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            propertyName: "Pitch",
          }, {
            ruleType: RuleTypes.DisabledSorting,
            priority: 2,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that nodes are not sorted by `Pitch` property
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

      it("uses `condition` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ DisabledSortingRule.Condition.Ruleset
        // The ruleset has root node rule that returns `bis.ViewDefinition` instances with labels
        // consisting of `CodeValue` property value. Also there are customization rule to disable
        // instances sorting.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "ViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Property,
              propertyName: "CodeValue",
            }],
          }, {
            ruleType: RuleTypes.DisabledSorting,
            condition: "TRUE",
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that nodes are not sorted by `Pitch` property
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
          rulesetVariables: [{ id: "SORT_INSTANCES", type: VariableValueTypes.Bool, value: true }],
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "Default - View 1" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "Default - View 2" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "Default - View 3" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "Default - View 4" } });
      });

      it("uses `class` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ DisabledSortingRule.Class.Ruleset
        // The ruleset has root node rule that returns `bis.ViewDefinition` instances with labels
        // consisting of class name and `CodeValue` property value. Also there two are customization rules to sort
        // instances by `CodeValue` property and to disable `bis.SpatialViewDefinition` instances sorting.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "ViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: " - ",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.ClassName } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "CodeValue" } },
              ],
            }],
          }, {
            ruleType: RuleTypes.PropertySorting,
            priority: 1,
            class: { schemaName: "BisCore", className: "ViewDefinition" },
            propertyName: "CodeValue",
            isPolymorphic: true,
          }, {
            ruleType: RuleTypes.DisabledSorting,
            priority: 2,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
          }],
        };
        // __PUBLISH_EXTRACT_END__

        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "SpatialViewDefinition - Default - View 1" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "SpatialViewDefinition - Default - View 2" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "SpatialViewDefinition - Default - View 3" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "SpatialViewDefinition - Default - View 4" } });
      });

      it("uses `isPolymorphic` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ DisabledSortingRule.IsPolymorphic.Ruleset
        // The ruleset has root node rule that returns `bis.ViewDefinition` instances with labels
        // consisting of class name and `CodeValue` property value. Also there are two customization rules to sort
        // instances by `CodeValue` property and to disable `bis.ViewDefinition2d` instances sorting polymorphically.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "ViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: " - ",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.ClassName } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.Property, propertyName: "CodeValue" } },
              ],
            }],
          }, {
            ruleType: RuleTypes.PropertySorting,
            priority: 1,
            class: { schemaName: "BisCore", className: "ViewDefinition" },
            propertyName: "CodeValue",
            isPolymorphic: true,
          }, {
            ruleType: RuleTypes.DisabledSorting,
            priority: 2,
            class: { schemaName: "BisCore", className: "ViewDefinition2d" },
            isPolymorphic: true,
          }],
        };
        // __PUBLISH_EXTRACT_END__

        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(4);
        expect(nodes[0]).to.containSubset({ label: { displayValue: "SpatialViewDefinition - Default - View 1" } });
        expect(nodes[1]).to.containSubset({ label: { displayValue: "SpatialViewDefinition - Default - View 2" } });
        expect(nodes[2]).to.containSubset({ label: { displayValue: "SpatialViewDefinition - Default - View 3" } });
        expect(nodes[3]).to.containSubset({ label: { displayValue: "SpatialViewDefinition - Default - View 4" } });
      });

    });

    describe("InstanceLabelOverride", () => {

      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.RequiredSchemas.Ruleset
        // The ruleset has root node rule that returns `Generic.PhysicalObject` instances and
        // customization rule to override label using related `bis.ExternalSourceAspect` property.
        // `bis.ExternalSourceAspect` ECClass was introduced in BisCore version 1.0.2, so the rule needs
        // a `requiredSchemas` attribute to only use the rule if the version meets the requirement.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "Generic", classNames: ["PhysicalObject"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
            class: { schemaName: "Generic", className: "PhysicalObject" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Property,
              propertySource: {
                relationship: { schemaName: "BisCore", className: "ElementOwnsMultiAspects" },
                direction: RelationshipDirection.Forward,
                targetClass: { schemaName: "BisCore", className: "ExternalSourceAspect" },
              },
              propertyName: "Identifier",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that label was not overriden because imodel has older BisCore schema than required by label override
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(2).and.to.containSubset([
          { label: { displayValue: "Physical Object [0-38]" } },
          { label: { displayValue: "Physical Object [0-39]" } },
        ]);
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.Priority.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and two
        // customization rules to override labels. The rules have different priorities and
        // higher priority rule is handled first.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            priority: 1,
            class: { schemaName: "BisCore", className: "GeometricModel3d" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.String,
              value: "Model A",
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            priority: 2,
            class: { schemaName: "BisCore", className: "GeometricModel3d" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.String,
              value: "Model B",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that label override with higher priority was applied
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(1).and.to.containSubset([
          { label: { displayValue: "Model B" } },
        ]);
      });

      it("uses `onlyIfNotHandled` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.OnlyIfNotHandled.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and two
        // customization rules to override label. The first label override rule has lower priority and
        // `onlyIfNodeHandled` attribute, which allows it to be overriden by higher priority rules. Even
        // if rule with higher priority does not provide value for label rule with lower priority is not used.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            priority: 1,
            onlyIfNotHandled: true,
            class: { schemaName: "BisCore", className: "GeometricModel3d" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.String,
              value: "Model A",
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            priority: 2,
            class: { schemaName: "BisCore", className: "GeometricModel3d" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.String,
              value: "",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that only label override with higher priority was applied
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(1).and.to.containSubset([
          { label: { displayValue: "Ñót spêçìfíêd" } },
        ]);
      });

      it("uses `class` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.Class.Ruleset
        // The ruleset has root node rule that returns `bis.Model` instances.
        // Also there is customization rule to override label only for `bis.GeometricModel3d` instances.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "GeometricModel3d" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.String,
              value: "Geometric Model Node",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that only `bis.GeometricModel3d` instances label was overriden
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(8).and.to.containSubset([
          { label: { displayValue: "BisCore.DictionaryModel" } },
          { label: { displayValue: "BisCore.RealityDataSources" } },
          { label: { displayValue: "Converted Drawings" } },
          { label: { displayValue: "Converted Groups" } },
          { label: { displayValue: "Converted Sheets" } },
          { label: { displayValue: "Definition Model For DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default" } },
          { label: { displayValue: "Geometric Model Node" } },
          { label: { displayValue: "Ñót spêçìfíêd" } },
        ]);
      });

      it("uses composite value specification", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.CompositeValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricElement3d` instances and
        // customization rule to override instance label composed of string "ECClass" and instance ECClass name.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "GeometricModel3d" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Composite,
              separator: "-",
              parts: [
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.String, value: "ECClass" } },
                { spec: { specType: InstanceLabelOverrideValueSpecificationType.ClassName } },
              ],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that label was set to composed value
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(1).and.to.containSubset([
          { label: { displayValue: "ECClass-PhysicalModel" } },
        ]);
      });

      it("uses property value specification", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.PropertyValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.SpatialViewDefinition` instances and
        // customization rule to override instance label using `Pitch` property value.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Property,
              propertyName: "Pitch",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that labels was set to `Pitch` property value
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(4).and.to.containSubset([
          { label: { displayValue: "-35.26" } },
          { label: { displayValue: "-160.99" } },
          { label: { displayValue: "0.00" } },
          { label: { displayValue: "90.00" } },
        ]);
      });

      it("uses related property value specification", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.RelatedPropertyValueSpecification.Ruleset
        // The ruleset has root node rule that returns `meta.ECEnumerationDef` instances and
        // customization rule to override instance label using `Alias` property value of
        // `meta.ECSchemaDef` instance that is containing `meta.ECEnumerationDef` instance.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "ECDbMeta", classNames: ["ECEnumerationDef"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "ECDbMeta", className: "ECEnumerationDef" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.Property,
              propertySource: {
                relationship: { schemaName: "ECDbMeta", className: "SchemaOwnsEnumerations" },
                direction: RelationshipDirection.Backward,
              },
              propertyName: "Alias",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that labels were set to related `meta.ECSchemaDef` instance `Alias` property value
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(18).and.to.containSubset([
          { label: { displayValue: "bis" } },
          { label: { displayValue: "bis" } },
          { label: { displayValue: "bsca" } },
          { label: { displayValue: "bsca" } },
          { label: { displayValue: "bsca" } },
          { label: { displayValue: "CoreCA" } },
          { label: { displayValue: "CoreCA" } },
          { label: { displayValue: "dgnca" } },
          { label: { displayValue: "ecdbf" } },
          { label: { displayValue: "meta" } },
          { label: { displayValue: "meta" } },
          { label: { displayValue: "meta" } },
          { label: { displayValue: "meta" } },
          { label: { displayValue: "meta" } },
          { label: { displayValue: "meta" } },
          { label: { displayValue: "meta" } },
          { label: { displayValue: "meta" } },
          { label: { displayValue: "PCJTest" } },
        ]);
      });

      it("uses string value specification", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.StringValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and
        // customization rule to override label using string "Model Node".
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "GeometricModel3d" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.String,
              value: "Model Node",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that label was set to "Model Node"
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(1).and.to.containSubset([
          { label: { displayValue: "Model Node" } },
        ]);
      });

      it("uses class name value specification", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.ClassNameValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and
        // customization rule to override instance label using full name of instance ECClass.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: true,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "GeometricModel3d" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.ClassName,
              full: true,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that label was set to full class name
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(1).and.to.containSubset([
          { label: { displayValue: "BisCore:PhysicalModel" } },
        ]);
      });

      it("uses class label value specification", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.ClassLabelValueSpecification.Ruleset
        // The ruleset has root node rule that returns 'bis.GeometricModel3d' instances and
        // customization rule to override instance label with instance class label.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "GeometricModel3d" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.ClassLabel,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that label value was set to instance ECClass label
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(1).and.to.containSubset([
          { label: { displayValue: "Physical Model" } },
        ]);
      });

      it("uses briefcaseId value specification", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.BriefcaseIdValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and
        // customization rule to override instance label with BriefcaseId value.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "GeometricModel3d" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.BriefcaseId,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that only label override with higher priority was applied
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(1).and.to.containSubset([
          { label: { displayValue: "0" } },
        ]);
      });

      it("uses localId value specification", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.LocalIdValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and
        // customization rule to override instance label with LocalId value.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "BisCore", className: "GeometricModel3d" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.LocalId,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that only label override with higher priority was applied
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(1).and.to.containSubset([
          { label: { displayValue: "S" } },
        ]);
      });

      it("uses related instance label value specification", async () => {
        // __PUBLISH_EXTRACT_START__ InstanceLabelOverride.RelatedInstanceLabelValueSpecification.Ruleset
        // The ruleset has root node rule that returns `Generic.PhysicalObject` instances and
        // customization rule to override instance label with label of `bis.Model` instance
        // containing `Generic.PhysicalObject` instance.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "Generic", classNames: ["PhysicalObject"], arePolymorphic: true },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.InstanceLabelOverride,
            class: { schemaName: "Generic", className: "PhysicalObject" },
            values: [{
              specType: InstanceLabelOverrideValueSpecificationType.RelatedInstanceLabel,
              pathToRelatedInstance: {
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Backward,
              },
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // verify that only label override with higher priority was applied
        const nodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes).to.be.lengthOf(2).and.to.containSubset([
          { label: { displayValue: "Properties_60InstancesWithUrl2" } },
          { label: { displayValue: "Properties_60InstancesWithUrl2" } },
        ]);
      });

    });

  });

});
