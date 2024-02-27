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

  describe("MultiSchemaClasses", () => {
    it("uses all attributes", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.MultiSchemaClasses.Ruleset
      // This ruleset produces content for instances of `bis.PhysicalModel` and `bis.SpatialCategory` classes.
      // Descendants of these classes will be considered incompatible with the specified class filter because
      // `arePolymorphic` attribute is set to`false`.
      const ruleset: Ruleset = {
        id: "example",
        rules: [
          {
            ruleType: "Content",
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: {
                  schemaName: "BisCore",
                  classNames: ["PhysicalModel", "SpatialCategory"],
                  arePolymorphic: false,
                },
              },
            ],
          },
        ],
      };
      // __PUBLISH_EXTRACT_END__
      printRuleset(ruleset);

      // Ensure that `bis.PhysicalModel` and `bis.SpatialCategory` instances are selected.
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet(),
        descriptor: {},
      });

      expect(content!.contentSet).to.have.lengthOf(2);
      expect(content!.contentSet).to.containSubset([
        {
          primaryKeys: [{ className: "BisCore:PhysicalModel" }],
        },
      ]);
      expect(content!.contentSet).to.containSubset([
        {
          primaryKeys: [{ className: "BisCore:SpatialCategory" }],
        },
      ]);
    });
  });
});
