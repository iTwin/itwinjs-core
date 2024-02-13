/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { Field, KeySet, Ruleset } from "@itwin/presentation-common";
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

  describe("Content Customization", () => {
    describe("RelatedPropertiesSpecification", () => {
      it("uses `propertiesSource` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.RelatedPropertiesSpecification.PropertiesSource.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. The produced content is customized to
        // additionally include properties of parent element by following the `bis.ElementOwnsChildElements` relationship
        // in backwards direction.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                  relatedProperties: [
                    {
                      propertiesSource: [
                        {
                          relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                          direction: "Backward",
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

        // Ensure that the custom property was created
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x12" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([
          {
            label: "Element",
            nestedFields: [
              {
                label: "Model",
              },
              {
                label: "Code",
              },
              {
                label: "User Label",
              },
            ],
          },
        ]);
      });

      it("uses `handleTargetClassPolymorphically` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.RelatedPropertiesSpecification.HandleTargetClassPolymorphically.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. The produced content is customized to
        // additionally include properties of parent element by following the `bis.ElementOwnsChildElements` relationship
        // in backwards direction. Setting `handleTargetClassPolymorphically` to `true` makes sure that the concrete target class is
        // determined and all its properties are loaded.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                  relatedProperties: [
                    {
                      propertiesSource: [
                        {
                          relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                          direction: "Backward",
                        },
                      ],
                      handleTargetClassPolymorphically: true,
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that the custom property was created
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x12" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([
          {
            label: "Subject",
            nestedFields: [
              {
                label: "Model",
              },
              {
                label: "Code",
              },
              {
                label: "User Label",
              },
              {
                label: "Description",
              },
            ],
          },
        ]);
      });

      it("uses `relationshipMeaning` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.RelatedPropertiesSpecification.RelationshipMeaning.Ruleset
        // There's a content rule for returning content of given `bis.PhysicalModel` instance. The produced content is customized to
        // additionally include properties of modeled element by following the `bis.ModelModelsElement` relationship.
        // Setting `relationshipMeaning` to `SameInstance` makes sure that all related properties are placed into a category
        // nested under the default category.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                  relatedProperties: [
                    {
                      propertiesSource: [
                        {
                          relationship: { schemaName: "BisCore", className: "ModelModelsElement" },
                          direction: "Forward",
                          targetClass: { schemaName: "BisCore", className: "PhysicalPartition" },
                        },
                      ],
                      relationshipMeaning: "SameInstance",
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that all related properties are placed into a category nested under the default category
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
          descriptor: {},
        }))!;

        const defaultCategory = content.descriptor.categories[0];
        expect(content.descriptor.fields).to.containSubset([
          {
            label: "Physical Partition",
            category: defaultCategory,
            nestedFields: [
              {
                label: "Model",
                category: {
                  parent: defaultCategory,
                },
              },
              {
                label: "Code",
                category: {
                  parent: defaultCategory,
                },
              },
              {
                label: "User Label",
                category: {
                  parent: defaultCategory,
                },
              },
              {
                label: "Description",
                category: {
                  parent: defaultCategory,
                },
              },
            ],
          },
        ]);
      });

      it("uses `properties` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.RelatedPropertiesSpecification.Properties.Ruleset
        // There's a content rule for returning content of given `bis.PhysicalModel` instance. The produced content is customized to
        // additionally include specific properties of modeled Element by following the `bis.ModelModelsElement` relationship.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                  relatedProperties: [
                    {
                      propertiesSource: [
                        {
                          relationship: { schemaName: "BisCore", className: "ModelModelsElement" },
                          direction: "Forward",
                          targetClass: { schemaName: "BisCore", className: "PhysicalPartition" },
                        },
                      ],
                      properties: ["UserLabel", "Description"],
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that the two related properties are picked up
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([
          {
            label: "Physical Partition",
            nestedFields: [
              {
                label: "User Label",
              },
              {
                label: "Description",
              },
            ],
          },
        ]);
      });

      it("uses `autoExpand` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.RelatedPropertiesSpecification.AutoExpand.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. The produced content is customized to
        // additionally include all properties of child subjects by following the `bis.SubjectOwnsSubjects` relationship and that
        // the properties should be automatically expanded.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                  relatedProperties: [
                    {
                      propertiesSource: [
                        {
                          relationship: { schemaName: "BisCore", className: "SubjectOwnsSubjects" },
                          direction: "Forward",
                        },
                      ],
                      autoExpand: true,
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure the field has `autoExpand` attribute set to `true`
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([
          {
            label: "Subject",
            autoExpand: true,
            nestedFields: [
              {
                label: "Model",
              },
              {
                label: "Code",
              },
              {
                label: "User Label",
              },
              {
                label: "Description",
              },
            ],
          },
        ]);
      });

      it("uses `skipIfDuplicate` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.RelatedPropertiesSpecification.SkipIfDuplicate.Ruleset
        // There's a content rule for returning content of given `bis.PhysicalModel` instance. There are also two specifications
        // requesting to load related properties:
        // - the one specified through a content modifier requests all properties of the target class and has `skipIfDuplicate` flag.
        // - the one specified through the content specification requests only `UserLabel` property.
        // The specification at content specification level takes precedence and loads the `UserLabel` property. The other is completely
        // ignored due to `skipIfDuplicate` attribute being set to `true`.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                  relatedProperties: [
                    {
                      propertiesSource: [
                        {
                          relationship: { schemaName: "BisCore", className: "ModelModelsElement" },
                          direction: "Forward",
                          targetClass: { schemaName: "BisCore", className: "PhysicalPartition" },
                        },
                      ],
                      properties: ["UserLabel"],
                    },
                  ],
                },
              ],
            },
            {
              ruleType: "ContentModifier",
              class: { schemaName: "BisCore", className: "Model" },
              relatedProperties: [
                {
                  propertiesSource: [
                    {
                      relationship: { schemaName: "BisCore", className: "ModelModelsElement" },
                      direction: "Forward",
                      targetClass: { schemaName: "BisCore", className: "PhysicalPartition" },
                    },
                  ],
                  skipIfDuplicate: true,
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure only one related property is loaded
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([
          {
            label: "Physical Partition",
            nestedFields: (nestedFields: Field[]) => {
              return nestedFields.length === 1 && nestedFields[0].label === "User Label";
            },
          },
        ]);
      });

      it("uses `nestedRelatedProperties` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.RelatedPropertiesSpecification.NestedRelatedProperties.Ruleset
        // There's a content rule for returning content of given `bis.PhysicalModel` instance. There's also a related properties
        // specification that loads modeled element properties and properties of `bis.LinkElement` related to the modeled element.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                  relatedProperties: [
                    {
                      propertiesSource: [
                        {
                          relationship: { schemaName: "BisCore", className: "ModelModelsElement" },
                          direction: "Forward",
                          targetClass: { schemaName: "BisCore", className: "PhysicalPartition" },
                        },
                      ],
                      nestedRelatedProperties: [
                        {
                          propertiesSource: [
                            {
                              relationship: { schemaName: "BisCore", className: "ElementHasLinks" },
                              direction: "Forward",
                              targetClass: { schemaName: "BisCore", className: "RepositoryLink" },
                            },
                          ],
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

        // Ensure properties of physical partition and repository link are loaded
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([
          {
            label: "Physical Partition",
            nestedFields: [
              {
                label: "Repository Link",
                nestedFields: [
                  {
                    label: "URL",
                  },
                ],
              },
            ],
          },
        ]);
      });

      it("uses `relationshipProperties` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.RelatedPropertiesSpecification.RelationshipProperties.Ruleset
        // There's a content rule for returning content of given `meta.ECClassDef` instance. The produced content is customized to
        // additionally include a specific relationship property of the `meta.ClassHasBaseClasses` relationship.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                  relatedProperties: [
                    {
                      propertiesSource: [
                        {
                          relationship: { schemaName: "ECDbMeta", className: "ClassHasBaseClasses" },
                          direction: "Forward",
                        },
                      ],
                      properties: ["Name"],
                      relationshipProperties: ["Ordinal"],
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that the relationship property is picked up
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "ECDbMeta:ECClassDef", id: "0x3b" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([
          {
            label: "ClassHasBaseClasses",
            nestedFields: [
              {
                label: "Ordinal",
                category: {
                  name: "ClassHasBaseClasses",
                },
              },
            ],
          },
        ]);
      });

      it("uses `forceCreateRelationshipCategory` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.RelatedPropertiesSpecification.ForceCreateRelationshipCategory.Ruleset
        // There's a content rule for returning content of given `bis.PhysicalModel` instance. The produced content is customized to
        // additionally create a category for the `bis.ModelModelsElement` relationship.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                  relatedProperties: [
                    {
                      propertiesSource: [
                        {
                          relationship: { schemaName: "BisCore", className: "ModelModelsElement" },
                          direction: "Forward",
                          targetClass: { schemaName: "BisCore", className: "PhysicalPartition" },
                        },
                      ],
                      properties: ["UserLabel"],
                      forceCreateRelationshipCategory: true,
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that the related property is categorized under relationship category.
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([
          {
            label: "Physical Partition",
            nestedFields: [
              {
                label: "User Label",
                category: {
                  name: "ModelModelsElement-PhysicalPartition",
                },
              },
            ],
          },
        ]);
      });
    });
  });
});
