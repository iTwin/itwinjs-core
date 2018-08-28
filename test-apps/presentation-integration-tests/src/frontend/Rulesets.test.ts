/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";
import { OpenMode, using } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Presentation } from "@bentley/presentation-frontend";
import { Ruleset, RootNodeRule, CustomNodeSpecification } from "@bentley/presentation-common";

describe("Rulesets", async () => {

  let imodel: IModelConnection;
  let ruleset: Ruleset;

  before(async () => {
    initialize();
    const testIModelName: string = "assets/datasets/1K.bim";
    imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
    ruleset = require("../../test-rulesets/Rulesets/default");
  });

  after(async () => {
    await imodel.closeStandalone();
    terminate();
  });

  it("creates ruleset from json and gets root node using it", async () => {
    const spec = ((ruleset.rules![0] as RootNodeRule).specifications![0] as CustomNodeSpecification);
    await using(await Presentation.presentation.rulesets().add(ruleset), async () => {
      const rootNodes = await Presentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
      expect(rootNodes.length).to.be.equal(1);
      expect(rootNodes[0].label).to.be.equal(spec.label);
    });
  });

  it("removes ruleset", async () => {
    const registeredRuleset = await Presentation.presentation.rulesets().add(ruleset);
    let rootNodes = await Presentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
    expect(rootNodes.length).to.be.equal(1);

    expect(await Presentation.presentation.rulesets().remove(registeredRuleset)).to.be.true;
    rootNodes = await Presentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
    expect(rootNodes.length).to.be.equal(0);

    expect(await Presentation.presentation.rulesets().remove(registeredRuleset)).to.be.false;
  });

  it("overwrites ruleset", async () => {
    const otherRuleset: Ruleset = require("../../test-rulesets/Rulesets/other");
    otherRuleset.id = ruleset.id;
    const registeredRuleset1 = await Presentation.presentation.rulesets().add(ruleset);
    const registeredRuleset2 = await Presentation.presentation.rulesets().add(otherRuleset);
    expect(await Presentation.presentation.rulesets().remove(registeredRuleset1)).to.be.false;
    expect(await Presentation.presentation.rulesets().remove(registeredRuleset2)).to.be.true;
  });

  it("clears rulesets from frontend", async () => {
    await Presentation.presentation.rulesets().add(ruleset);
    let rootNodes = await Presentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
    expect(rootNodes.length).to.be.equal(1);

    await Presentation.presentation.rulesets().clear();
    rootNodes = await Presentation.presentation.getRootNodes({ imodel, rulesetId: ruleset.id });
    expect(rootNodes.length).to.be.equal(0);
  });

});
