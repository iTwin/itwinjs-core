/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate, testLocalization } from "../../IntegrationTests";
import { printRuleset } from "../Utils";
import { collect } from "../../Utils";

describe("Learning Snippets", () => {
  let imodel: IModelConnection;

  before(async () => {
    await initialize({ localization: testLocalization });
    imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("Customization Rules", () => {
    describe("InstanceLabelOverride", () => {
      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.RequiredSchemas.Ruleset
        // The ruleset has root node rule that returns `Generic.PhysicalObject` instances and
        // customization rule to override label using related `bis.ExternalSourceAspect` property.
        // `bis.ExternalSourceAspect` ECClass was introduced in BisCore version 1.0.2, so the rule needs
        // a `requiredSchemas` attribute to only use the rule if the version meets the requirement.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "Generic", classNames: ["PhysicalObject"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
              class: { schemaName: "Generic", className: "PhysicalObject" },
              values: [
                {
                  specType: "Property",
                  propertySource: {
                    relationship: { schemaName: "BisCore", className: "ElementOwnsMultiAspects" },
                    direction: "Forward",
                    targetClass: { schemaName: "BisCore", className: "ExternalSourceAspect" },
                  },
                  propertyName: "Identifier",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that label was not overriden because imodel has older BisCore schema than required by label override
        const nodes = await Presentation.presentation
          .getNodesIterator({
            imodel,
            rulesetOrId: ruleset,
          })
          .then(async (x) => collect(x.items));
        expect(nodes)
          .to.be.lengthOf(2)
          .and.to.containSubset([{ label: { displayValue: "Physical Object [0-38]" } }, { label: { displayValue: "Physical Object [0-39]" } }]);
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.Priority.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and two
        // customization rules to override labels. The rules have different priorities and
        // higher priority rule is handled first.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              priority: 1000,
              class: { schemaName: "BisCore", className: "GeometricModel3d" },
              values: [
                {
                  specType: "String",
                  value: "Model A",
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              priority: 2000,
              class: { schemaName: "BisCore", className: "GeometricModel3d" },
              values: [
                {
                  specType: "String",
                  value: "Model B",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that label override with higher priority was applied
        const nodes = await Presentation.presentation.getNodesIterator({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes.total).to.eq(1);
        expect((await nodes.items.next()).value).to.containSubset({ label: { displayValue: "Model B" } });
      });

      it("uses `onlyIfNotHandled` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.OnlyIfNotHandled.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and two
        // customization rules to override label. The first label override rule has lower priority and
        // `onlyIfNodeHandled` attribute, which allows it to be overriden by higher priority rules. Even
        // if rule with higher priority does not provide value for label rule with lower priority is not used.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              priority: 1000,
              onlyIfNotHandled: true,
              class: { schemaName: "BisCore", className: "GeometricModel3d" },
              values: [
                {
                  specType: "String",
                  value: "Model A",
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              priority: 2000,
              class: { schemaName: "BisCore", className: "GeometricModel3d" },
              values: [
                {
                  specType: "String",
                  value: "",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that only label override with higher priority was applied
        const nodes = await Presentation.presentation.getNodesIterator({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes.total).to.eq(1);
        expect((await nodes.items.next()).value).to.containSubset({ label: { displayValue: "Ñót spêçìfíêd" } });
      });

      it("uses `class` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.Class.Ruleset
        // The ruleset has root node rule that returns `bis.Model` instances.
        // Also there is customization rule to override label only for `bis.GeometricModel3d` instances.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "GeometricModel3d" },
              values: [
                {
                  specType: "String",
                  value: "Geometric Model Node",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that only `bis.GeometricModel3d` instances label was overriden
        const nodes = await Presentation.presentation
          .getNodesIterator({
            imodel,
            rulesetOrId: ruleset,
          })
          .then(async (x) => collect(x.items));
        expect(nodes)
          .to.be.lengthOf(8)
          .and.to.containSubset([
            { label: { displayValue: "BisCore.DictionaryModel" } },
            { label: { displayValue: "BisCore.RealityDataSources" } },
            { label: { displayValue: "Converted Drawings" } },
            { label: { displayValue: "Converted Groups" } },
            { label: { displayValue: "Converted Sheets" } },
            { label: { displayValue: "Definition Model For DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default" } },
            { label: { displayValue: "DgnV8Bridge" } },
            { label: { displayValue: "Geometric Model Node" } },
          ]);
      });

      it("uses composite value specification", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.CompositeValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricElement3d` instances and
        // customization rule to override instance label composed of string "ECClass" and instance ECClass name.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "GeometricModel3d" },
              values: [
                {
                  specType: "Composite",
                  separator: "-",
                  parts: [{ spec: { specType: "String", value: "ECClass" } }, { spec: { specType: "ClassName" } }],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that label was set to composed value
        const nodes = await Presentation.presentation.getNodesIterator({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes.total).to.eq(1);
        expect((await nodes.items.next()).value).to.containSubset({ label: { displayValue: "ECClass-PhysicalModel" } });
      });

      it("uses property value specification", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.PropertyValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.SpatialViewDefinition` instances and
        // customization rule to override instance label using `Pitch` property value.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              values: [
                {
                  specType: "Property",
                  propertyName: "Pitch",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that labels was set to `Pitch` property value
        const nodes = await Presentation.presentation
          .getNodesIterator({
            imodel,
            rulesetOrId: ruleset,
          })
          .then(async (x) => collect(x.items));
        expect(nodes)
          .to.be.lengthOf(4)
          .and.to.containSubset([
            { label: { displayValue: "-35.26" } },
            { label: { displayValue: "-160.99" } },
            { label: { displayValue: "0.00" } },
            { label: { displayValue: "90.00" } },
          ]);
      });

      it("uses related property value specification", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.RelatedPropertyValueSpecification.Ruleset
        // The ruleset has root node rule that returns `meta.ECEnumerationDef` instances and
        // customization rule to override instance label using `Alias` property value of
        // `meta.ECSchemaDef` instance that is containing `meta.ECEnumerationDef` instance.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "ECDbMeta", classNames: ["ECEnumerationDef"] },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "ECDbMeta", className: "ECEnumerationDef" },
              values: [
                {
                  specType: "Property",
                  propertySource: {
                    relationship: { schemaName: "ECDbMeta", className: "SchemaOwnsEnumerations" },
                    direction: "Backward",
                  },
                  propertyName: "Alias",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that labels were set to related `meta.ECSchemaDef` instance `Alias` property value
        const nodes = await Presentation.presentation
          .getNodesIterator({
            imodel,
            rulesetOrId: ruleset,
          })
          .then(async (x) => collect(x.items));
        expect(nodes)
          .to.be.lengthOf(18)
          .and.to.containSubset([
            { label: { displayValue: "bis" } },
            { label: { displayValue: "bis" } },
            { label: { displayValue: "bsca" } },
            { label: { displayValue: "bsca" } },
            { label: { displayValue: "bsca" } },
            { label: { displayValue: "CoreCA" } },
            { label: { displayValue: "CoreCA" } },
            { label: { displayValue: "dgnca" } },
            { label: { displayValue: "ecdbf" } },
            { label: { displayValue: "meta" } },
            { label: { displayValue: "meta" } },
            { label: { displayValue: "meta" } },
            { label: { displayValue: "meta" } },
            { label: { displayValue: "meta" } },
            { label: { displayValue: "meta" } },
            { label: { displayValue: "meta" } },
            { label: { displayValue: "meta" } },
            { label: { displayValue: "PCJTest" } },
          ]);
      });

      it("uses string value specification", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.StringValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and
        // customization rule to override label using string "Model Node".
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "GeometricModel3d" },
              values: [
                {
                  specType: "String",
                  value: "Model Node",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that label was set to "Model Node"
        const nodes = await Presentation.presentation.getNodesIterator({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes.total).to.eq(1);
        expect((await nodes.items.next()).value).to.containSubset({ label: { displayValue: "Model Node" } });
      });

      it("uses class name value specification", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.ClassNameValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and
        // customization rule to override instance label using full name of instance ECClass.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: true,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "GeometricModel3d" },
              values: [
                {
                  specType: "ClassName",
                  full: true,
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that label was set to full class name
        const nodes = await Presentation.presentation.getNodesIterator({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes.total).to.eq(1);
        expect((await nodes.items.next()).value).to.containSubset({ label: { displayValue: "BisCore:PhysicalModel" } });
      });

      it("uses class label value specification", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.ClassLabelValueSpecification.Ruleset
        // The ruleset has root node rule that returns 'bis.GeometricModel3d' instances and
        // customization rule to override instance label with instance class label.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "GeometricModel3d" },
              values: [
                {
                  specType: "ClassLabel",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that label value was set to instance ECClass label
        const nodes = await Presentation.presentation.getNodesIterator({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes.total).to.eq(1);
        expect((await nodes.items.next()).value).to.containSubset({ label: { displayValue: "Physical Model" } });
      });

      it("uses briefcaseId value specification", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.BriefcaseIdValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and
        // customization rule to override instance label with BriefcaseId value.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "GeometricModel3d" },
              values: [
                {
                  specType: "BriefcaseId",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that only label override with higher priority was applied
        const nodes = await Presentation.presentation.getNodesIterator({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes.total).to.eq(1);
        expect((await nodes.items.next()).value).to.containSubset({ label: { displayValue: "0" } });
      });

      it("uses localId value specification", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.LocalIdValueSpecification.Ruleset
        // The ruleset has root node rule that returns `bis.GeometricModel3d` instances and
        // customization rule to override instance label with LocalId value.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricModel3d"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "GeometricModel3d" },
              values: [
                {
                  specType: "LocalId",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that only label override with higher priority was applied
        const nodes = await Presentation.presentation.getNodesIterator({
          imodel,
          rulesetOrId: ruleset,
        });
        expect(nodes.total).to.eq(1);
        expect((await nodes.items.next()).value).to.containSubset({ label: { displayValue: "S" } });
      });

      it("uses related instance label value specification", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.InstanceLabelOverride.RelatedInstanceLabelValueSpecification.Ruleset
        // The ruleset has root node rule that returns `Generic.PhysicalObject` instances and
        // customization rule to override instance label with label of `bis.Model` instance
        // containing `Generic.PhysicalObject` instance.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "Generic", classNames: ["PhysicalObject"], arePolymorphic: true },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "Generic", className: "PhysicalObject" },
              values: [
                {
                  specType: "RelatedInstanceLabel",
                  pathToRelatedInstance: {
                    relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                    direction: "Backward",
                  },
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that only label override with higher priority was applied
        const nodes = await Presentation.presentation
          .getNodesIterator({
            imodel,
            rulesetOrId: ruleset,
          })
          .then(async (x) => collect(x.items));
        expect(nodes)
          .to.be.lengthOf(2)
          .and.to.containSubset([{ label: { displayValue: "Properties_60InstancesWithUrl2" } }, { label: { displayValue: "Properties_60InstancesWithUrl2" } }]);
      });
    });
  });
});
