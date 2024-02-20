/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModel } from "@itwin/core-common";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { KeySet, Ruleset, StandardNodeTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";
import { getFieldByLabel } from "../../Utils";
import { printRuleset } from "../Utils";

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

  describe("RelatedInstanceSpecification", () => {
    it("using in instance filter with relationship path", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RelatedInstanceSpecification.UsingInInstanceFilter.Ruleset
      // This ruleset defines a specification that returns content for `bis.ViewDefinition` instances. In addition,
      // there's a related instance specification, that describes a path to a related display style, and an
      // instance filter that filters using its property.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "Content",
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
                relatedInstances: [
                  {
                    relationshipPath: {
                      relationship: { schemaName: "BisCore", className: "ViewDefinitionUsesDisplayStyle" },
                      direction: "Forward",
                    },
                    alias: "display_style",
                    isRequired: true,
                  },
                ],
                instanceFilter: `display_style.CodeValue ~ "%View%"`,
              },
            ],
          },
        ],
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

    it("using in instance filter with target instance ids", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RelatedInstanceSpecification.UsingInInstanceFilterWithTargetInstances.Ruleset
      // This ruleset defines a specification that returns content for `bis.ViewDefinition` instances. In addition,
      // there's a related instance specification for the root Subject, and an instance filter that filters using its property.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "Content",
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
                relatedInstances: [
                  {
                    targetInstances: {
                      class: { schemaName: "BisCore", className: "Subject" },
                      instanceIds: [IModel.rootSubjectId],
                    },
                    alias: "root_subject",
                    isRequired: true,
                  },
                ],
                instanceFilter: `root_subject.Description = this.Description`,
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that 4 `bis.ViewDefinition` instances are selected.
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet(),
        descriptor: {},
      });

      expect(content!.contentSet.length).to.eq(4);
    });

    it("using for customization", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.RelatedInstanceSpecification.UsingForCustomization.Ruleset
      // This ruleset defines a specification that returns nodes for `meta.ECClassDef` instances. In addition,
      // there's a related instance specification, that describes a path to the schema that the class belongs to.
      // Finally, there's an extended data rule that sets full class name on each of the nodes. Full class name consists
      // of schema and class names and the schema instance can be referenced through the alias specified in related
      // instance specification.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "ECDbMeta", classNames: ["ECClassDef"] },
                groupByClass: false,
                groupByLabel: false,
                relatedInstances: [
                  {
                    relationshipPath: {
                      relationship: { schemaName: "ECDbMeta", className: "SchemaOwnsClasses" },
                      direction: "Backward",
                    },
                    alias: "schema",
                    isRequired: true,
                  },
                ],
              },
            ],
            customizationRules: [
              {
                ruleType: "ExtendedData",
                items: {
                  fullClassName: `schema.Name & "." & this.Name`,
                },
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // __PUBLISH_EXTRACT_START__ Presentation.RelatedInstanceSpecification.UsingForCustomization.Result
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
      // __PUBLISH_EXTRACT_START__ Presentation.RelatedInstanceSpecification.UsingForGrouping.Ruleset
      // This ruleset defines a specification that returns nodes for `meta.ECClassDef` instances. In addition,
      // there's a related instance specification, that describes a path to the schema that the class belongs to.
      // Finally, there's a grouping rule that requests grouping on `ECSchemaDef.Name` property. Because
      // the `ECClassDef` instances are "linked" to related `ECSchemaDef` instances, the grouping takes effect
      // and classes get grouped by related schema names.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "RootNodes",
            specifications: [
              {
                specType: "InstanceNodesOfSpecificClasses",
                classes: { schemaName: "ECDbMeta", classNames: ["ECClassDef"] },
                groupByClass: false,
                groupByLabel: false,
                relatedInstances: [
                  {
                    relationshipPath: {
                      relationship: { schemaName: "ECDbMeta", className: "SchemaOwnsClasses" },
                      direction: "Backward",
                    },
                    alias: "schema",
                    isRequired: true,
                  },
                ],
              },
            ],
            customizationRules: [
              {
                ruleType: "Grouping",
                class: { schemaName: "ECDbMeta", className: "ECSchemaDef" },
                groups: [
                  {
                    specType: "Property",
                    propertyName: "Name",
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

      // Every node should have its full class name in extended data
      const schemaNodes = await Presentation.presentation.getNodes({
        imodel,
        rulesetOrId: ruleset,
      });
      expect(schemaNodes.length).to.eq(18);
      await Promise.all(
        schemaNodes.map(async (schemaNode) => {
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
        }),
      );
    });
  });
});
