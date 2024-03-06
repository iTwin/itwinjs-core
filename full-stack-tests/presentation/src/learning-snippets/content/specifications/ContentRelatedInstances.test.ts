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

  before(async () => {
    await initialize();
    imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("Content Specifications", () => {
    describe("ContentInstancesOfSpecificClasses", () => {
      it("uses `relationshipPaths` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentRelatedInstances.RelationshipPaths.Ruleset
        // This ruleset returns content for `bis.Element` instances that are related to input `bis.Model` instances
        // through `bis.ModelContainsElements` relationship.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentRelatedInstances",
                  relationshipPaths: [
                    {
                      relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                      direction: "Forward",
                      targetClass: { schemaName: "BisCore", className: "Element" },
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Ensure that related `bis.Element` instances are returned.
        const content = await Presentation.presentation.getContentIterator({
          imodel,
          rulesetOrId: ruleset,
          keys: new KeySet([{ className: "BisCore:PhysicalModel", id: "0x1c" }]),
          descriptor: {},
        });

        for await (const record of content!.items) {
          expect(record.primaryKeys[0].className).to.be.oneOf(["Generic:PhysicalObject", "PCJ_TestSchema:TestClass"]);
        }
      });

      it("uses `instanceFilter` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.ContentRelatedInstances.InstanceFilter.Ruleset
        // This ruleset returns content of all `bis.SpatialViewDefinition` instances whose `Pitch` property is greater or equal to 0.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "ContentRelatedInstances",
                  relationshipPaths: [
                    {
                      relationship: {
                        schemaName: "BisCore",
                        className: "SpatialViewDefinitionUsesModelSelector",
                      },
                      direction: "Backward",
                    },
                  ],
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
          keys: new KeySet([{ className: "BisCore:ModelSelector", id: "0x30" }]),
          descriptor: {},
        });

        const { total, descriptor, items } = content!;
        expect(total).to.eq(1);
        const first = (await items.next()).value;
        expect(first.primaryKeys[0].className).to.eq("BisCore:SpatialViewDefinition");
        const field = getFieldByLabel(descriptor.fields, "Pitch");
        expect(first.values[field.name]).to.be.not.below(0);
      });
    });
  });
});
