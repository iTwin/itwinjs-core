/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { KeySet, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../../IntegrationTests";
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

  describe("Content Customization", () => {
    describe("DefaultPropertyCategoryOverride", () => {
      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.DefaultPropertyCategoryOverride.RequiredSchemas.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. In addition, there are two default
        // property category overrides:
        // - For iModels containing BisCore version 1.0.1 and older, the default property category should be "Custom Category OLD".
        // - For iModels containing BisCore version 1.0.2 and newer, the default property category should be "Custom Category NEW".
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
              ruleType: "DefaultPropertyCategoryOverride",
              requiredSchemas: [{ name: "BisCore", maxVersion: "1.0.2" }],
              specification: {
                id: "default",
                label: "Custom Category OLD",
              },
            },
            {
              ruleType: "DefaultPropertyCategoryOverride",
              requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
              specification: {
                id: "default",
                label: "Custom Category NEW",
              },
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // The iModel uses BisCore older than 1.0.2 - we should use the "OLD" default category
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        });
        const defaultCategory = content!.descriptor.categories.find((category) => category.name === "default");
        expect(defaultCategory).to.containSubset({
          label: "Custom Category OLD",
        });
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.DefaultPropertyCategoryOverride.Priority.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. In addition, there are two default
        // property category overrides of different priorities. The high priority rule should take precedence.
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
              ruleType: "DefaultPropertyCategoryOverride",
              priority: 0,
              specification: {
                id: "default",
                label: "Low Priority",
              },
            },
            {
              ruleType: "DefaultPropertyCategoryOverride",
              priority: 9999,
              specification: {
                id: "default",
                label: "High Priority",
              },
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // The iModel uses BisCore older than 1.0.2 - we should use the "OLD" default category
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        });
        const defaultCategory = content!.descriptor.categories.find((category) => category.name === "default");
        expect(defaultCategory).to.containSubset({
          label: "High Priority",
        });
      });

      it("uses `specification` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Content.Customization.DefaultPropertyCategoryOverride.Specification.Ruleset
        // There's a content rule for returning content of given `bis.Subject` instance. In addition, there's a default property
        // category override to place properties into.
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
              ruleType: "DefaultPropertyCategoryOverride",
              specification: {
                id: "default",
                label: "Test Category",
              },
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure the default property category is correctly set up
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:Subject", id: "0x1" }]),
          descriptor: {},
        });
        const defaultCategory = content!.descriptor.categories.find((category) => category.name === "default");
        expect(defaultCategory).to.containSubset({
          label: "Test Category",
        });
        content!.descriptor.fields.forEach((field) => {
          expect(field.category).to.eq(defaultCategory);
        });
      });
    });
  });
});
