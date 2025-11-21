/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection } from "@itwin/core-frontend";
import { ContentFlags, KeySet, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests.js";
import { printRuleset } from "../Utils.js";
import { collect } from "../../Utils.js";
import { TestIModelConnection } from "../../IModelSetupUtils.js";

describe("Learning Snippets", () => {
  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    imodel = TestIModelConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("Customization Rules", () => {
    describe("PropertySortingRule", () => {
      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.PropertySortingRule.Priority.Ruleset
        // The ruleset has a content rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there are two customization rules to sort
        // instances by `Roll` and `Pitch` properties. The rules have different priorities and higher priority
        // rule is handled first.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              values: [
                {
                  specType: "Composite",
                  separator: " x ",
                  parts: [{ spec: { specType: "Property", propertyName: "Roll" } }, { spec: { specType: "Property", propertyName: "Pitch" } }],
                },
              ],
            },
            {
              ruleType: "PropertySorting",
              priority: 1,
              class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              propertyName: "Roll",
            },
            {
              ruleType: "PropertySorting",
              priority: 2,
              class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              propertyName: "Pitch",
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that items are sorted by `Pitch` property
        const items = await Presentation.presentation
          .getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet(),
            descriptor: { contentFlags: ContentFlags.ShowLabels },
          })
          .then(async (x) => collect(x!.items));
        expect(items).to.be.lengthOf(4);
        expect(items[0]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(items[1]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(items[2]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(items[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

      it("uses `condition` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.PropertySortingRule.Condition.Ruleset
        // The ruleset has a content rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there are customization rule to sort
        // instances by `Pitch` property.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              values: [
                {
                  specType: "Composite",
                  separator: " x ",
                  parts: [{ spec: { specType: "Property", propertyName: "Roll" } }, { spec: { specType: "Property", propertyName: "Pitch" } }],
                },
              ],
            },
            {
              ruleType: "PropertySorting",
              condition: "TRUE",
              propertyName: "Pitch",
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that items are sorted by `Pitch` property
        const items = await Presentation.presentation
          .getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet(),
            descriptor: { contentFlags: ContentFlags.ShowLabels },
          })
          .then(async (x) => collect(x!.items));
        expect(items).to.be.lengthOf(4);
        expect(items[0]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(items[1]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(items[2]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(items[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

      it("uses `class` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.PropertySortingRule.Class.Ruleset
        // The ruleset has a content rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there are customization rule to sort
        // `bis.SpatialViewDefinition` instances by `Pitch` property
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              values: [
                {
                  specType: "Composite",
                  separator: " x ",
                  parts: [{ spec: { specType: "Property", propertyName: "Roll" } }, { spec: { specType: "Property", propertyName: "Pitch" } }],
                },
              ],
            },
            {
              ruleType: "PropertySorting",
              class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              propertyName: "Pitch",
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that items are sorted by `Pitch` property
        const items = await Presentation.presentation
          .getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet(),
            descriptor: { contentFlags: ContentFlags.ShowLabels },
          })
          .then(async (x) => collect(x!.items));
        expect(items).to.be.lengthOf(4);
        expect(items[0]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(items[1]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(items[2]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(items[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

      it("uses `isPolymorphic` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.PropertySortingRule.IsPolymorphic.Ruleset
        // This ruleset lists `bis.SpatialViewDefinition` instances with their `Roll` and `Pitch` properties as instance
        // labels. Sorting rule targets `bis.ViewDefinition3d`, the base class of `bis.SpatialViewDefinition`, so to
        // sort instances of the derived classes, `isPolymorphic` attribute needs to be `true`.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              values: [
                {
                  specType: "Composite",
                  separator: " x ",
                  parts: [{ spec: { specType: "Property", propertyName: "Roll" } }, { spec: { specType: "Property", propertyName: "Pitch" } }],
                },
              ],
            },
            {
              ruleType: "PropertySorting",
              class: { schemaName: "BisCore", className: "ViewDefinition3d" },
              isPolymorphic: true,
              propertyName: "Pitch",
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that items of `bis.SpatialViewDefinition` class instances are sorted
        const items = await Presentation.presentation
          .getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet(),
            descriptor: { contentFlags: ContentFlags.ShowLabels },
          })
          .then(async (x) => collect(x!.items));
        expect(items).to.be.lengthOf(4);
        expect(items[0]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(items[1]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(items[2]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(items[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

      it("uses `propertyName` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.PropertySortingRule.PropertyName.Ruleset
        // The ruleset has a content rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there are customization rule to sort
        // instances of any class by `Pitch` property.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              values: [
                {
                  specType: "Composite",
                  separator: " x ",
                  parts: [{ spec: { specType: "Property", propertyName: "Roll" } }, { spec: { specType: "Property", propertyName: "Pitch" } }],
                },
              ],
            },
            {
              ruleType: "PropertySorting",
              propertyName: "Pitch",
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that items are sorted by `Pitch` property
        const items = await Presentation.presentation
          .getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet(),
            descriptor: { contentFlags: ContentFlags.ShowLabels },
          })
          .then(async (x) => collect(x!.items));
        expect(items).to.be.lengthOf(4);
        expect(items[0]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
        expect(items[1]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(items[2]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(items[3]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
      });

      it("uses `sortAscending` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.PropertySortingRule.SortAscending.Ruleset
        // The ruleset has a content rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there are customization rule to sort
        // instances by `Pitch` property in descending order
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
                },
              ],
            },
            {
              ruleType: "InstanceLabelOverride",
              class: { schemaName: "BisCore", className: "SpatialViewDefinition" },
              values: [
                {
                  specType: "Composite",
                  separator: " x ",
                  parts: [{ spec: { specType: "Property", propertyName: "Roll" } }, { spec: { specType: "Property", propertyName: "Pitch" } }],
                },
              ],
            },
            {
              ruleType: "PropertySorting",
              propertyName: "Pitch",
              sortAscending: false,
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // verify that items are sorted by `Pitch` in descending order
        const items = await Presentation.presentation
          .getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet(),
            descriptor: { contentFlags: ContentFlags.ShowLabels },
          })
          .then(async (x) => collect(x!.items));
        expect(items).to.be.lengthOf(4);
        expect(items[0]).to.containSubset({ label: { displayValue: "0.00 x 90.00" } });
        expect(items[1]).to.containSubset({ label: { displayValue: "-90.00 x 0.00" } });
        expect(items[2]).to.containSubset({ label: { displayValue: "-45.00 x -35.26" } });
        expect(items[3]).to.containSubset({ label: { displayValue: "-107.42 x -160.99" } });
      });
    });
  });
});
