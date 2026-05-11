/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection } from "@itwin/core-frontend";
import { KeySet, Ruleset } from "@itwin/presentation-common";
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
    describe("ExtendedDataRule", () => {
      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ExtendedDataRule.RequiredSchemas.Ruleset
        // The ruleset has rule that returns content of given input instances. Also there is an extended data rule
        // to add additional data for `bis.ExternalSourceAspect` instances content. `bis.ExternalSourceAspect` ECClass was
        // introduced in BisCore version 1.0.2, so the rule needs a `requiredSchemas` attribute to only use the rule
        // if the version meets the requirement.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                },
              ],
            },
            {
              ruleType: "ExtendedData",
              requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
              condition: 'ThisNode.IsOfClass("ExternalSourceAspect", "BisCore")',
              items: {
                iconName: '"external-source-icon"',
              },
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Element", id: "0x61" }]),
          descriptor: {},
        });
        expect(content!.total).to.eq(1);
        expect((await content!.items.next()).value).not.to.containSubset({ extendedData: { iconName: "external-source-icon" } });
      });

      it("uses `condition` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ExtendedDataRule.Condition.Ruleset
        // The ruleset has a content rule that returns content for `bis.Model` instances. Also there is an extended data rule
        // to add additional data to `bis.PhysicalModel` content items.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true },
                },
              ],
            },
            {
              ruleType: "ExtendedData",
              condition: `this.IsOfClass("PhysicalModel", "BisCore")`,
              items: {
                iconName: '"custom-icon"',
              },
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Presentation.ExtendedDataRule.Condition.Result
        // Ensure only `bis.PhysicalModel` node has `extendedData` property.
        const items = await Presentation.presentation
          .getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet(),
            descriptor: {},
          })
          .then(async (x) => collect(x!.items));
        expect(items).to.have.length.greaterThan(0);
        for (const item of items) {
          if (item.primaryKeys[0].className.includes("PhysicalModel")) {
            expect(item.extendedData!.iconName).to.eq("custom-icon");
          } else {
            expect(item.extendedData).to.be.undefined;
          }
        }
        // __PUBLISH_EXTRACT_END__
      });

      it("uses `items` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ExtendedDataRule.Items.Ruleset
        // The ruleset has a content rule that returns content for specific instance. Also there is an extended data rule
        // to add additional data to node.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                },
              ],
            },
            {
              ruleType: "ExtendedData",
              items: {
                iconName: '"custom-icon"',
                fontColor: '"custom-font-color"',
                typeDescription: '"Item is of class " & ThisNode.ClassName',
              },
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Presentation.ExtendedDataRule.Items.Result
        // Ensure requested content item has `extendedData` property containing items defined in rule.
        const items = await Presentation.presentation
          .getContentIterator({
            imodel,
            rulesetOrId: ruleset,
            keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
            descriptor: {},
          })
          .then(async (x) => collect(x!.items));
        expect(items)
          .to.be.lengthOf(1)
          .and.to.containSubset([
            {
              extendedData: {
                iconName: "custom-icon",
                fontColor: "custom-font-color",
                typeDescription: "Item is of class Subject",
              },
            },
          ]);
        // __PUBLISH_EXTRACT_END__
      });
    });
  });
});
