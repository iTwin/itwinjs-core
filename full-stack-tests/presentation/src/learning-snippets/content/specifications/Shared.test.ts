/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { KeySet, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../../IntegrationTests";
import { getFieldByLabel } from "../../../Utils";
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

  describe("Content Specifications", () => {
    describe("Shared attributes", () => {
      it("uses `onlyIfNotHandled` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.SharedAttributes.OnlyIfNotHandled.Ruleset
        // This ruleset defines two specifications that return content for `bis.ViewDefinition` and `bis.PhysicalModel`
        // instances respectively.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
                },
                // The following specification is defined second so it's lower in priority. Because it has `onlyIfNotHandled` attribute,
                // it's overriden by the specification above.
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["PhysicalModel"], arePolymorphic: true },
                  onlyIfNotHandled: true,
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that only `bis.ViewDefinition` instances are selected.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.total).to.eq(4);
        const field = getFieldByLabel(content!.descriptor.fields, "Category Selector");
        for await (const record of content!.items) {
          expect(record.displayValues[field.name]).to.be.string("Default - View");
        }
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.SharedAttributes.Priority.Ruleset
        // Specifications to return content for `bis.PhysicalModel` and `bis.DictionaryModel` respectively.
        // The `bis.PhysicalModel` specification has lower priority so it's displayed after the
        // higher priority specification.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["PhysicalModel"] },
                  priority: 0,
                },
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["DictionaryModel"] },
                  priority: 1,
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that only `bis.ViewDefinition` instances are selected.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        const { total, items, descriptor } = content!;
        expect(total).to.eq(2);
        const field = getFieldByLabel(descriptor.fields, "Modeled Element");
        expect((await items.next()).value.displayValues[field.name]).to.eq("BisCore.DictionaryModel");
        expect((await items.next()).value.displayValues[field.name]).to.eq("Properties_60InstancesWithUrl2");
      });

      it("uses `relatedProperties` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.SharedAttributes.RelatedProperties.Ruleset
        // This ruleset returns content for `bis.SpatialViewDefinition`, which includes all properties from related `bis.DisplayStyle` instances.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
                  relatedProperties: [
                    {
                      propertiesSource: {
                        relationship: { schemaName: "BisCore", className: "ViewDefinitionUsesDisplayStyle" },
                        direction: "Forward",
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

        // Ensure that derived `bis.DisplayStyle` instance properties are also returned with `bis.SpatialViewDefinition` content.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        const { total, descriptor } = content!;
        expect(total).to.eq(4);
        expect(descriptor.fields)
          .to.containSubset([
            {
              label: "Display Style",
              nestedFields: [{ label: "Model" }, { label: "Code" }, { label: "User Label" }, { label: "Is Private" }],
            },
          ])
          .and.to.have.lengthOf(18);
      });

      it("uses `calculatedProperties` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.SharedAttributes.CalculatedProperties.Ruleset
        // In addition to returning content for all `bis.SpatialViewDefinition` instances, this ruleset also adds a
        // custom `Camera view direction` property to each instance.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
                  calculatedProperties: [
                    {
                      label: "Camera view direction",
                      value: 'IIf (this.pitch >= 10, "Vertical upwards", IIf (this.pitch <= -10, "Vertical downwards", "Horizontal"))',
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that derived `bis.DisplayStyle` instance properties are also returned with `bis.SpatialViewDefinition` content.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.total).to.eq(4);
        expect(content!.descriptor.fields)
          .to.containSubset([{ label: "Camera view direction" }])
          .and.to.have.lengthOf(18);
      });

      it("uses `propertyCategories` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.SharedAttributes.PropertyCategories.Ruleset
        // This ruleset places camera-related `bis.SpatialViewDefinition` properties inside a custom category.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
                  propertyCategories: [
                    {
                      id: "camera_category",
                      label: "Camera settings",
                      autoExpand: true,
                    },
                  ],
                  propertyOverrides: [
                    { name: "EyePoint", categoryId: "camera_category" },
                    { name: "FocusDistance", categoryId: "camera_category" },
                    { name: "IsCameraOn", categoryId: "camera_category" },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that the returned content has a custom category `Camera settings` and it contains the right properties.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.descriptor.categories).containSubset([{ label: "Camera settings" }]);
        expect(content!.descriptor.fields).to.containSubset([
          {
            label: "Eye Point",
            category: { label: "Camera settings" },
          },
          {
            label: "Focus Distance",
            category: { label: "Camera settings" },
          },
          {
            label: "Is Camera On",
            category: { label: "Camera settings" },
          },
        ]);
      });

      it("uses `propertyOverrides` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.SharedAttributes.PropertyOverrides.Ruleset
        // The specification returns content for `bis.ViewDefinition` with one
        // overriden property label.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
                  propertyOverrides: [{ name: "Model", labelOverride: "Container Model" }],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that the returned content has an overriden property label `Container Model`.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.total).to.eq(4);
        expect(content!.descriptor.fields)
          .to.containSubset([
            { label: "Category Selector" },
            { label: "Code" },
            { label: "Container Model" },
            { label: "Description" },
            { label: "Display Style" },
            { label: "Is Private" },
            { label: "User Label" },
          ])
          .and.to.have.lengthOf(7);
      });

      it("uses `relatedInstances` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.SharedAttributes.RelatedInstances.Ruleset
        // The specification returns content for `bis.ModelSelector` filtered by related
        // `bis.SpatialViewDefinition` instance `Yaw` property value.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["ModelSelector"], arePolymorphic: true },
                  relatedInstances: [
                    {
                      relationshipPath: { relationship: { schemaName: "BisCore", className: "SpatialViewDefinitionUsesModelSelector" }, direction: "Backward" },
                      alias: "relatedInstance",
                    },
                  ],
                  instanceFilter: "relatedInstance.Yaw > 0",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure only the `bis.ModelSelector` whose related SpatialViewDefinition with Yaw > 0 is returned.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.total).to.eq(1);
        const field = getFieldByLabel(content!.descriptor.fields, "Code");
        expect((await content!.items.next()).value.values[field.name]).to.eq("Default - View 2");
      });
    });
  });
});
