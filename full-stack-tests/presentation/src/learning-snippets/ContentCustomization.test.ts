/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { Field, KeySet, NestedContentField, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";
import { getFieldByLabel } from "../Utils";

describe("Learning Snippets", () => {
  describe("Content", () => {
    let imodel: IModelConnection;

    before(async () => {
      await initialize();
      imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    });

    after(async () => {
      await imodel.close();
      await terminate();
    });

    describe("Customization", () => {
      describe("DefaultPropertyCategoryOverride", () => {
        it("uses `requiredSchemas` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.DefaultPropertyCategoryOverride.RequiredSchemas.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition, there are two default
          // property category overrides:
          // - For iModels containing BisCore version 1.0.1 and older, the default property category should be "Custom Category OLD".
          // - For iModels containing BisCore version 1.0.2 and newer, the default property category should be "Custom Category NEW".
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                  },
                ],
              },
              {
                ruleType: "DefaultPropertyCategoryOverride",
                requiredSchemas: [{ name: "BisCore", maxVersion: "1.0.2" }],
                specification: {
                  id: "default",
                  label: "Custom Category OLD",
                },
              },
              {
                ruleType: "DefaultPropertyCategoryOverride",
                requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
                specification: {
                  id: "default",
                  label: "Custom Category NEW",
                },
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // The iModel uses BisCore older than 1.0.2 - we should use the "OLD" default category
          const content = await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          });
          const defaultCategory = content!.descriptor.categories.find((category) => category.name === "default");
          expect(defaultCategory).to.containSubset({
            label: "Custom Category OLD",
          });
        });

        it("uses `priority` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.DefaultPropertyCategoryOverride.Priority.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition, there are two default
          // property category overrides of different priorities. The high priority rule should take precedence.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                  },
                ],
              },
              {
                ruleType: "DefaultPropertyCategoryOverride",
                priority: 0,
                specification: {
                  id: "default",
                  label: "Low Priority",
                },
              },
              {
                ruleType: "DefaultPropertyCategoryOverride",
                priority: 9999,
                specification: {
                  id: "default",
                  label: "High Priority",
                },
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // The iModel uses BisCore older than 1.0.2 - we should use the "OLD" default category
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          const defaultCategory = content.descriptor.categories.find((category) => category.name === "default");
          expect(defaultCategory).to.containSubset({
            label: "High Priority",
          });
        });

        it("uses `specification` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.DefaultPropertyCategoryOverride.Specification.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition, there's a default property
          // category override to place properties into.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                  },
                ],
              },
              {
                ruleType: "DefaultPropertyCategoryOverride",
                specification: {
                  id: "default",
                  label: "Test Category",
                },
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure the default property category is correctly set up
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          const defaultCategory = content.descriptor.categories.find((category) => category.name === "default");
          expect(defaultCategory).to.containSubset({
            label: "Test Category",
          });
          content.descriptor.fields.forEach((field) => {
            expect(field.category).to.eq(defaultCategory);
          });
        });
      });

      describe("PropertyCategorySpecification", () => {
        it("allows referencing by `id`", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertyCategorySpecification.Id.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. The rule contains a custom
          // category specification that is referenced by properties override, putting all properties into the
          // "Custom" category.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyCategories: [
                      {
                        id: "custom-category",
                        label: "Custom",
                      },
                    ],
                    propertyOverrides: [
                      {
                        name: "*",
                        categoryId: "custom-category",
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure the field is assigned a category with correct label
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields.length).to.be.greaterThan(0);
          content.descriptor.fields.forEach((field) => {
            expect(field.category).to.containSubset({
              label: "Custom",
            });
          });
        });

        it("uses `label` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertyCategorySpecification.Label.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition,
          // it puts all properties into a custom category with "Custom Category" label.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyCategories: [
                      {
                        id: "custom-category",
                        label: "Custom Category",
                      },
                    ],
                    propertyOverrides: [
                      {
                        name: "*",
                        categoryId: "custom-category",
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure the field is assigned a category with correct label
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields.length).to.be.greaterThan(0);
          content.descriptor.fields.forEach((field) => {
            expect(field.category).to.containSubset({
              label: "Custom Category",
            });
          });
        });

        it("uses `description` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertyCategorySpecification.Description.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition, it puts
          // all properties into a custom category with a description.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyCategories: [
                      {
                        id: "custom-category",
                        label: "Custom Category",
                        description: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
                      },
                    ],
                    propertyOverrides: [
                      {
                        name: "*",
                        categoryId: "custom-category",
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertyCategorySpecification.Description.Result
          // Ensure category description is assigned
          const descriptor = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!.descriptor;
          expect(descriptor.categories).to.containSubset([
            {
              label: "Custom Category",
              description: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
            },
          ]);
          // __PUBLISH_EXTRACT_END__
        });

        it("uses `parentId` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertyCategorySpecification.ParentId.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition, it
          // puts all properties into a custom category with "Nested Category" label which in turn is put into "Root Category".
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyCategories: [
                      {
                        id: "root-category",
                        label: "Root Category",
                      },
                      {
                        id: "nested-category",
                        parentId: "root-category",
                        label: "Nested Category",
                      },
                    ],
                    propertyOverrides: [
                      {
                        name: "*",
                        categoryId: "nested-category",
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure categories' hierarchy was set up correctly
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields.length).to.be.greaterThan(0);
          content.descriptor.fields.forEach((field) => {
            expect(field.category).to.containSubset({
              label: "Nested Category",
              parent: {
                label: "Root Category",
              },
            });
          });
        });

        it("uses `priority` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertyCategorySpecification.Priority.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. The produced content
          // is customized to put `CodeValue` property into "Category A" category and `UserLabel` property into
          // "Category B" category. Both categories are assigned custom priorities.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyOverrides: [
                      {
                        name: "CodeValue",
                        categoryId: "category-a",
                      },
                      {
                        name: "UserLabel",
                        categoryId: "category-b",
                      },
                    ],
                    propertyCategories: [
                      {
                        id: "category-a",
                        label: "Category A",
                        priority: 1,
                      },
                      {
                        id: "category-b",
                        label: "Category B",
                        priority: 2,
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertyCategorySpecification.Priority.Result
          // Ensure that correct category priorities are assigned
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "Code",
              category: {
                label: "Category A",
                priority: 1,
              },
            },
          ]);
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "User Label",
              category: {
                label: "Category B",
                priority: 2,
              },
            },
          ]);
          // __PUBLISH_EXTRACT_END__
        });

        it("uses `autoExpand` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertyCategorySpecification.AutoExpand.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. The produced content
          // is customized to put all properties into a custom category which has the `autoExpand` flag.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyOverrides: [
                      {
                        name: "*",
                        categoryId: "custom-category",
                      },
                    ],
                    propertyCategories: [
                      {
                        id: "custom-category",
                        label: "Custom Category",
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

          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertyCategorySpecification.AutoExpand.Result
          // Ensure that categories have the `expand` flag
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.categories).to.containSubset([
            {
              label: "Custom Category",
              expand: true,
            },
          ]);
          // __PUBLISH_EXTRACT_END__
        });

        it("uses `renderer` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertyCategorySpecification.Renderer.Ruleset
          // There's a content rule for returning content of given instance. The produced content
          // is customized to put all properties into a custom category which uses a custom "my-category-renderer"
          // renderer.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyOverrides: [
                      {
                        name: "*",
                        categoryId: "custom-category",
                      },
                    ],
                    propertyCategories: [
                      {
                        id: "custom-category",
                        label: "Custom Category",
                        renderer: {
                          rendererName: "my-category-renderer",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertyCategorySpecification.Renderer.Result
          // Ensure that categories have the `expand` flag
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.categories).to.containSubset([
            {
              label: "Custom Category",
              renderer: {
                name: "my-category-renderer",
              },
            },
          ]);
          // __PUBLISH_EXTRACT_END__
        });
      });

      describe("PropertySpecification", () => {
        it("uses `overridesPriority` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.OverridesPriority.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition, the `UserLabel`
          // property has a couple of property overrides which set renderer, editor and label. The label is
          // overriden by both specifications and the one with higher `overridesPriority` takes precedence.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyOverrides: [
                      {
                        name: "UserLabel",
                        overridesPriority: 1,
                        labelOverride: "A",
                        renderer: {
                          rendererName: "my-renderer",
                        },
                      },
                      {
                        name: "UserLabel",
                        overridesPriority: 2,
                        labelOverride: "B",
                        editor: {
                          editorName: "my-editor",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure the `UserLabel` field is assigned attributes from both specifications
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "B",
              renderer: {
                name: "my-renderer",
              },
              editor: {
                name: "my-editor",
              },
            },
          ]);
        });

        it("uses `labelOverride` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.LabelOverride.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition, the `UserLabel`
          // property has a label override that relabels it to "Custom Label".
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyOverrides: [
                      {
                        name: "UserLabel",
                        labelOverride: "Custom Label",
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure the `UserLabel` field is assigned attributes from both specifications
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "Custom Label",
            },
          ]);
        });

        it("uses `categoryId` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.CategoryId.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition, the `UserLabel`
          // property is placed into a custom category by assigning it a `categoryId`.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyCategories: [
                      {
                        id: "custom-category",
                        label: "Custom Category",
                      },
                    ],
                    propertyOverrides: [
                      {
                        name: "UserLabel",
                        categoryId: "custom-category",
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure the `UserLabel` field has the correct category
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "User Label",
              category: {
                label: "Custom Category",
              },
            },
          ]);
        });

        it("uses `isDisplayed` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.IsDisplayed.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition,
          // the `LastMod` property, which is hidden using a custom attribute in ECSchema, is force-displayed
          // using a property override.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyOverrides: [
                      {
                        name: "LastMod",
                        isDisplayed: true,
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure the `LastMod` is there
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "Last Modified",
            },
          ]);
        });

        it("uses `doNotHideOtherPropertiesOnDisplayOverride` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.DoNotHideOtherPropertiesOnDisplayOverride.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition,
          // the `UserLabel` property is set to be displayed with `doNotHideOtherPropertiesOnDisplayOverride` flag,
          // which ensures other properties are also kept displayed.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyOverrides: [
                      {
                        name: "UserLabel",
                        isDisplayed: true,
                        doNotHideOtherPropertiesOnDisplayOverride: true,
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure the `UserLabel` property is not the only property in content
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields)
            .to.containSubset([
              {
                label: "User Label",
              },
            ])
            .and.to.have.lengthOf(4);
        });

        it("uses `renderer` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.Renderer.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition,
          // it assigns the `UserLabel` property a custom "my-renderer" renderer.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyOverrides: [
                      {
                        name: "UserLabel",
                        renderer: {
                          rendererName: "my-renderer",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.Renderer.Result
          // Ensure the `UserLabel` field is assigned the "my-renderer" renderer
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "User Label",
              renderer: {
                name: "my-renderer",
              },
            },
          ]);
          // __PUBLISH_EXTRACT_END__
        });

        it("uses `editor` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.Editor.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition,
          // it assigns the `UserLabel` property a custom "my-editor" editor.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyOverrides: [
                      {
                        name: "UserLabel",
                        editor: {
                          editorName: "my-editor",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.Editor.Result
          // Ensure the `UserLabel` field is assigned the "my-editor" editor
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "User Label",
              editor: {
                name: "my-editor",
              },
            },
          ]);
          // __PUBLISH_EXTRACT_END__
        });

        it("uses `isReadOnly` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.IsReadOnly.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition, the `UserLabel`
          // property is made read-only.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyOverrides: [
                      {
                        name: "UserLabel",
                        isReadOnly: true,
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.IsReadOnly.Result
          // Ensure the `UserLabel` field is read-only.
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "User Label",
              isReadonly: true,
            },
          ]);
          // __PUBLISH_EXTRACT_END__
        });

        it("uses `priority` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.PropertySpecification.Priority.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. In addition, the `UserLabel`
          // property's priority is set to 9999.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    propertyOverrides: [
                      {
                        name: "UserLabel",
                        priority: 9999,
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure the `UserLabel` field's priority is 9999, which makes it appear higher in the property grid.
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "User Label",
              priority: 9999,
            },
          ]);
        });
      });

      describe("CalculatedPropertiesSpecification", () => {
        it("uses `label` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.CalculatedPropertiesSpecification.Label.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. The produced content is customized to
          // additionally have a calculated "My Calculated Property" property.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    calculatedProperties: [
                      {
                        label: "My Calculated Property",
                        value: `123`,
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
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "My Calculated Property",
            },
          ]);
        });

        it("uses `value` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.CalculatedPropertiesSpecification.Value.Ruleset
          // There's a content rule for returning content of given `bis.GeometricElement3d` instance. The produced content is
          // customized to additionally have a calculated "Element Volume" property whose value is calculated based on
          // element's `BBoxHigh` and `BBoxLow` property values.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    calculatedProperties: [
                      {
                        label: "Element Volume",
                        value: "(this.BBoxHigh.x - this.BBoxLow.x) * (this.BBoxHigh.y - this.BBoxLow.y) * (this.BBoxHigh.z - this.BBoxLow.z)",
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure that the custom property was created and has a value
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "generic.PhysicalObject", id: "0x74" }]),
            descriptor: {},
          }))!;
          const field = getFieldByLabel(content.descriptor.fields, "Element Volume");
          expect(content.total).to.eq(1);
          expect((await content.items.next()).value).to.containSubset({
            values: {
              [field.name]: "3.449493952966681",
            },
          });
        });

        it("uses `priority` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.CalculatedPropertiesSpecification.Priority.Ruleset
          // There's a content rule for returning content of given `bis.Subject` instance. The produced content is customized to
          // additionally have a "My Calculated Property" property with priority set to `9999`. This should make the property
          // appear at the top in the UI, since generally properties have a priority of `1000`.
          const ruleset: Ruleset = {
            id: "example",
            rules: [
              {
                ruleType: "Content",
                specifications: [
                  {
                    specType: "SelectedNodeInstances",
                    calculatedProperties: [
                      {
                        label: "My Calculated Property",
                        value: `123`,
                        priority: 9999,
                      },
                    ],
                  },
                ],
              },
            ],
          };
          // __PUBLISH_EXTRACT_END__
          printRuleset(ruleset);

          // Ensure that the custom property has correct priority
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          expect(content.descriptor.fields).to.containSubset([
            {
              label: "My Calculated Property",
              priority: 9999,
            },
          ]);
        });
      });

      describe("RelatedPropertiesSpecification", () => {
        it("uses `propertiesSource` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.RelatedPropertiesSpecification.PropertiesSource.Ruleset
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
          const content = (await Presentation.presentation.getContentIterator({
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

        it("uses `instanceFilter` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.RelatedPropertiesSpecification.InstanceFilter.Ruleset
          // There's a content rule for returning content of given instance. The produced content is customized to
          // additionally include properties of child elements by following the `bis.ElementOwnsChildElements` relationship
          // in forward direction, but only of children whose `CodeValue` starts with a "Bis" substring.
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
                            direction: "Forward",
                          },
                        ],
                        instanceFilter: `this.CodeValue ~ "Bis%"`,
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
          const content = (await Presentation.presentation.getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          }))!;
          const childElementField = getFieldByLabel(content.descriptor.fields, "Element") as NestedContentField;
          const childElementCodeField = getFieldByLabel(childElementField.nestedFields, "Code");

          expect(content.total).to.be.greaterThan(0);
          expect((await content.items.next()).value.values[childElementField.name])
            .to.have.lengthOf(2)
            .and.to.containSubset([
              {
                primaryKeys: [{ id: "0xe" }],
                values: {
                  [childElementCodeField.name]: "BisCore.RealityDataSources",
                },
              },
              {
                primaryKeys: [{ id: "0x10" }],
                values: {
                  [childElementCodeField.name]: "BisCore.DictionaryModel",
                },
              },
            ]);
        });

        it("uses `handleTargetClassPolymorphically` attribute", async () => {
          // __PUBLISH_EXTRACT_START__ Content.Customization.RelatedPropertiesSpecification.HandleTargetClassPolymorphically.Ruleset
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
          const content = (await Presentation.presentation.getContentIterator({
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
          // __PUBLISH_EXTRACT_START__ Content.Customization.RelatedPropertiesSpecification.RelationshipMeaning.Ruleset
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
          const content = (await Presentation.presentation.getContentIterator({
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
          // __PUBLISH_EXTRACT_START__ Content.Customization.RelatedPropertiesSpecification.Properties.Ruleset
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
          const content = (await Presentation.presentation.getContentIterator({
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
          // __PUBLISH_EXTRACT_START__ Content.Customization.RelatedPropertiesSpecification.AutoExpand.Ruleset
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
          const content = (await Presentation.presentation.getContentIterator({
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
          // __PUBLISH_EXTRACT_START__ Content.Customization.RelatedPropertiesSpecification.SkipIfDuplicate.Ruleset
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
          const content = (await Presentation.presentation.getContentIterator({
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
          // __PUBLISH_EXTRACT_START__ Content.Customization.RelatedPropertiesSpecification.NestedRelatedProperties.Ruleset
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
          const content = (await Presentation.presentation.getContentIterator({
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
