/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";
import { OpenMode, using } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import { Ruleset, RootNodeRule, CustomNodeSpecification } from "@bentley/ecpresentation-common";

before(() => {
  initialize();
});

after(() => {
  terminate();
});

describe("Rulesets", async () => {

  let imodel: IModelConnection;
  let ruleset: Ruleset;

  before(async () => {
    const testIModelName: string = "assets/datasets/1K.bim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    ruleset = require("../../test-rulesets/Rulesets/default");
  });

  after(async () => {
    await imodel.closeStandalone();
  });

  it("creates ruleset from json and gets root node using it", async () => {
    const spec = ((ruleset.rules![0] as RootNodeRule).specifications![0] as CustomNodeSpecification);
    await using(await ECPresentation.presentation.rulesets().add(ruleset), async () => {
      const rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
      expect(rootNodes.length).to.be.equal(1);
      expect(rootNodes[0].label).to.be.equal(spec.label);
      expect(rootNodes[0].imageId).to.be.equal(spec.imageId);
      expect(rootNodes[0].description).to.be.equal(spec.description);
    });
  });

  it("removes ruleset", async () => {
    await ECPresentation.presentation.rulesets().add(ruleset);
    let rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
    expect(rootNodes.length).to.be.equal(1);

    await ECPresentation.presentation.rulesets().remove(ruleset);
    rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
    expect(rootNodes.length).to.be.equal(0);
  });

  it("clears rulesets from frontend", async () => {
    await ECPresentation.presentation.rulesets().add(ruleset);
    let rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
    expect(rootNodes.length).to.be.equal(1);

    await ECPresentation.presentation.rulesets().clear();
    rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
    expect(rootNodes.length).to.be.equal(0);
  });

});
