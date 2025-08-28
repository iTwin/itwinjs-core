/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection } from "@itwin/core-frontend";
import { KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation, PresentationManager } from "@itwin/presentation-frontend";
import { initialize, resetBackend, terminate } from "../IntegrationTests.js";
import { collect } from "../Utils.js";
import { TestIModelConnection } from "../IModelSetupUtils.js";

const RULESET_1: Ruleset = {
  id: "ruleset_1",
  rules: [
    {
      ruleType: RuleTypes.Content,
      specifications: [
        {
          specType: "ContentInstancesOfSpecificClasses",
          classes: { schemaName: "BisCore", classNames: ["Subject"], arePolymorphic: true },
          instanceFilter: "this.ECInstanceId = 0x1",
        },
      ],
    },
  ],
};

const RULESET_2: Ruleset = {
  id: "ruleset_2",
  rules: [
    {
      ruleType: "Content",
      specifications: [
        {
          specType: "ContentInstancesOfSpecificClasses",
          classes: { schemaName: "BisCore", classNames: ["Model"], arePolymorphic: true },
          instanceFilter: "this.ECInstanceId = 0x1",
        },
      ],
    },
  ],
};

describe("Rulesets", async () => {
  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = TestIModelConnection.openFile(testIModelName);
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  it("creates ruleset from json and gets content item using it", async () => {
    using _registered = await Presentation.presentation.rulesets().add(RULESET_1);
    const items = await Presentation.presentation
      .getContentIterator({ imodel, rulesetOrId: RULESET_1.id, keys: new KeySet(), descriptor: {} })
      .then(async (x) => collect(x!.items));
    expect(items.length).to.be.equal(1);
    expect(items[0].primaryKeys).to.deep.equal([{ className: "BisCore:Subject", id: "0x1" }]);
  });

  it("removes ruleset", async () => {
    const registeredRuleset = await Presentation.presentation.rulesets().add(RULESET_1);
    let items = await Presentation.presentation
      .getContentIterator({ imodel, rulesetOrId: RULESET_1.id, keys: new KeySet(), descriptor: {} })
      .then(async (x) => collect(x!.items));
    expect(items.length).to.be.equal(1);

    expect(await Presentation.presentation.rulesets().remove(registeredRuleset)).to.be.true;
    items = await Presentation.presentation
      .getContentIterator({ imodel, rulesetOrId: RULESET_1.id, keys: new KeySet(), descriptor: {} })
      .then(async (x) => (x ? collect(x.items) : []));
    expect(items.length).to.be.equal(0);

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
    const items = await Presentation.presentation
      .getContentIterator({ imodel, rulesetOrId: RULESET_1.id, keys: new KeySet(), descriptor: {} })
      .then(async (x) => collect(x!.items));
    expect(items.length).to.be.equal(1);

    await Presentation.presentation.rulesets().clear();
    const content = await Presentation.presentation.getContentIterator({ imodel, rulesetOrId: RULESET_1.id, keys: new KeySet(), descriptor: {} });
    expect(content).to.be.undefined;
  });

  describe("Multiple frontends for one backend", async () => {
    let frontends: PresentationManager[];

    beforeEach(async () => {
      frontends = [0, 1].map(() => PresentationManager.create());
    });

    afterEach(async () => {
      frontends.forEach((f) => f[Symbol.dispose]());
    });

    it("handles multiple simultaneous requests from different frontends with different rulesets with same id", async () => {
      const rulesets = [
        {
          ...RULESET_1,
          id: "test",
        },
        {
          ...RULESET_2,
          id: "test",
        },
      ];

      const registeredRulesets = await Promise.all(frontends.map(async (f, i) => f.rulesets().add(rulesets[i])));

      const items = await Promise.all(
        frontends.map(async (f) =>
          f.getContentIterator({ imodel, rulesetOrId: "test", keys: new KeySet(), descriptor: {} }).then(async (x) => collect(x!.items)),
        ),
      );
      frontends.forEach((_f, i) => {
        expect(items[i][0].primaryKeys).to.deep.equal([{ className: i === 0 ? "BisCore:Subject" : "BisCore:RepositoryModel", id: "0x1" }]);
      });

      registeredRulesets.forEach((r) => r[Symbol.dispose]());
    });
  });

  describe("Multiple backends for one frontend", async () => {
    let frontend: PresentationManager;

    beforeEach(async () => {
      frontend = PresentationManager.create();
    });

    afterEach(async () => {
      frontend[Symbol.dispose]();
    });

    it("can use the same frontend-registered ruleset after backend is reset", async () => {
      const props = { imodel, rulesetOrId: RULESET_1.id, keys: new KeySet(), descriptor: {} };
      using _registered = await frontend.rulesets().add(RULESET_1);
      const items1 = await frontend.getContentIterator(props).then(async (x) => collect(x!.items));
      expect(items1.length).to.be.equal(1);
      expect(items1[0].primaryKeys).to.deep.equal([{ className: "BisCore:Subject", id: "0x1" }]);

      resetBackend();

      const items2 = await frontend.getContentIterator(props).then(async (x) => collect(x!.items));
      expect(items2).to.deep.eq(items1);
    });
  });
});
