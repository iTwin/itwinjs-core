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
    });
  });

  it("removes ruleset", async () => {
    const registeredRuleset = await ECPresentation.presentation.rulesets().add(ruleset);
    let rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
    expect(rootNodes.length).to.be.equal(1);

    expect(await ECPresentation.presentation.rulesets().remove(registeredRuleset)).to.be.true;
    rootNodes = await ECPresentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
    expect(rootNodes.length).to.be.equal(0);

    expect(await ECPresentation.presentation.rulesets().remove(registeredRuleset)).to.be.false;
  });

  it("overwrites ruleset", async () => {
    const otherRuleset: Ruleset = require("../../test-rulesets/Rulesets/other");
    otherRuleset.id = ruleset.id;
    const registeredRuleset1 = await ECPresentation.presentation.rulesets().add(ruleset);
    const registeredRuleset2 = await ECPresentation.presentation.rulesets().add(otherRuleset);
    expect(await ECPresentation.presentation.rulesets().remove(registeredRuleset1)).to.be.false;
    expect(await ECPresentation.presentation.rulesets().remove(registeredRuleset2)).to.be.true;
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
