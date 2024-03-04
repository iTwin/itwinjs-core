/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { KeySet, NestedContentValue, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../../IntegrationTests";
import { collect, getFieldByLabel, getFieldsByLabel, tryGetFieldByLabel } from "../../../Utils";
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

  describe("Content Rules", () => {
    describe("ContentModifier", () => {
      it("uses `class` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentModifier.Class.Ruleset
        // The ruleset has a content rule that returns content of all `bis.SpatialCategory` and `bis.GeometricModel`
        // instances.There's also a content modifier that creates a custom calculated property only for `bis.Category` instances.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  // load content for all `bis.SpatialCategory` and `bis.GeometricModel` instances
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialCategory", "GeometricModel"], arePolymorphic: true },
                },
              ],
            },
            {
              ruleType: "ContentModifier",
              class: { schemaName: "BisCore", className: "Category" },
              calculatedProperties: [
                {
                  label: "Calculated",
                  value: `"PREFIX_" & this.CodeValue`,
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure only the `bis.Category` instance has the calculated property
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.descriptor.fields)
          .to.containSubset([
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
              label: "Is Private",
            },
            {
              label: "Calculated",
            },
            {
              label: "Modeled Element",
            },
          ])
          .and.to.have.lengthOf(6);
        const calculatedField = tryGetFieldByLabel(content!.descriptor.fields, "Calculated");

        const items = await collect(content!.items);
        expect(items[0].displayValues[calculatedField!.name]).to.be.undefined;
        expect(items[1].displayValues[calculatedField!.name]).to.eq("PREFIX_Uncategorized");
      });

      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentModifier.RequiredSchemas.Ruleset
        // The ruleset has a content rule that returns content of given input instances. There's also
        // a content modifier that tells us to load `bis.ExternalSourceAspect` related properties, but the
        // ECClass was introduced in BisCore version 1.0.2, so the modifier needs a `requiredSchemas` attribute
        // to only use the rule if the version meets the requirement.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  // load content for given input instances
                  specType: "SelectedNodeInstances",
                },
              ],
            },
            {
              ruleType: "ContentModifier",
              requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
              class: { schemaName: "BisCore", className: "ExternalSourceAspect" },
              relatedProperties: [
                {
                  // request to include properties of related ExternalSourceAspect instances
                  propertiesSource: {
                    relationship: { schemaName: "BisCore", className: "ElementOwnsMultiAspects" },
                    direction: "Forward",
                    targetClass: { schemaName: "BisCore", className: "ExternalSourceAspect" },
                  },
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // The iModel uses BisCore older than 1.0.2 - the returned content should not
        // include ExternalSourceAspect properties
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Element", id: "0x61" }]),
          descriptor: {},
        });
        expect(content!.descriptor.fields)
          .to.not.containSubset([
            {
              label: "External Source Aspect",
            },
          ])
          .and.to.have.lengthOf(1);
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentModifier.Priority.Ruleset
        // The ruleset has a content rule that returns content of all `bis.SpatialCategory`
        // instances.There's also a content modifier that tells us to hide all properties
        // of `bis.Element` instances and a higher priority modifier that tells us to show
        // its `CodeValue` property.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  // load content of all `bis.SpatialCategory` instances
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialCategory"], arePolymorphic: true },
                },
              ],
            },
            {
              ruleType: "ContentModifier",
              class: { schemaName: "BisCore", className: "SpatialCategory" },
              priority: 1,
              propertyOverrides: [
                {
                  // hide all properties
                  name: "*",
                  isDisplayed: false,
                },
              ],
            },
            {
              ruleType: "ContentModifier",
              class: { schemaName: "BisCore", className: "SpatialCategory" },
              priority: 2,
              propertyOverrides: [
                {
                  // display the CodeValue property
                  name: "CodeValue",
                  isDisplayed: true,
                  doNotHideOtherPropertiesOnDisplayOverride: true,
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Expect to get one `bis.SpatialCategory` field and one related content field.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content!.total).to.eq(1);
        expect(content!.descriptor.fields)
          .to.containSubset([
            {
              label: "Code",
            },
          ])
          .and.to.have.lengthOf(1);
      });

      it("uses 'applyOnNestedContent' attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentModifier.ApplyOnNestedContent.Ruleset
        // The ruleset has a content rule that returns content of given input instances. The produced content
        // additionally include properties of parent element by following the `bis.SpatialViewDefinitionUsesModelSelector`
        // relationship. There's also a content modifier that includes properties of the related `DisplayStyle` and
        // creates a calculated property for nested `bis.SpatialViewDefinition`.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  // load content for given input instances
                  specType: "SelectedNodeInstances",
                  relatedProperties: [
                    {
                      propertiesSource: {
                        relationship: {
                          schemaName: "BisCore",
                          className: "SpatialViewDefinitionUsesModelSelector",
                        },
                        direction: "Backward",
                      },
                    },
                  ],
                },
              ],
            },
            {
              // add a content modifier for `SpatialViewDefinition` elements
              ruleType: "ContentModifier",
              class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              relatedProperties: [
                {
                  propertiesSource: {
                    relationship: {
                      schemaName: "BisCore",
                      className: "ViewDefinitionUsesDisplayStyle",
                    },
                    direction: "Forward",
                  },
                },
              ],
              calculatedProperties: [
                {
                  label: "Calculated for SpatialViewDefinition",
                  value: "this.Pitch",
                },
              ],
              // set `applyOnNestedContent: true` to get this modifier applied when `SpatialViewDefinition` content is loaded indirectly
              applyOnNestedContent: true,
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:ModelSelector", id: "0x35" }]),
          descriptor: {},
        });

        expect(content!.total).to.eq(1);
        expect(content!.descriptor.fields).to.containSubset([
          { label: "Model" },
          { label: "Is Private" },
          { label: "User Label" },
          {
            label: "Spatial View Definition",
            nestedFields: [
              { label: "Model" },
              { label: "Is Private" },
              { label: "User Label" },
              {
                label: "Calculated for SpatialViewDefinition",
                category: { name: "SpatialViewDefinition" },
              },
              {
                label: "Display Style",
                category: { name: "SpatialViewDefinition-DisplayStyle" },
                nestedFields: [{ label: "Model" }, { label: "Is Private" }, { label: "Code" }, { label: "User Label" }],
              },
            ],
          },
        ]);
        const spatialViewDefinition = (await content!.items.next()).value.values[
          getFieldByLabel(content!.descriptor.fields, "Spatial View Definition").name
        ] as NestedContentValue[];
        expect(spatialViewDefinition.length).to.eq(1);
        expect(spatialViewDefinition[0].values[getFieldByLabel(content!.descriptor.fields, "Calculated for SpatialViewDefinition").name]).to.not.be.empty;
        const nestedDisplayStyle = getFieldsByLabel(content!.descriptor.fields, "Display Style").find((field) => field.isNestedContentField());
        const displayStyle = spatialViewDefinition[0].values[nestedDisplayStyle!.name] as NestedContentValue[];
        expect(displayStyle.length).to.eq(1);
        expect(displayStyle[0].values).to.not.be.empty;
      });

      it("uses `relatedProperties` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentModifier.RelatedProperties.Ruleset
        // The ruleset has a content rule that returns content of given input instances. There's also
        // a content modifier that includes properties of the related `bis.Category` for all `bis.GeometricElement3d`
        // instances' content.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  // load content for given input instances
                  specType: "SelectedNodeInstances",
                },
              ],
            },
            {
              ruleType: "ContentModifier",
              class: { schemaName: "BisCore", className: "GeometricElement3d" },
              relatedProperties: [
                {
                  propertiesSource: {
                    relationship: { schemaName: "BisCore", className: "GeometricElement3dIsInCategory" },
                    direction: "Forward",
                  },
                  handleTargetClassPolymorphically: true,
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure content contains Category's properties
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Element", id: "0x61" }]),
          descriptor: {},
        });
        expect(content!.total).to.eq(1);
        expect(content!.descriptor.fields).to.containSubset([
          {
            label: "Spatial Category",
            nestedFields: [{ label: "Code" }, { label: "Is Private" }, { label: "Model" }, { label: "User Label" }],
          },
        ]);
      });

      it("uses `calculatedProperties` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentModifier.CalculatedProperties.Ruleset
        // The ruleset has a content rule that returns content of given input instances. There's also
        // a content modifier that creates a calculated property for `bis.GeometricElement3d` instances.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  // load content for given input instances
                  specType: "SelectedNodeInstances",
                },
              ],
            },
            {
              ruleType: "ContentModifier",
              class: { schemaName: "BisCore", className: "GeometricElement3d" },
              calculatedProperties: [
                {
                  label: "Yaw & Pitch & Roll",
                  value: `this.Yaw & " & " & this.Pitch & " & " & this.Roll`,
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure content contains the calculated property and correct value
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Element", id: "0x61" }]),
          descriptor: {},
        });
        expect(content!.descriptor.fields).to.containSubset([
          {
            label: "Yaw & Pitch & Roll",
          },
        ]);
        expect(content!.total).to.eq(1);
        expect((await content!.items.next()).value.displayValues[getFieldByLabel(content!.descriptor.fields, "Yaw & Pitch & Roll").name]).to.eq(
          "0.000000 & 0.000000 & 90.000000",
        );
      });

      it("uses `propertyCategories` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentModifier.PropertyCategories.Ruleset
        // The ruleset has a content rule that returns content of given input instances. There's also
        // a content modifier that moves all `bis.GeometricElement3d` properties into a custom category.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  // load content for given input instances
                  specType: "SelectedNodeInstances",
                },
              ],
            },
            {
              ruleType: "ContentModifier",
              class: { schemaName: "BisCore", className: "GeometricElement3d" },
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
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure all `bis.GeometricElement3d` properties are in the custom category
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Element", id: "0x61" }]),
          descriptor: {},
        });
        expect(content!.descriptor.fields).to.containSubset([
          {
            label: "Category",
            category: { label: "Custom Category" },
          },
          {
            label: "Code",
            category: { label: "Custom Category" },
          },
          {
            label: "Model",
            category: { label: "Custom Category" },
          },
          {
            label: "User Label",
            category: { label: "Custom Category" },
          },
        ]);
      });

      it("uses `propertyOverrides` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentModifier.PropertyOverrides.Ruleset
        // The ruleset has a content rule that returns content of given input instances. There's also
        // a content modifier that customizes display of `bis.GeometricElement3d` properties.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  // load content for given input instances
                  specType: "SelectedNodeInstances",
                },
              ],
            },
            {
              ruleType: "ContentModifier",
              class: { schemaName: "BisCore", className: "GeometricElement3d" },
              propertyOverrides: [
                {
                  // force hide the UserLabel property
                  name: "UserLabel",
                  isDisplayed: false,
                },
                {
                  // force show the Parent property which is hidden by default through ECSchema
                  name: "Parent",
                  isDisplayed: true,
                  doNotHideOtherPropertiesOnDisplayOverride: true,
                },
                {
                  // override label of CodeValue property
                  name: "CodeValue",
                  labelOverride: "Overriden Label",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure customizations have been made
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Element", id: "0x61" }]),
          descriptor: {},
        });
        expect(content!.descriptor.fields.length).to.eq(20);
        expect(tryGetFieldByLabel(content!.descriptor.fields, "User Label")).to.be.undefined;
        expect(tryGetFieldByLabel(content!.descriptor.fields, "Parent")).to.not.be.undefined;
        expect(tryGetFieldByLabel(content!.descriptor.fields, "Overriden Label")).to.not.be.undefined;
      });
    });
  });
});
