/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { PropertyRecord } from "@itwin/appui-abstract";
import {
  IPropertyDataProvider, PrimitivePropertyValueRenderer, PropertyDataChangeEvent, PropertyValueRendererContext, PropertyValueRendererManager,
  VirtualizedPropertyGridWithDataProvider,
} from "@itwin/components-react";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ContentSpecificationTypes, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { render } from "@testing-library/react";
import { initialize, terminate } from "../../../IntegrationTests";
import { printRuleset } from "../../Utils";

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

  describe("Content Customization", () => {

    describe("PropertySpecification", () => {

      it("uses `overridesPriority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertySpecification.OverridesPriority.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. In addition, the `UserLabel`
        // property has a couple of property overrides which set renderer, editor and label. The label is
        // overriden by both specifications and the one with higher `overridesPriority` takes precedence.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              propertyOverrides: [{
                name: "UserLabel",
                overridesPriority: 1,
                labelOverride: "A",
                renderer: {
                  rendererName: "my-renderer",
                },
              }, {
                name: "UserLabel",
                overridesPriority: 2,
                labelOverride: "B",
                editor: {
                  editorName: "my-editor",
                },
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure the `UserLabel` field is assigned attributes from both specifications
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([{
          label: "B",
          renderer: {
            name: "my-renderer",
          },
          editor: {
            name: "my-editor",
          },
        }]);
      });

      it("uses `labelOverride` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertySpecification.LabelOverride.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. In addition, the `UserLabel`
        // property has a label override that relabels it to "Custom Label".
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              propertyOverrides: [{
                name: "UserLabel",
                labelOverride: "Custom Label",
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure the `UserLabel` field is assigned attributes from both specifications
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([{
          label: "Custom Label",
        }]);
      });

      it("uses `categoryId` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertySpecification.CategoryId.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. In addition, the `UserLabel`
        // property is placed into a custom category by assigning it a `categoryId`.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              propertyCategories: [{
                id: "custom-category",
                label: "Custom Category",
              }],
              propertyOverrides: [{
                name: "UserLabel",
                categoryId: "custom-category",
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure the `UserLabel` field has the correct category
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([{
          label: "User Label",
          category: {
            label: "Custom Category",
          },
        }]);
      });

      it("uses `isDisplayed` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertySpecification.IsDisplayed.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. In addition,
        // the `LastMod` property, which is hidden using a custom attribute in ECSchema, is force-displayed
        // using a property override.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              propertyOverrides: [{
                name: "LastMod",
                isDisplayed: true,
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure the `LastMod` is there
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([{
          label: "Last Modified",
        }]);
      });

      it("uses `doNotHideOtherPropertiesOnDisplayOverride` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertySpecification.DoNotHideOtherPropertiesOnDisplayOverride.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. In addition,
        // the `UserLabel` property is set to be displayed with `doNotHideOtherPropertiesOnDisplayOverride` flag,
        // which ensures other properties are also kept displayed.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              propertyOverrides: [{
                name: "UserLabel",
                isDisplayed: true,
                doNotHideOtherPropertiesOnDisplayOverride: true,
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure the `UserLabel` property is not the only property in content
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([{
          label: "User Label",
        }]).and.to.have.lengthOf(4);
      });

      it("uses `renderer` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertySpecification.Renderer.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. In addition,
        // it assigns the `CodeValue` property a custom "my-renderer" renderer.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              propertyOverrides: [{
                name: "CodeValue",
                renderer: {
                  rendererName: "my-renderer",
                },
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertySpecification.Renderer.Result
        // Ensure the `CodeValue` field is assigned the "my-renderer" renderer
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([{
          label: "Code",
          renderer: {
            name: "my-renderer",
          },
        }]);
        // __PUBLISH_EXTRACT_END__

        try {
          // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertySpecification.Renderer.Register
          // The custom renderer renders the property value in red
          PropertyValueRendererManager.defaultManager.registerRenderer("my-renderer", {
            canRender: () => true,
            render: function myRenderer(record: PropertyRecord, ctx?: PropertyValueRendererContext) {
              const defaultRenderer = new PrimitivePropertyValueRenderer();
              return defaultRenderer.render(record, { ...ctx, style: { ...ctx?.style, color: "red" } });
            },
          });
          // __PUBLISH_EXTRACT_END__

          const dataProvider = new PresentationPropertyDataProvider({ imodel, ruleset });
          dataProvider.keys = new KeySet([{ className: "BisCore:Subject", id: "0x1" }]);
          const expandedDataProvider: IPropertyDataProvider = {
            onDataChanged: new PropertyDataChangeEvent(),
            getData: async () => {
              const data = await dataProvider.getData();
              data.categories.forEach((c) => c.expand = true);
              return data;
            },
          };
          const { findAllByText } = render(
            <VirtualizedPropertyGridWithDataProvider
              dataProvider={expandedDataProvider}
              width={500}
              height={1200}
            />,
          );
          const renderedElements = await findAllByText("DgnV8Bridge");
          expect(renderedElements[0].style.color).to.eq("red");
        } finally {
          PropertyValueRendererManager.defaultManager.unregisterRenderer("my-renderer");
        }
      });

      it("uses `editor` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertySpecification.Editor.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. In addition,
        // it assigns the `UserLabel` property a custom "my-editor" editor.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              propertyOverrides: [{
                name: "UserLabel",
                editor: {
                  editorName: "my-editor",
                },
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.PropertySpecification.Editor.Result
        // Ensure the `UserLabel` field is assigned the "my-editor" editor
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([{
          label: "User Label",
          editor: {
            name: "my-editor",
          },
        }]);
        // __PUBLISH_EXTRACT_END__
      });

    });

  });

});
