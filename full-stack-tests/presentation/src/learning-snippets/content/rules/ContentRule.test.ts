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
import { collect } from "../../../Utils";

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

  describe("Content Rules", () => {
    describe("ContentRule", () => {
      it("uses `SelectedNode` symbol in rule condition", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentRule.Condition.SelectedNodeSymbol
        // The ruleset has two content rules:
        // - the one for `bis.Element` returns content for input instances
        // - the one for `bis.Model` returns content for input model's contained elements
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              condition: `SelectedNode.IsOfClass("Element", "BisCore")`,
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                },
              ],
            },
            {
              ruleType: "Content",
              condition: `SelectedNode.IsOfClass("Model", "BisCore")`,
              specifications: [
                {
                  specType: "ContentRelatedInstances",
                  relationshipPaths: [
                    {
                      relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                      direction: "Forward",
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Expect element content when providing `bis.Element` input
        const elementContent = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]),
          descriptor: {},
        });
        expect(elementContent!.total).to.eq(1);
        expect((await elementContent!.items.next()).value.primaryKeys).to.deep.eq([{ className: "Generic:PhysicalObject", id: "0x74" }]);

        const modelContent = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
          descriptor: {},
        });
        expect(modelContent!.total).to.eq(62);
      });

      it("uses ruleset variables in rule condition", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentRule.Condition.RulesetVariables.Ruleset
        // The ruleset has two content rules that return content for `bis.SpatialCategory` and `bis.GeometricModel` instances. Both
        // rules can be enabled or disabled with a ruleset variable.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              condition: `GetVariableBoolValue("DISPLAY_CATEGORIES")`,
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialCategory"], arePolymorphic: true },
                },
              ],
            },
            {
              ruleType: "Content",
              condition: `GetVariableBoolValue("DISPLAY_MODELS")`,
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricModel"], arePolymorphic: true },
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // No variables set - no content
        let content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content).to.be.undefined;

        // Set DISPLAY_CATEGORIES to get content of all Category instances in the imodel
        await Presentation.presentation.vars(ruleset.id).setBool("DISPLAY_CATEGORIES", true);
        content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        let contentSet = await collect(content!.items);
        expect(contentSet)
          .to.containSubset([
            {
              primaryKeys: [{ className: "BisCore:SpatialCategory", id: "0x17" }],
            },
          ])
          .and.to.have.lengthOf(1);

        // Set DISPLAY_MODELS to also get geometric model instances' content
        await Presentation.presentation.vars(ruleset.id).setBool("DISPLAY_MODELS", true);
        content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        contentSet = await collect(content!.items);
        expect(contentSet)
          .to.containSubset([
            {
              primaryKeys: [{ className: "BisCore:SpatialCategory", id: "0x17" }],
            },
            {
              primaryKeys: [{ className: "BisCore:PhysicalModel", id: "0x1c" }],
            },
          ])
          .and.to.have.lengthOf(2);
      });

      it("uses `requiredSchemas` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentRule.RequiredSchemas.Ruleset
        // The ruleset has one content rule that returns content of `bis.ExternalSourceAspect` instances. The
        // ECClass was introduced in BisCore version 1.0.2, so the rule needs a `requiredSchemas` attribute
        // to only use the rule if the version meets the requirement.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              requiredSchemas: [{ name: "BisCore", minVersion: "1.0.2" }],
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: [
                    {
                      schemaName: "BisCore",
                      classNames: ["ExternalSourceAspect"],
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // The iModel uses BisCore older than 1.0.2 - no content should be returned
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        expect(content).to.be.undefined;
      });

      it("uses `priority` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentRule.Priority.Ruleset
        // The ruleset has two content rules that return content for `bis.SpatialCategory` and
        // `bis.GeometricModel` respectively. The rules have different priorities and higher priority
        // rule is handled first - it's content appears first.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              priority: 1,
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialCategory"], arePolymorphic: true },
                },
              ],
            },
            {
              ruleType: "Content",
              priority: 2,
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricModel"], arePolymorphic: true },
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Expect GeometricModel record to be first even though category rule was defined first
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        const contentSet = await collect(content!.items);
        expect(contentSet)
          .to.containSubset([
            {
              primaryKeys: [{ className: "BisCore:PhysicalModel", id: "0x1c" }],
            },
            {
              primaryKeys: [{ className: "BisCore:SpatialCategory", id: "0x17" }],
            },
          ])
          .and.to.have.lengthOf(2);
      });

      it("uses `onlyIfNotHandled` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentRule.OnlyIfNotHandled.Ruleset
        // The ruleset has two root node rules that return content for `bis.SpatialCategory` and
        // `bis.GeometricModel` respectively. The `bis.SpatialCategory` rule has lower priority and `onlyIfNotHandled`
        // attribute, which allows it to be overriden by higher priority rules.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              priority: 1,
              onlyIfNotHandled: true,
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SpatialCategory"], arePolymorphic: true },
                },
              ],
            },
            {
              ruleType: "Content",
              priority: 2,
              specifications: [
                {
                  specType: "ContentInstancesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["GeometricModel"], arePolymorphic: true },
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Expect only `GeometricModel` record, as the rule for `SpatialCategory` is skipped due to `onlyIfNotHandled` attribute
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet(),
          descriptor: {},
        });
        const contentSet = await collect(content!.items);
        expect(contentSet)
          .to.containSubset([
            {
              primaryKeys: [{ className: "BisCore:PhysicalModel", id: "0x1c" }],
            },
          ])
          .and.to.have.lengthOf(1);
      });
    });
  });
});
