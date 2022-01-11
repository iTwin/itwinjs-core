/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ContentSpecificationTypes, KeySet, NestedContentField, RelationshipDirection, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";
import { getFieldByLabel, tryGetFieldByLabel } from "../Utils";

describe("Learning Snippets", () => {

  describe("Rules", () => {

    describe("ContentRule", () => {

      let imodel: IModelConnection;

      beforeEach(async () => {
        await initialize();
        imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
      });

      afterEach(async () => {
        await imodel.close();
        await terminate();
      });

      it("uses `SelectedNode` symbol in rule condition", async () => {
        // __PUBLISH_EXTRACT_START__ ContentRule.Condition.SelectedNodeSymbol
        // The ruleset has two content rules:
        // - the one for `bis.Element` returns content for input instances
        // - the one for `bis.Model` returns content for input model's contained elements
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            condition: `SelectedNode.IsOfClass("Element", "BisCore")`,
            specifications: [{
              specType: ContentSpecificationTypes.SelectedNodeInstances,
            }],
          }, {
            ruleType: RuleTypes.Content,
            condition: `SelectedNode.IsOfClass("Model", "BisCore")`,
            specifications: [{
              specType: ContentSpecificationTypes.ContentRelatedInstances,
              relationshipPaths: [{
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Forward,
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Expect element content when providing `bis.Element` input
        const elementContent = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]),
          descriptor: {},
        });
        expect(elementContent!.contentSet.length).to.eq(1);
        expect(elementContent!.contentSet[0].primaryKeys).to.deep.eq([{ className: "Generic:PhysicalObject", id: "0x74" }]);

        const modelContent = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
          descriptor: {},
        });
        expect(modelContent!.contentSet.length).to.eq(62);
      });

      it("uses ruleset variables in rule condition", async () => {
        // __PUBLISH_EXTRACT_START__ ContentRule.Condition.RulesetVariables.Ruleset
        // The ruleset has two content rules that return content for `bis.SpatialCategory` and `bis.GeometricModel` instances. Both
        // rules can be enabled or disabled with a ruleset variable.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            condition: `GetVariableBoolValue("DISPLAY_CATEGORIES")`,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialCategory"] },
              handleInstancesPolymorphically: true,
            }],
          }, {
            ruleType: RuleTypes.Content,
            condition: `GetVariableBoolValue("DISPLAY_MODELS")`,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricModel"] },
              handleInstancesPolymorphically: true,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // No variables set - no content
        let content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content).to.be.undefined;

        // Set DISPLAY_CATEGORIES to get content of all Category instances in the imodel
        await Presentation.presentation.vars(ruleset.id).setBool("DISPLAY_CATEGORIES", true);
        content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content!.contentSet).to.containSubset([{
          primaryKeys: [{ className: "BisCore:SpatialCategory", id: "0x17" }],
        }]).and.to.have.lengthOf(1);

        // Set DISPLAY_MODELS to also get geometric model instances' content
        await Presentation.presentation.vars(ruleset.id).setBool("DISPLAY_MODELS", true);
        content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content!.contentSet).to.containSubset([{
          primaryKeys: [{ className: "BisCore:SpatialCategory", id: "0x17" }],
        }, {
          primaryKeys: [{ className: "BisCore:PhysicalModel", id: "0x1c" }],
        }]).and.to.have.lengthOf(2);
      });

      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentRule.RequiredSchemas.Ruleset
        // The ruleset has one content rule that returns content of `bis.ExternalSourceAspect` instances. The
        // ECClass was introduced in BisCore version 1.0.2, so the rule needs a `requiredSchemas` attribute
        // to only use the rule if the version meets the requirement.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: [{
                schemaName: "BisCore",
                classNames: ["ExternalSourceAspect"],
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // The iModel uses BisCore older than 1.0.2 - no content should be returned
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content).to.be.undefined;
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentRule.Priority.Ruleset
        // The ruleset has two content rules that return content for `bis.SpatialCategory` and
        // `bis.GeometricModel` respectively. The rules have different priorities and higher priority
        // rule is handled first - it's content appears first.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            priority: 1,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialCategory"] },
              handleInstancesPolymorphically: true,
            }],
          }, {
            ruleType: RuleTypes.Content,
            priority: 2,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricModel"] },
              handleInstancesPolymorphically: true,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Expect GeometricModel record to be first even though category rule was defined first
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content!.contentSet).to.containSubset([{
          primaryKeys: [{ className: "BisCore:PhysicalModel", id: "0x1c" }],
        }, {
          primaryKeys: [{ className: "BisCore:SpatialCategory", id: "0x17" }],
        }]).and.to.have.lengthOf(2);
      });

      it("uses `onlyIfNotHandled` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentRule.OnlyIfNotHandled.Ruleset
        // The ruleset has two root node rules that return content for `bis.SpatialCategory` and
        // `bis.GeometricModel` respectively. The `bis.SpatialCategory` rule has lower priority and `onlyIfNotHandled`
        // attribute, which allows it to be overriden by higher priority rules.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            priority: 1,
            onlyIfNotHandled: true,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialCategory"] },
              handleInstancesPolymorphically: true,
            }],
          }, {
            ruleType: RuleTypes.Content,
            priority: 2,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["GeometricModel"] },
              handleInstancesPolymorphically: true,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Expect only `GeometricModel` record, as the rule for `SpatialCategory` is skipped due to `onlyIfNotHandled` attribute
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content!.contentSet).to.containSubset([{
          primaryKeys: [{ className: "BisCore:PhysicalModel", id: "0x1c" }],
        }]).and.to.have.lengthOf(1);
      });

    });

    describe("ContentModifier", () => {

      let imodel: IModelConnection;

      beforeEach(async () => {
        await initialize();
        imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
      });

      afterEach(async () => {
        await imodel.close();
        await terminate();
      });

      it("uses `class` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentModifier.Class.Ruleset
        // The ruleset has a content rule that returns content of all `bis.SpatialCategory` and `bis.GeometricModel`
        // instances.There's also a content modifier that creates a custom calculated property only for `bis.Category` instances.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              // load content for all `bis.SpatialCategory` and `bis.GeometricModel` instances
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialCategory", "GeometricModel"] },
              handleInstancesPolymorphically: true,
            }],
          }, {
            ruleType: RuleTypes.ContentModifier,
            class: { schemaName: "BisCore", className: "Category" },
            calculatedProperties: [{
              label: "Calculated",
              value: `"PREFIX_" & this.CodeValue`,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure only the `bis.Category` instance has the calculated property
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content!.descriptor.fields).to.containSubset([{
          label: "Model",
        }, {
          label: "Code",
        }, {
          label: "User Label",
        }, {
          label: "Is Private",
        }, {
          label: "Calculated",
        }, {
          label: "Modeled Element",
        }]).and.to.have.lengthOf(6);
        const calculatedField = tryGetFieldByLabel(content!.descriptor.fields, "Calculated");
        expect(content!.contentSet[0].displayValues[calculatedField!.name]).to.be.undefined;
        expect(content!.contentSet[1].displayValues[calculatedField!.name]).to.eq("PREFIX_Uncategorized");
      });

      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentModifier.RequiredSchemas.Ruleset
        // The ruleset has a content rule that returns content of given input instances. There's also
        // a content modifier that tells us to load `bis.ExternalSourceAspect` related properties, but the
        // ECClass was introduced in BisCore version 1.0.2, so the modifier needs a `requiredSchemas` attribute
        // to only use the rule if the version meets the requirement.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              // load content for given input instances
              specType: ContentSpecificationTypes.SelectedNodeInstances,
            }],
          }, {
            ruleType: RuleTypes.ContentModifier,
            requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
            class: { schemaName: "BisCore", className: "ExternalSourceAspect" },
            relatedProperties: [{
              // request to include properties of related ExternalSourceAspect instances
              propertiesSource: {
                relationship: { schemaName: "BisCore", className: "ElementOwnsMultiAspects" },
                direction: RelationshipDirection.Forward,
                targetClass: { schemaName: "BisCore", className: "ExternalSourceAspect" },
              },
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // The iModel uses BisCore older than 1.0.2 - the returned content should not
        // include ExternalSourceAspect properties
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Element", id: "0x61" }]),
          descriptor: {},
        });
        expect(content!.descriptor.fields).to.not.containSubset([{
          label: "External Source Aspect",
        }]).and.to.have.lengthOf(1);
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentModifier.Priority.Ruleset
        // The ruleset has a content rule that returns content of all `bis.SpatialCategory`
        // instances.There's also a content modifier that tells us to hide all properties
        // of `bis.Element` instances and a higher priority modifier that tells us to show
        // its `CodeValue` property.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              // load content of all `bis.SpatialCategory` instances
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialCategory"] },
              handleInstancesPolymorphically: true,
            }],
          }, {
            ruleType: RuleTypes.ContentModifier,
            class: { schemaName: "BisCore", className: "SpatialCategory" },
            priority: 1,
            propertyOverrides: [{
              // hide all properties
              name: "*",
              isDisplayed: false,
            }],
          }, {
            ruleType: RuleTypes.ContentModifier,
            class: { schemaName: "BisCore", className: "SpatialCategory" },
            priority: 2,
            propertyOverrides: [{
              // display the CodeValue property
              name: "CodeValue",
              isDisplayed: true,
              doNotHideOtherPropertiesOnDisplayOverride: true,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Expect to get one `bis.SpatialCategory` field and one related content field
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content!.contentSet.length).to.eq(1);
        expect(content!.descriptor.fields).to.containSubset([{
          label: "Code",
        }]).and.to.have.lengthOf(1);
      });

      it("uses `relatedProperties` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentModifier.RelatedProperties.Ruleset
        // The ruleset has a content rule that returns content of given input instances. There's also
        // a content modifier that includes properties of the related `bis.Category` for all `bis.GeometricElement3d`
        // instances' content.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              // load content for given input instances
              specType: ContentSpecificationTypes.SelectedNodeInstances,
            }],
          }, {
            ruleType: RuleTypes.ContentModifier,
            class: { schemaName: "BisCore", className: "GeometricElement3d" },
            relatedProperties: [{
              propertiesSource: {
                relationship: { schemaName: "BisCore", className: "GeometricElement3dIsInCategory" },
                direction: RelationshipDirection.Forward,
              },
              handleTargetClassPolymorphically: true,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure content contains Category's properties
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Element", id: "0x61" }]),
          descriptor: {},
        });
        expect(content!.contentSet.length).to.eq(1);
        expect(content!.descriptor.fields).to.containSubset([{
          label: "Spatial Category",
          nestedFields: [{ label: "Code" }, { label: "Is Private" }, { label: "Model" }, { label: "User Label" }],
        }]);
      });

      it("uses `calculatedProperties` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentModifier.CalculatedProperties.Ruleset
        // The ruleset has a content rule that returns content of given input instances. There's also
        // a content modifier that creates a calculated property for `bis.GeometricElement3d` instances.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              // load content for given input instances
              specType: ContentSpecificationTypes.SelectedNodeInstances,
            }],
          }, {
            ruleType: RuleTypes.ContentModifier,
            class: { schemaName: "BisCore", className: "GeometricElement3d" },
            calculatedProperties: [{
              label: "Yaw & Pitch & Roll",
              value: `this.Yaw & " & " & this.Pitch & " & " & this.Roll`,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure content contains the calculated property and correct value
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Element", id: "0x61" }]),
          descriptor: {},
        });
        expect(content!.descriptor.fields).to.containSubset([{
          label: "Yaw & Pitch & Roll",
        }]);
        expect(content!.contentSet.length).to.eq(1);
        expect(content!.contentSet[0].displayValues[getFieldByLabel(content!.descriptor.fields, "Yaw & Pitch & Roll").name]).to.eq("0.000000 & 0.000000 & 90.000000");
      });

      it("uses `propertyCategories` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentModifier.PropertyCategories.Ruleset
        // The ruleset has a content rule that returns content of given input instances. There's also
        // a content modifier that moves all `bis.GeometricElement3d` properties into a custom category.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              // load content for given input instances
              specType: ContentSpecificationTypes.SelectedNodeInstances,
            }],
          }, {
            ruleType: RuleTypes.ContentModifier,
            class: { schemaName: "BisCore", className: "GeometricElement3d" },
            propertyCategories: [{
              id: "custom-category",
              label: "Custom Category",
            }],
            propertyOverrides: [{
              name: "*",
              categoryId: "custom-category",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure all `bis.GeometricElement3d` properties are in the custom category
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Element", id: "0x61" }]),
          descriptor: {},
        });
        expect(content!.descriptor.fields).to.containSubset([{
          label: "Category",
          category: { label: "Custom Category" },
        }, {
          label: "Code",
          category: { label: "Custom Category" },
        }, {
          label: "Model",
          category: { label: "Custom Category" },
        }, {
          label: "User Label",
          category: { label: "Custom Category" },
        }]);
      });

      it("uses `propertyOverrides` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentModifier.PropertyOverrides.Ruleset
        // The ruleset has a content rule that returns content of given input instances. There's also
        // a content modifier that customizes display of `bis.GeometricElement3d` properties.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              // load content for given input instances
              specType: ContentSpecificationTypes.SelectedNodeInstances,
            }],
          }, {
            ruleType: RuleTypes.ContentModifier,
            class: { schemaName: "BisCore", className: "GeometricElement3d" },
            propertyOverrides: [{
              // force hide the UserLabel property
              name: "UserLabel",
              isDisplayed: false,
            }, {
              // force show the Parent property which is hidden by default through ECSchema
              name: "Parent",
              isDisplayed: true,
              doNotHideOtherPropertiesOnDisplayOverride: true,
            }, {
              // override label of CodeValue property
              name: "CodeValue",
              labelOverride: "Overriden Label",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure customizations have been made
        const content = await Presentation.presentation.getContent({
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

  describe("Specifications", () => {

    describe("Shared attributes", () => {

      let imodel: IModelConnection;

      beforeEach(async () => {
        await initialize();
        imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
      });

      afterEach(async () => {
        await imodel.close();
        await terminate();
      });

      it("uses `instanceFilter` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ SharedAttributes.InstanceFilter.Ruleset
        // The specification returns content of all filtered `bis.SpatialViewDefinition` instances
        // whose `Pitch` property value is higher or equal to 0.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              instanceFilter: "this.Pitch >= 0",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure that only `bis.SpatialViewDefinition` instances that have Pitch >= 0 are selected.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.contentSet.length).to.eq(2);
        const field = getFieldByLabel(content!.descriptor.fields, "Pitch");
        content!.contentSet.forEach((record) => {
          expect(record.values[field.name]).to.be.not.below(0);
        });
      });

      it("uses `onlyIfNotHandled` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ SharedAttributes.OnlyIfNotHandled.Ruleset
        // Specifications to return content for `bis.ViewDefinition` and `bis.PhysicalModel` respectively.
        // The `bis.PhysicalModel` specification is lower priority and has `onlyIfNotHandled` attribute, which
        // allows it to be overriden by higher priority specification.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
            }, {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["PhysicalModel"], arePolymorphic: true },
              onlyIfNotHandled: true,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure that only `bis.ViewDefinition` instances are selected.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.contentSet.length).to.eq(4);
        const field = getFieldByLabel(content!.descriptor.fields, "Category Selector");
        content!.contentSet.forEach((record) => {
          expect(record.displayValues[field.name]).to.be.string("Default - View");
        });
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ SharedAttributes.Priority.Ruleset
        // Specifications to return content for `bis.PhysicalModel` and `bis.DictionaryModel` respectively.
        // The `bis.PhysicalModel` specification has lower priority so it's displayed after the
        // higher priority specification.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["PhysicalModel"] },
              priority: 0,
            }, {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["DictionaryModel"] },
              priority: 1,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure that only `bis.ViewDefinition` instances are selected.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.contentSet.length).to.eq(2);
        const field = getFieldByLabel(content!.descriptor.fields, "Modeled Element");
        expect(content!.contentSet[0].displayValues[field.name]).to.eq("BisCore.DictionaryModel");
        expect(content!.contentSet[1].displayValues[field.name]).to.eq("Properties_60InstancesWithUrl2");
      });

      it("uses `relatedProperties` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ SharedAttributes.RelatedProperties.Ruleset
        // The specification returns content for `bis.SpatialViewDefinition` and
        // related `bis.DisplayStyle` properties.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              relatedProperties: [{
                propertiesSource: {
                  relationship: { schemaName: "BisCore", className: "ViewDefinitionUsesDisplayStyle" },
                  direction: RelationshipDirection.Forward,
                },
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure that derived `bis.DisplayStyle` instance properties are also returned with `bis.SpatialViewDefinition` content.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.contentSet.length).to.eq(4);
        expect(content!.descriptor.fields).to.containSubset([{
          label: "3D Display Style",
          nestedFields: [{ label: "Model" }, { label: "Code" }, { label: "User Label" }, { label: "Is Private" }],
        }]
        ).and.to.have.lengthOf(18);
      });

      it("uses `calculatedProperties` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ SharedAttributes.CalculatedProperties.Ruleset
        // The specification returns content for `bis.SpatialViewDefinition` and a custom
        // calculated property `Camera view direction`.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              calculatedProperties: [{
                label: "Camera view direction",
                value: "IIf (this.pitch >= 10, \"Vertical upwards\", IIf (this.pitch <= -10, \"Vertical downwards\", \"Horizontal\"))",
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure that derived `bis.DisplayStyle` instance properties are also returned with `bis.SpatialViewDefinition` content.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.contentSet.length).to.eq(4);
        expect(content!.descriptor.fields).to.containSubset([
          { label: "Camera view direction" },
        ]).and.to.have.lengthOf(18);
      });

      it("uses `propertyCategories` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ SharedAttributes.PropertyCategories.Ruleset
        // The specification returns content for `bis.SpatialViewDefinition` with specified camera
        // properties under `Camera settings` category.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
              propertyCategories: [{
                id: "cat1",
                label: "Camera settings",
                autoExpand: true,
              }],
              propertyOverrides: [{ name: "EyePoint", categoryId: "cat1" }, { name: "FocusDistance", categoryId: "cat1" }, { name: "IsCameraOn", categoryId: "cat1" }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure that the returned content has a custom category `Camera settings` and it contains the right properties.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.descriptor.categories).containSubset([{ label: "Camera settings" }]);
        expect(content!.descriptor.fields).to.containSubset([{
          label: "Eye Point",
          category: { label: "Camera settings" },
        }, {
          label: "Focus Distance",
          category: { label: "Camera settings" },
        }, {
          label: "Is Camera On",
          category: { label: "Camera settings" },
        }]);
      });

      it("uses `propertyOverrides` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ SharedAttributes.PropertyOverrides.Ruleset
        // The specification returns content for `bis.ViewDefinition` with one
        // overriden property label.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
              propertyOverrides: [{ name: "Model", labelOverride: "Container Model" }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure that the returned content has an overriden property label `Container Model`.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.contentSet.length).to.eq(4);
        expect(content!.descriptor.fields).to.containSubset([
          { label: "Category Selector" },
          { label: "Code" },
          { label: "Container Model" },
          { label: "Description" },
          { label: "Display Style" },
          { label: "Is Private" },
          { label: "User Label" },
        ]).and.to.have.lengthOf(7);
      });

      it("uses `relatedInstances` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ SharedAttributes.RelatedInstances.Ruleset
        // The specification returns content for `bis.ModelSelector` filtered by related
        // `bis.SpatialViewDefinition` instance `Yaw` property value.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["ModelSelector"], arePolymorphic: true },
              relatedInstances: [{
                relationshipPath: { relationship: { schemaName: "BisCore", className: "SpatialViewDefinitionUsesModelSelector" }, direction: RelationshipDirection.Backward },
                alias: "relatedInstance",
              }],
              instanceFilter: "relatedInstance.Yaw > 0",
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure only the `bis.ModelSelector` whose related SpatialViewDefinition with Yaw > 0 is returned.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.contentSet.length).to.eq(1);
        const field = getFieldByLabel(content!.descriptor.fields, "Code");
        expect(content!.contentSet[0].values[field.name]).to.eq("Default - View 2");
      });

    });

    describe("ContentRelatedInstances", () => {

      let imodel: IModelConnection;

      beforeEach(async () => {
        await initialize();
        imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
      });

      afterEach(async () => {
        await imodel.close();
        await terminate();
      });

      it("uses `relationshipPaths` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentRelatedInstances.RelationshipPaths.Ruleset
        // The ruleset has a specification that returns `bis.ModelSelector` content instances and a specification
        // that returns `bis.SpatialViewDefinition` content instances which are related to their model selector
        // through `bis.SpatialViewDefinitionUsesModelSelector` relationship by following it in backward
        // direction (from `bis.SpatialViewDefinition` to `bis.ModelSelector`).
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["ModelSelector"] },
            }],
          }, {
            ruleType: RuleTypes.Content,
            condition: `ParentNode.IsOfClass("ModelSelector", "BisCore")`,
            specifications: [{
              specType: ContentSpecificationTypes.ContentRelatedInstances,
              relationshipPaths: [{
                relationship: { schemaName: "BisCore", className: "SpatialViewDefinitionUsesModelSelector" },
                direction: RelationshipDirection.Backward,
                targetClass: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that related `bis.SpatialViewDefinition` instances are also returned.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:ModelSelector", id: "0x26" }]),
          descriptor: {},
        });

        expect(content!.contentSet).to.have.lengthOf(5).and.to.containSubset([{
          classInfo: { label: "Spatial View Definition" },
        }]);
      });
    });

    describe("ContentInstancesOfSpecificClasses", () => {

      let imodel: IModelConnection;

      beforeEach(async () => {
        await initialize();
        imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
      });

      afterEach(async () => {
        await imodel.close();
        await terminate();
      });

      it("uses `MultiSchemaClassesSpecification`", async () => {
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              // __PUBLISH_EXTRACT_START__ ContentInstancesOfSpecificClasses.MultiSchemaClasses.Ruleset
              // The specification returns content of all `bis.PhysicalModel` and `bis.SpatialViewDefinition` classes.
              classes: {
                schemaName: "BisCore",
                classNames: ["PhysicalModel", "SpatialViewDefinition"],
                arePolymorphic: false,
              },
              // __PUBLISH_EXTRACT_END__
            }],
          }],
        };

        // Ensure that `bis.PhysicalModel` and `bis.SpatialViewDefinition` instances are selected.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.contentSet.length).to.eq(5);
        content!.contentSet.forEach((record) => {
          expect(record.primaryKeys[0].className).to.oneOf(["BisCore:PhysicalModel", "BisCore:SpatialViewDefinition"]);
        });
      });

      it("uses `classes` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentInstancesOfSpecificClasses.Classes.Ruleset
        // The specification returns content of all `bis.PhysicalModel` classes.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["PhysicalModel"], arePolymorphic: false },
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure only the `bis.PhysicalModel` instances are selected.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.contentSet.length).to.eq(1);
        expect(content!.contentSet[0].primaryKeys[0].className).to.eq("BisCore:PhysicalModel");
      });

      it("uses `handlePropertiesPolymorphically` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ ContentInstancesOfSpecificClasses.HandlePropertiesPolymorphically.Ruleset
        // The specification returns content of all `bis.ViewDefinition` instances
        // with properties of all `bis.ViewDefinition` subclasses.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: RuleTypes.Content,
            specifications: [{
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
              handlePropertiesPolymorphically: true,
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure that derived `bis.ViewDefinition` instances along with their properties are also selected.
        const content = await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content!.descriptor.fields).to.containSubset([
          { label: "Category Selector" },
          { label: "Code" },
          { label: "Description" },
          { label: "Display Style" },
          { label: "Extents" },
          { label: "Eye Point" },
          { label: "Focus Distance" },
          { label: "Is Camera On" },
          { label: "Is Private" },
          { label: "Lens Angle" },
          { label: "Model" },
          { label: "Model Selector" },
          { label: "Origin" },
          { label: "Pitch" },
          { label: "Roll" },
          { label: "User Label" },
          { label: "Yaw" },
        ]).and.to.have.lengthOf(17);

        expect(content!.contentSet.length).to.eq(4);
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
