/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { IModelConnection} from "@itwin/core-frontend";
import { SnapshotConnection } from "@itwin/core-frontend";
import type { Ruleset} from "@itwin/presentation-common";
import { ChildNodeSpecificationTypes, RuleTypes } from "@itwin/presentation-common";
import { Presentation, PresentationManager } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";

const RULESET: Ruleset = {
  id: "localization test",
  rules: [{
    ruleType: RuleTypes.RootNodes,
    specifications: [{
      specType: ChildNodeSpecificationTypes.CustomNode,
      type: "root",
      label: "@Test:string@",
      description: "@Test:nested.string@",
    }],
  }],
};

describe("Localization", async () => {

  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  it("localizes using app/test supplied localized strings", async () => {
    const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: RULESET });
    expect(nodes.length).to.eq(1);
    expect(nodes[0].label.displayValue).to.eq("test value");
    expect(nodes[0].description).to.eq("test nested value");
  });

  describe("Multiple frontends for one backend", async () => {

    let frontends: PresentationManager[];

    beforeEach(async () => {
      frontends = ["en", "test"].map((locale) => PresentationManager.create({ activeLocale: locale }));
    });

    afterEach(async () => {
      frontends.forEach((f) => f.dispose());
    });

    it("handles multiple simultaneous requests from different frontends with different locales", async () => {
      for (let i = 0; i < 100; ++i) {
        const nodes = {
          en: await frontends[0].getNodes({ imodel, rulesetOrId: RULESET }),
          test: await frontends[1].getNodes({ imodel, rulesetOrId: RULESET }),
        };

        expect(nodes.en[0].label.displayValue).to.eq("test value");
        expect(nodes.en[0].description).to.eq("test nested value");

        expect(nodes.test[0].label.displayValue).to.eq("_test_ string");
        expect(nodes.test[0].description).to.eq("_test_ nested string");
      }
    });

  });

});
