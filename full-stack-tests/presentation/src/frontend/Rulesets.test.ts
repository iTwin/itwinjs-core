/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { using } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, RegisteredRuleset, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation, PresentationManager } from "@itwin/presentation-frontend";
import { initialize, resetBackend, terminate } from "../IntegrationTests";

const RULESET_1: Ruleset = {
  id: "ruleset_1",
  rules: [{
    ruleType: RuleTypes.RootNodes,
    specifications: [{
      specType: ChildNodeSpecificationTypes.CustomNode,
      type: "test 1",
      label: "label 1",
    }],
  }],
};

const RULESET_2: Ruleset = {
  id: "ruleset_2",
  rules: [{
    ruleType: RuleTypes.RootNodes,
    specifications: [{
      specType: ChildNodeSpecificationTypes.CustomNode,
      type: "test 2",
      label: "label 2",
    }],
  }],
};

describe("Rulesets", async () => {

  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  it("creates ruleset from json and gets root node using it", async () => {
    await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(RULESET_1), async () => {
      const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: RULESET_1.id });
      expect(rootNodes.length).to.be.equal(1);
      expect(rootNodes[0].label.displayValue).to.equal("label 1");
    });
    await Presentation.presentation.rulesets().clear();
  });

  it("removes ruleset", async () => {
    const registeredRuleset = await Presentation.presentation.rulesets().add(RULESET_1);
    let rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: RULESET_1.id });
    expect(rootNodes.length).to.be.equal(1);

    expect(await Presentation.presentation.rulesets().remove(registeredRuleset)).to.be.true;
    rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: RULESET_1.id });
    expect(rootNodes.length).to.be.equal(0);

    expect(await Presentation.presentation.rulesets().remove(registeredRuleset)).to.be.false;
  });

  it("doesn't overwrite ruleset", async () => {
    const otherRuleset = { ...RULESET_2, id: RULESET_1.id };
    const registeredRuleset1 = await Presentation.presentation.rulesets().add(RULESET_1);
    const registeredRuleset2 = await Presentation.presentation.rulesets().add(otherRuleset);
    expect(await Presentation.presentation.rulesets().remove(registeredRuleset1)).to.be.true;
    expect(await Presentation.presentation.rulesets().remove(registeredRuleset2)).to.be.true;
  });

  it("clears rulesets from frontend", async () => {
    await Presentation.presentation.rulesets().add(RULESET_1);
    let rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: RULESET_1.id });
    expect(rootNodes.length).to.be.equal(1);

    await Presentation.presentation.rulesets().clear();
    rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: RULESET_1.id });
    expect(rootNodes.length).to.be.equal(0);
  });

  describe("Multiple frontends for one backend", async () => {

    let frontends: PresentationManager[];

    beforeEach(async () => {
      frontends = [0, 1].map(() => PresentationManager.create());
    });

    afterEach(async () => {
      frontends.forEach((f) => f.dispose());
    });

    it("handles multiple simultaneous requests from different frontends with different rulesets with same id", async () => {
      const rulesets = [{
        ...RULESET_1,
        id: "test",
      }, {
        ...RULESET_2,
        id: "test",
      }];

      const registeredRulesets = await Promise.all(frontends.map(async (f, i) => f.rulesets().add(rulesets[i])));

      const nodes = await Promise.all(frontends.map(async (f) => f.getNodes({ imodel, rulesetOrId: "test" })));
      frontends.forEach((_f, i) => {
        expect(nodes[i][0].label.displayValue).to.eq(`label ${i + 1}`);
      });

      registeredRulesets.forEach((r) => r.dispose());
    });

  });

  describe("Multiple backends for one frontend", async () => {

    let frontend: PresentationManager;

    beforeEach(async () => {
      frontend = PresentationManager.create();
    });

    afterEach(async () => {
      frontend.dispose();
    });

    it("can use the same frontend-registered ruleset after backend is reset", async () => {
      const props = { imodel, rulesetOrId: RULESET_1.id };
      await using<RegisteredRuleset, Promise<void>>(await frontend.rulesets().add(RULESET_1), async () => {
        const rootNodes1 = await frontend.getNodes(props);
        expect(rootNodes1.length).to.be.equal(1);
        expect(rootNodes1[0].label.displayValue).to.be.equal("label 1");

        resetBackend();

        const rootNodes2 = await frontend.getNodes(props);
        expect(rootNodes2.length).to.be.equal(1);
        expect(rootNodes2[0].label.displayValue).to.be.equal("label 1");
        expect(rootNodes2).to.deep.eq(rootNodes1);
      });
    });

  });

});
