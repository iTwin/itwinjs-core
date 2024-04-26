/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { KeySet, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";
import { printRuleset } from "../Utils";
import { collect } from "../../Utils";

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
        // The ruleset has root node rule that returns custom nodes "A" and "B". Also there is an extended data rule
        // to add additional data to "B" nodes.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "CustomNode",
                  label: "A",
                  type: "A",
                },
                {
                  specType: "CustomNode",
                  label: "B",
                  type: "B",
                },
              ],
            },
            {
              ruleType: "ExtendedData",
              condition: 'ThisNode.Type = "B"',
              items: {
                iconName: '"custom-icon"',
              },
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Presentation.ExtendedDataRule.Condition.Result
        // Ensure only "B" node has `extendedData` property.
        const nodes = await Presentation.presentation
          .getNodesIterator({
            imodel,
            rulesetOrId: ruleset,
          })
          .then(async (x) => collect(x.items));
        expect(nodes)
          .to.be.lengthOf(2)
          .and.to.containSubset([
            {
              label: { displayValue: "A" },
              extendedData: undefined,
            },
            {
              label: { displayValue: "B" },
              extendedData: {
                iconName: "custom-icon",
              },
            },
          ]);
        // __PUBLISH_EXTRACT_END__
      });

      it("uses `items` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ExtendedDataRule.Items.Ruleset
        // The ruleset has root node rule that returns custom "A" node. Also there is an extended data rule
        // to add additional data to node.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "CustomNode",
                  label: "A",
                  type: "A",
                },
              ],
            },
            {
              ruleType: "ExtendedData",
              items: {
                iconName: '"custom-icon"',
                fontColor: '"custom-font-color"',
                typeDescription: '"Node is of type " & ThisNode.Type',
              },
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // __PUBLISH_EXTRACT_START__ Presentation.ExtendedDataRule.Items.Result
        // Ensure node has `extendedData` property containing items defined in rule.
        const nodes = await Presentation.presentation
          .getNodesIterator({
            imodel,
            rulesetOrId: ruleset,
          })
          .then(async (x) => collect(x.items));
        expect(nodes)
          .to.be.lengthOf(1)
          .and.to.containSubset([
            {
              label: { displayValue: "A" },
              extendedData: {
                iconName: "custom-icon",
                fontColor: "custom-font-color",
                typeDescription: "Node is of type A",
              },
            },
          ]);
        // __PUBLISH_EXTRACT_END__
      });
    });
  });
});
