/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { KeySet, Ruleset } from "@itwin/presentation-common";
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
    describe("PropertyCategorySpecification", () => {
      it("allows referencing by `id`", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertyCategorySpecification.Id.Ruleset
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
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertyCategorySpecification.Label.Ruleset
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
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertyCategorySpecification.Description.Ruleset
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

        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertyCategorySpecification.Description.Result
        // Ensure category description is assigned
        const content = (await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.categories).to.containSubset([
          {
            label: "Custom Category",
            description: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
          },
        ]);
        // __PUBLISH_EXTRACT_END__
      });

      it("uses `parentId` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertyCategorySpecification.ParentId.Ruleset
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
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertyCategorySpecification.Priority.Ruleset
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

        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertyCategorySpecification.Priority.Result
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
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertyCategorySpecification.AutoExpand.Ruleset
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

        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertyCategorySpecification.AutoExpand.Result
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
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertyCategorySpecification.Renderer.Ruleset
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

        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertyCategorySpecification.Renderer.Result
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
  });
});
