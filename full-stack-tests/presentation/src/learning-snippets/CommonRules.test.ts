/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import {
  ChildNodeSpecificationTypes, ContentSpecificationTypes, GroupingSpecificationTypes, KeySet, RelationshipDirection, Ruleset, RuleTypes,
  StandardNodeTypes,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";
import { getFieldByLabel } from "../Utils";

describe("Learning Snippets", () => {

  let imodel: IModelConnection;

  beforeEach(async () => {
    await initialize();
    imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  afterEach(async () => {
    await imodel.close();
    await terminate();
  });

  describe("RelatedInstanceSpecification", () => {

    it("using in instance filter", async () => {
      // __PUBLISH_EXTRACT_START__ RelatedInstanceSpecification.UsingInInstanceFilter.Ruleset
      // This ruleset defines a specification that returns content for `bis.ViewDefinition` instances. In addition,
      // there's a related instance specification, that describes a path to a related display style, and an
      // instance filter that filters using its property.
      const ruleset: Ruleset = {
        id: "example",
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
              relatedInstances: [{
                relationshipPath: {
                  relationship: { schemaName: "BisCore", className: "ViewDefinitionUsesDisplayStyle" },
                  direction: RelationshipDirection.Forward,
                },
                alias: "display_style",
                isRequired: true,
              }],
              instanceFilter: `display_style.CodeValue ~ "%View%"`,
            },
          ],
        }],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that only `bis.ViewDefinition` instances are selected.
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet(),
        descriptor: {},
      });

      expect(content!.contentSet.length).to.eq(3);
      const field = getFieldByLabel(content!.descriptor.fields, "Display Style");
      content!.contentSet.forEach((record) => {
        expect(record.displayValues[field.name]).to.contain("View");
      });
    });

    it("using for customization", async () => {
      // __PUBLISH_EXTRACT_START__ RelatedInstanceSpecification.UsingForCustomization.Ruleset
      // This ruleset defines a specification that returns nodes for `meta.ECClassDef` instances. In addition,
      // there's a related instance specification, that describes a path to the schema that the class belongs to.
      // Finally, there's an extended data rule that sets full class name on each of the nodes. Full class name consists
      // of schema and class names and the schema instance can be referenced through the alias specified in related
      // instance specification.
      const ruleset: Ruleset = {
        id: "example",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [
            {
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "ECDbMeta", classNames: ["ECClassDef"] },
              groupByClass: false,
              groupByLabel: false,
              relatedInstances: [{
                relationshipPath: {
                  relationship: { schemaName: "ECDbMeta", className: "SchemaOwnsClasses" },
                  direction: RelationshipDirection.Backward,
                },
                alias: "schema",
                isRequired: true,
              }],
            },
          ],
          customizationRules: [{
            ruleType: RuleTypes.ExtendedData,
            items: {
              fullClassName: `schema.Name & "." & this.Name`,
            },
          }],
        }],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // __PUBLISH_EXTRACT_START__ RelatedInstanceSpecification.UsingForCustomization.Ruleset
      // Every node should have its full class name in extended data
      const nodes = await Presentation.presentation.getNodes({
        imodel,
        rulesetOrId: ruleset,
      });
      expect(nodes.length).to.eq(417);
      nodes.forEach((node) => {
        const fullClassName = node.extendedData!.fullClassName;
        const [schemaName, className] = fullClassName.split(".");
        expect(schemaName).to.not.be.empty;
        expect(className).to.not.be.empty;
      });
      // __PUBLISH_EXTRACT_END__
    });

    it("using for grouping", async () => {
      // __PUBLISH_EXTRACT_START__ RelatedInstanceSpecification.UsingForGrouping.Ruleset
      // This ruleset defines a specification that returns nodes for `meta.ECClassDef` instances. In addition,
      // there's a related instance specification, that describes a path to the schema that the class belongs to.
      // Finally, there's a grouping rule that requests grouping on `ECSchemaDef.Name` property. Because
      // the `ECClassDef` instances are "linked" to related `ECSchemaDef` instances, the grouping takes effect
      // and classes get grouped by related schema names.
      const ruleset: Ruleset = {
        id: "example",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [
            {
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "ECDbMeta", classNames: ["ECClassDef"] },
              groupByClass: false,
              groupByLabel: false,
              relatedInstances: [{
                relationshipPath: {
                  relationship: { schemaName: "ECDbMeta", className: "SchemaOwnsClasses" },
                  direction: RelationshipDirection.Backward,
                },
                alias: "schema",
                isRequired: true,
              }],
            },
          ],
          customizationRules: [{
            ruleType: RuleTypes.Grouping,
            class: { schemaName: "ECDbMeta", className: "ECSchemaDef" },
            groups: [{
              specType: GroupingSpecificationTypes.Property,
              propertyName: "Name",
              createGroupForSingleItem: true,
            }],
          }],
        }],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Every node should have its full class name in extended data
      const schemaNodes = await Presentation.presentation.getNodes({
        imodel,
        rulesetOrId: ruleset,
      });
      expect(schemaNodes.length).to.eq(18);
      await Promise.all(schemaNodes.map(async (schemaNode) => {
        expect(schemaNode).to.containSubset({
          key: {
            type: StandardNodeTypes.ECPropertyGroupingNode,
            className: "ECDbMeta:ECSchemaDef",
            propertyName: "Name",
          },
        });
        const classNodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset,
          parentKey: schemaNode.key,
        });
        expect(classNodes).to.not.be.empty;
      }));
    });

  });

  describe("RelationshipPathSpecification", () => {

    it("using single-step specification", async () => {
      // __PUBLISH_EXTRACT_START__ RelationshipPathSpecification.SingleStep.Ruleset
      // This ruleset defines a specification that returns content for given `bis.Model` instances. The
      // content is created for model elements found by following the `bis.ModelContainsElements`
      // relationship and picking only `bis.PhysicalElement` type of elements.
      const ruleset: Ruleset = {
        id: "example",
        rules: [{
          ruleType: RuleTypes.Content,
          condition: `SelectedNode.IsOfClass("Model", "BisCore")`,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentRelatedInstances,
              relationshipPaths: [{
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Forward,
                targetClass: { schemaName: "BisCore", className: "PhysicalElement" },
              }],
            },
          ],
        }],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that all model elements are selected
      const physicalModelContent = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
        descriptor: {},
      });
      expect(physicalModelContent!.contentSet.length).to.eq(62);

      // Ensure that non-physical model elements are not selected
      const definitionModelContent = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:DefinitionModel", id: "0x16" }]),
        descriptor: {},
      });
      expect(definitionModelContent).to.be.undefined;
    });

    it("using multi-step specification", async () => {
      // __PUBLISH_EXTRACT_START__ RelationshipPathSpecification.MultiStep.Ruleset
      // This ruleset defines a specification that returns content for given `bis.GeometricModel3d` instances. The
      // content is created for categories of model elements found by following the `bis.ModelContainsElements` and
      // `bis.GeometricElement3dIsInCategory` relationships.
      const ruleset: Ruleset = {
        id: "example",
        rules: [{
          ruleType: RuleTypes.Content,
          condition: `SelectedNode.IsOfClass("GeometricModel3d", "BisCore")`,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentRelatedInstances,
              relationshipPaths: [[{
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Forward,
              }, {
                relationship: { schemaName: "BisCore", className: "GeometricElement3dIsInCategory" },
                direction: RelationshipDirection.Forward,
              }]],
            },
          ],
        }],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that all model elements are selected
      const physicalModelContent = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
        descriptor: {},
      });
      expect(physicalModelContent!.contentSet.length).to.eq(1);
    });

  });

});

function printRuleset(ruleset: Ruleset) {
  if (process.env.PRINT_RULESETS) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(ruleset, undefined, 2));
  }
}
