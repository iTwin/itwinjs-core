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

  describe("MultiSchemaClasses", () => {

    it("uses all attributes", async () => {
      // __PUBLISH_EXTRACT_START__ MultiSchemaClasses.Ruleset
      // This ruleset produces content for instances of `bis.PhysicalModel` and `bis.SpatialCategory` classes.
      // Descendants of these classes will be considered incompatible with the specified class filter because
      // `arePolymorphic` attribute is set to`false`.
      const ruleset: Ruleset = {
        id: "example",
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
            classes: {
              schemaName: "BisCore",
              classNames: ["PhysicalModel", "SpatialCategory"],
              arePolymorphic: false,
            },
          }],
        }],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that `bis.PhysicalModel` and `bis.SpatialCategory` instances are selected.
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet(),
        descriptor: {},
      });

      expect(content!.contentSet).to.have.lengthOf(2);
      expect(content!.contentSet).to.containSubset([{
        primaryKeys: [{ className: "BisCore:PhysicalModel" }],
      }]);
      expect(content!.contentSet).to.containSubset([{
        primaryKeys: [{ className: "BisCore:SpatialCategory" }],
      }]);
    });

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

      // __PUBLISH_EXTRACT_START__ RelatedInstanceSpecification.UsingForCustomization.Result
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

  describe("RepeatableRelationshipPathSpecification", () => {

    it("using single-step specification with `count`", async () => {
      // __PUBLISH_EXTRACT_START__ RepeatableRelationshipPathSpecification.SingleStepWithCount.Ruleset
      // This ruleset defines a specification that returns content for given `bis.Element` instances by
      // returning their grandparent property values.
      const ruleset: Ruleset = {
        id: "example",
        rules: [{
          ruleType: RuleTypes.Content,
          condition: `SelectedNode.IsOfClass("Element", "BisCore")`,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentRelatedInstances,
              relationshipPaths: [{
                relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                direction: RelationshipDirection.Backward,
                count: 2,
              }],
            },
          ],
        }],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that content of grandparent element is returned
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:Element", id: "0x1b" }]),
        descriptor: {},
      });
      expect(content!.contentSet).to.have.lengthOf(1).and.to.containSubset([{
        primaryKeys: [{ id: "0x1" }],
      }]);
    });

    it("using recursive specification", async () => {
      // __PUBLISH_EXTRACT_START__ RepeatableRelationshipPathSpecification.RecursiveSingleStep.Ruleset
      // This ruleset defines a specification that returns content for all children of the given `bis.Element`.
      const ruleset: Ruleset = {
        id: "example",
        rules: [{
          ruleType: RuleTypes.Content,
          condition: `SelectedNode.IsOfClass("Element", "BisCore")`,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentRelatedInstances,
              relationshipPaths: [{
                relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                direction: RelationshipDirection.Forward,
                count: "*",
              }],
            },
          ],
        }],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that content of the root subject's children is returned
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:Element", id: "0x1" }]),
        descriptor: {},
      });
      expect(content!.contentSet).to.have.lengthOf(9).and.to.containSubset([{
        primaryKeys: [{ id: "0xe" }],
      }, {
        primaryKeys: [{ id: "0x10" }],
      }, {
        primaryKeys: [{ id: "0x12" }],
      }, {
        primaryKeys: [{ id: "0x13" }],
      }, {
        primaryKeys: [{ id: "0x14" }],
      }, {
        primaryKeys: [{ id: "0x15" }],
      }, {
        primaryKeys: [{ id: "0x16" }],
      }, {
        primaryKeys: [{ id: "0x1b" }],
      }, {
        primaryKeys: [{ id: "0x1c" }],
      }]);
    });

    it("combining recursive and non-recursive specifications", async () => {
      // __PUBLISH_EXTRACT_START__ RepeatableRelationshipPathSpecification.RecursiveAndNonRecursiveSpecificationsCombination.Ruleset
      // This ruleset defines a specification that returns content for categories of all elements in
      // the given `bis.Model` and their children.
      const ruleset: Ruleset = {
        id: "example",
        rules: [{
          ruleType: RuleTypes.Content,
          condition: `SelectedNode.IsOfClass("Model", "BisCore")`,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentRelatedInstances,
              relationshipPaths: [[{
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Forward,
                targetClass: { schemaName: "BisCore", className: "GeometricElement3d" },
              }, {
                relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                direction: RelationshipDirection.Forward,
                targetClass: { schemaName: "BisCore", className: "GeometricElement3d" },
                count: "*",
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

      // Ensure that elements' category is returned when requesting content for those elements' model
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
        descriptor: {},
      });
      expect(content!.contentSet).to.have.lengthOf(1).and.to.containSubset([{
        primaryKeys: [{ id: "0x17" }],
      }]);
    });

    it("combining multiple recursive specifications", async () => {
      // __PUBLISH_EXTRACT_START__ RepeatableRelationshipPathSpecification.MultipleRecursiveSpecificationsCombination.Ruleset
      // The ruleset contains a three-step relationship path that finds all `bis.GeometricElement3d` elements related to given model
      // through the `bis.ModelContainsElements` relationship, then finds all `bis.SpatialCategory` elements related to `bis.GeometricElement3d`
      // found in the previous step through `bis.GeometricElement3dIsInCategory` relationship and finds all `bis.SubCategory` elements related
      // to `bis.SpatialCategory` found in the previous step through `bis.CategoryOwnsSubCategories` relationship.
      // The result includes `bis.GeometricElement3d`, `bis.SpatialCategory` and `bis.SubCategory` elements.
      const ruleset: Ruleset = {
        id: "example",
        rules: [{
          ruleType: RuleTypes.Content,
          condition: `SelectedNode.IsOfClass("Model", "BisCore")`,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentRelatedInstances,
              relationshipPaths: [[{
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Forward,
                targetClass: { schemaName: "BisCore", className: "GeometricElement3d" },
                count: "*",
              }, {
                relationship: { schemaName: "BisCore", className: "GeometricElement3dIsInCategory" },
                direction: RelationshipDirection.Forward,
                targetClass: { schemaName: "BisCore", className: "SpatialCategory" },
                count: "*",
              }, {
                relationship: { schemaName: "BisCore", className: "CategoryOwnsSubCategories" },
                direction: RelationshipDirection.Forward,
                count: "*",
              }]],
            },
          ],
        }],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that the count is correct (62 elements + 1 category + 1 sub-category) and both
      // categories are included. Not checking the elements...
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
        descriptor: {},
      });
      expect(content!.contentSet).to.have.lengthOf(62 + 1 + 1);
      expect(content!.contentSet).to.containSubset([{
        primaryKeys: [{ className: "BisCore:SpatialCategory", id: "0x17" }],
      }]);
      expect(content!.contentSet).to.containSubset([{
        primaryKeys: [{ className: "BisCore:SubCategory", id: "0x18" }],
      }]);
    });

  });

});

function printRuleset(ruleset: Ruleset) {
  if (process.env.PRINT_RULESETS) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(ruleset, undefined, 2));
  }
}
