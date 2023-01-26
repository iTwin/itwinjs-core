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

  beforeEach(async () => {
    await initialize();
    imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  afterEach(async () => {
    await imodel.close();
    await terminate();
  });

  describe("Content Customization", () => {

    describe("CalculatedPropertiesSpecification", () => {

      it("uses `label` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.CalculatedPropertiesSpecification.Label.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. The produced content is customized to
        // additionally have a calculated "My Calculated Property" property.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: "Content",
            specifications: [{
              specType: "SelectedNodeInstances",
              calculatedProperties: [{
                label: "My Calculated Property",
                value: `123`,
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that the custom property was created
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([{
          label: "My Calculated Property",
        }]);
      });

      it("uses `value` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.CalculatedPropertiesSpecification.Value.Ruleset
        // There's a content rule for returning content of given `bis.GeometricElement3d` instance. The produced content is
        // customized to additionally have a calculated "Element Volume" property whose value is calculated based on
        // element's `BBoxHigh` and `BBoxLow` property values.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: "Content",
            specifications: [{
              specType: "SelectedNodeInstances",
              calculatedProperties: [{
                label: "Element Volume",
                value: "(this.BBoxHigh.x - this.BBoxLow.x) * (this.BBoxHigh.y - this.BBoxLow.y) * (this.BBoxHigh.z - this.BBoxLow.z)",
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that the custom property was created and has a value
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "generic.PhysicalObject", id: "0x74" }]),
          descriptor: {},
        }))!;
        const field = getFieldByLabel(content.descriptor.fields, "Element Volume");
        expect(content.contentSet).to.have.lengthOf(1).and.to.containSubset([{
          values: {
            [field.name]: "3.449493952966681",
          },
        }]);
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.CalculatedPropertiesSpecification.Priority.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. The produced content is customized to
        // additionally have a "My Calculated Property" property with priority set to `9999`. This should make the property
        // appear at the top in the UI, since generally properties have a priority of `1000`.
        const ruleset: Ruleset = {
          id: "example",
          rules: [{
            ruleType: "Content",
            specifications: [{
              specType: "SelectedNodeInstances",
              calculatedProperties: [{
                label: "My Calculated Property",
                value: `123`,
                priority: 9999,
              }],
            }],
          }],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that the custom property has correct priority
        const content = (await Presentation.presentation.getContent({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        }))!;
        expect(content.descriptor.fields).to.containSubset([{
          label: "My Calculated Property",
          priority: 9999,
        }]);
      });

    });

  });

});
