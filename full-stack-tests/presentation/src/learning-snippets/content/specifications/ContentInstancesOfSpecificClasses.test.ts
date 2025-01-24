/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection } from "@itwin/core-frontend";
import { KeySet, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../../IntegrationTests";
import { collect, getFieldByLabel } from "../../../Utils";
import { TestIModelConnection } from "../../../IModelSetupUtils";

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

  describe("Content Specifications", () => {
    describe("SelectedNodeInstances", () => {
      it("uses `classes` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentInstancesOfSpecificClasses.Classes.Ruleset
        // The specification returns content of all `bis.PhysicalModel` classes.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["PhysicalModel"], arePolymorphic: false },
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure only the `bis.PhysicalModel` instances are selected.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.total).to.eq(1);
        expect((await content!.items.next()).value.primaryKeys[0].className).to.eq("BisCore:PhysicalModel");
      });

      it("uses `excludedClasses` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentInstancesOfSpecificClasses.ExcludedClasses.Ruleset
        // The specification returns content of all classes derived from `bis.Model` except for excluded `bis.PhysicalModel` class.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true },
                  excludedClasses: { schemaName: "BisCore", classNames: ["PhysicalModel"] },
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure that all `bis.PhysicalModel` instances are excluded.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        const contentSet = await collect(content!.items);
        expect(contentSet)
          .to.have.lengthOf(7)
          .and.not.containSubset([{ classInfo: { name: "BisCore:PhysicalModel" } }]);
      });

      it("uses `handlePropertiesPolymorphically` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentInstancesOfSpecificClasses.HandlePropertiesPolymorphically.Ruleset
        // This ruleset returns content of all `bis.ViewDefinition` instances, including all properties from derived classes.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["ViewDefinition"], arePolymorphic: true },
                  handlePropertiesPolymorphically: true,
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure that derived `bis.ViewDefinition` instances along with their properties are also selected.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        const { descriptor, total } = content!;
        expect(descriptor.fields)
          .to.containSubset([
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
          ])
          .and.to.have.lengthOf(17);

        expect(total).to.eq(4);
      });

      it("uses `instanceFilter` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentInstancesOfSpecificClasses.InstanceFilter.Ruleset
        // This ruleset returns content of all `bis.SpatialViewDefinition` instances whose `Pitch` property is greater or equal to 0.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialViewDefinition"] },
                  instanceFilter: "this.Pitch >= 0",
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__

        // Ensure that only `bis.SpatialViewDefinition` instances that have Pitch >= 0 are selected.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });

        expect(content!.total).to.eq(2);
        const field = getFieldByLabel(content!.descriptor.fields, "Pitch");
        for await (const record of content!.items) {
          expect(record.values[field.name]).to.be.not.below(0);
        }
      });
    });
  });
});
