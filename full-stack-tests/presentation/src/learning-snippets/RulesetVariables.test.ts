/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { ChildNodeSpecificationTypes, Ruleset, RuleTypes } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";

describe("Learning Snippets", () => {

  describe("Ruleset Variables", () => {

    let imodel: IModelConnection;

    beforeEach(async () => {
      await initialize();
      imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    });

    afterEach(async () => {
      await imodel.close();
      await terminate();
    });

    it("uses ruleset variable in rule condition", async () => {
      // __PUBLISH_EXTRACT_START__ RulesetVariables.InRuleCondition.Ruleset
      // The ruleset has two root node rules - one for models and one for elements. The one actually used
      // depends on a ruleset variable value, which can be changed without modifying the ruleset itself.
      const variableId = "root-nodes-type";
      const ruleset: Ruleset = {
        id: "test",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          condition: `GetVariableStringValue("${variableId}") = "models"`,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "BisCore", classNames: ["Model"] },
            arePolymorphic: true,
          }],
        }, {
          ruleType: RuleTypes.RootNodes,
          condition: `GetVariableStringValue("${variableId}") = "elements"`,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "BisCore", classNames: ["Element"] },
            arePolymorphic: true,
          }],
        }],
      };
      // __PUBLISH_EXTRACT_END__

      // No variable set - the request should return 0 nodes
      const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(nodes.length).to.eq(0);

      // Set variable to "models" and ensure we get model grouping nodes
      // __PUBLISH_EXTRACT_START__ RulesetVariables.InRuleCondition.SetToModels
      await Presentation.presentation.vars(ruleset.id).setString(variableId, "models");
      // __PUBLISH_EXTRACT_END__
      const modelNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(modelNodes).to.containSubset([{
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

      // Set variable to "elements" and ensure we get element grouping nodes
      // __PUBLISH_EXTRACT_START__ RulesetVariables.InRuleCondition.SetToElements
      await Presentation.presentation.vars(ruleset.id).setString(variableId, "elements");
      // __PUBLISH_EXTRACT_END__
      const elementNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(elementNodes).to.containSubset([{
        label: { displayValue: "3D Display Style" },
      }, {
        label: { displayValue: "Category Selector" },
      }, {
        label: { displayValue: "Definition Partition" },
      }, {
        label: { displayValue: "Document Partition" },
      }, {
        label: { displayValue: "Drawing Category" },
      }, {
        label: { displayValue: "Group Information Partition" },
      }, {
        label: { displayValue: "Line Style" },
      }, {
        label: { displayValue: "Link Partition" },
      }, {
        label: { displayValue: "Model Selector" },
      }, {
        label: { displayValue: "Physical Object" },
      }, {
        label: { displayValue: "Physical Partition" },
      }, {
        label: { displayValue: "Repository Link" },
      }, {
        label: { displayValue: "Spatial Auxiliary Coordinate System" },
      }, {
        label: { displayValue: "Spatial Category" },
      }, {
        label: { displayValue: "Spatial View Definition" },
      }, {
        label: { displayValue: "Sub-Category" },
      }, {
        label: { displayValue: "Subject" },
      }, {
        label: { displayValue: "TestClass" },
      }]);
    });

    it("uses ruleset variable in instance filter", async () => {
      // __PUBLISH_EXTRACT_START__ RulesetVariables.InInstanceFilter.Ruleset
      // The ruleset has a root node rule which loads all bis.Element instances, optionally filtered
      // by ECInstanceId.
      const variableId = "element-ids";
      const ruleset: Ruleset = {
        id: "test",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "BisCore", classNames: ["Element"] },
            arePolymorphic: true,
            instanceFilter: `NOT HasVariable("${variableId}") OR GetVariableIntValues("${variableId}").AnyMatch(id => id = this.ECInstanceId)`,
          }],
        }],
      };
      // __PUBLISH_EXTRACT_END__

      // No variable set - the request should return grouping nodes of all elements
      let nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(nodes).to.containSubset([{
        label: { displayValue: "3D Display Style" },
      }, {
        label: { displayValue: "Category Selector" },
      }, {
        label: { displayValue: "Definition Partition" },
      }, {
        label: { displayValue: "Document Partition" },
      }, {
        label: { displayValue: "Drawing Category" },
      }, {
        label: { displayValue: "Group Information Partition" },
      }, {
        label: { displayValue: "Line Style" },
      }, {
        label: { displayValue: "Link Partition" },
      }, {
        label: { displayValue: "Model Selector" },
      }, {
        label: { displayValue: "Physical Object" },
      }, {
        label: { displayValue: "Physical Partition" },
      }, {
        label: { displayValue: "Repository Link" },
      }, {
        label: { displayValue: "Spatial Auxiliary Coordinate System" },
      }, {
        label: { displayValue: "Spatial Category" },
      }, {
        label: { displayValue: "Spatial View Definition" },
      }, {
        label: { displayValue: "Sub-Category" },
      }, {
        label: { displayValue: "Subject" },
      }, {
        label: { displayValue: "TestClass" },
      }]);

      // Set the value to several element IDs and ensure we get their class grouping nodes
      // __PUBLISH_EXTRACT_START__ RulesetVariables.InInstanceFilter.SetIds
      await Presentation.presentation.vars(ruleset.id).setId64s(variableId, ["0x1", "0x74", "0x40"]);
      // __PUBLISH_EXTRACT_END__
      nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(nodes).to.containSubset([{
        label: { displayValue: "Physical Object" },
      }, {
        label: { displayValue: "Subject" },
      }, {
        label: { displayValue: "TestClass" },
      }]);

      // Set the value to different element IDs and ensure we get their class grouping nodes
      await Presentation.presentation.vars(ruleset.id).setId64s(variableId, ["0x17", "0x16"]);
      nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(nodes).to.containSubset([{
        label: { displayValue: "Definition Partition" },
      }, {
        label: { displayValue: "Spatial Category" },
      }]);

      // Finally, unsetting the value should get us the initial view
      // __PUBLISH_EXTRACT_START__ RulesetVariables.InInstanceFilter.Unset
      await Presentation.presentation.vars(ruleset.id).unset(variableId);
      // __PUBLISH_EXTRACT_END__
      nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(nodes).to.containSubset([{
        label: { displayValue: "3D Display Style" },
      }, {
        label: { displayValue: "Category Selector" },
      }, {
        label: { displayValue: "Definition Partition" },
      }, {
        label: { displayValue: "Document Partition" },
      }, {
        label: { displayValue: "Drawing Category" },
      }, {
        label: { displayValue: "Group Information Partition" },
      }, {
        label: { displayValue: "Line Style" },
      }, {
        label: { displayValue: "Link Partition" },
      }, {
        label: { displayValue: "Model Selector" },
      }, {
        label: { displayValue: "Physical Object" },
      }, {
        label: { displayValue: "Physical Partition" },
      }, {
        label: { displayValue: "Repository Link" },
      }, {
        label: { displayValue: "Spatial Auxiliary Coordinate System" },
      }, {
        label: { displayValue: "Spatial Category" },
      }, {
        label: { displayValue: "Spatial View Definition" },
      }, {
        label: { displayValue: "Sub-Category" },
      }, {
        label: { displayValue: "Subject" },
      }, {
        label: { displayValue: "TestClass" },
      }]);
    });

    it("uses ruleset variable in customization rule value expression", async () => {
      // __PUBLISH_EXTRACT_START__ RulesetVariables.InCustomizationRuleValueExpression.Ruleset
      // The ruleset has a root node rule which loads all bis.SpatialViewDefinition instances. There's
      // also a label customization rule which optionally prefixes node labels with a ruleset variable value and
      // an instance label override rule to clear default BIS label override rules.
      const variableId = "prefix";
      const ruleset: Ruleset = {
        id: "test",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
            arePolymorphic: true,
            groupByClass: false,
            groupByLabel: false,
          }],
        }, {
          ruleType: RuleTypes.LabelOverride,
          label: `IIF(HasVariable("${variableId}"), GetVariableStringValue("${variableId}") & " " & this.CodeValue, this.CodeValue)`,
        }, {
          ruleType: RuleTypes.InstanceLabelOverride,
          class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
          values: [],
        }],
      };
      // __PUBLISH_EXTRACT_END__

      // No variable set - the request should return nodes without any prefix
      let nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(nodes).to.containSubset([{
        label: { displayValue: "Default - View 1" },
      }, {
        label: { displayValue: "Default - View 2" },
      }, {
        label: { displayValue: "Default - View 3" },
      }, {
        label: { displayValue: "Default - View 4" },
      }]);

      // Set the prefix to some value and confirm node labels get prefixed
      // __PUBLISH_EXTRACT_START__ RulesetVariables.InCustomizationRuleValueExpression.SetValue
      await Presentation.presentation.vars(ruleset.id).setString(variableId, "test");
      // __PUBLISH_EXTRACT_END__
      nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
      expect(nodes).to.containSubset([{
        label: { displayValue: "test Default - View 1" },
      }, {
        label: { displayValue: "test Default - View 2" },
      }, {
        label: { displayValue: "test Default - View 3" },
      }, {
        label: { displayValue: "test Default - View 4" },
      }]);
    });

  });

});
