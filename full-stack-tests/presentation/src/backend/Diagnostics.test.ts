/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelDb, SnapshotDb } from "@itwin/core-backend";
import { using } from "@itwin/core-bentley";
import { PresentationManager } from "@itwin/presentation-backend";
import { ChildNodeSpecificationTypes, Diagnostics, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { initialize, terminate } from "../IntegrationTests";

describe("Diagnostics", async () => {

  const ruleset: Ruleset = {
    id: "ruleset",
    rules: [{
      ruleType: RuleTypes.RootNodes,
      specifications: [{
        specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
        classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
      }],
    }],
  };

  let imodel: IModelDb;
  before(async () => {
    await initialize();
    imodel = SnapshotDb.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).is.not.null;
  });

  after(async () => {
    imodel.close();
    await terminate();
  });

  it("includes diagnostics if request takes longer than minimum duration", async () => {
    await using(new PresentationManager(), async (manager) => {
      let diagnostics: Diagnostics | undefined;
      await manager.getNodes({
        imodel,
        rulesetOrId: ruleset,
        diagnostics: {
          perf: { minimumDuration: 2 },
          handler: (logs) => {
            diagnostics = logs;
          },
        },
      });
      expect(diagnostics).to.not.be.undefined;
    });
  });

  it("doesn't include diagnostics if request takes less time than minimum duration", async () => {
    await using(new PresentationManager(), async (manager) => {
      let diagnostics: Diagnostics | undefined;
      await manager.getNodes({
        imodel,
        rulesetOrId: ruleset,
        diagnostics: {
          perf: { minimumDuration: 5000 },
          handler: (logs) => {
            diagnostics = logs;
          },
        },
      });
      expect(diagnostics).to.be.undefined;
    });
  });

});
