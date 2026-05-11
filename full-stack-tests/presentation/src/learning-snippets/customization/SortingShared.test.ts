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
    describe("Sorting", () => {
      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Sorting.RequiredSchemas.Ruleset
        // The ruleset has a content rule that returns `bis.SpatialViewDefinition` instances with labels
        // consisting of `Roll` and `Pitch` property values. Also there is a customization rule to sort
        // instances by `Pitch` property. Sorting rule requires `BisCore` schema to be higher than 1.0.2.
        // If this requirement is not met sorting rule does not take effect.
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
              requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
              propertyName: "Pitch",
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

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
    });
  });
});
