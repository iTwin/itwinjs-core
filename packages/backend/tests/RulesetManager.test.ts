/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { RegisteredRuleSet } from "@common/index";
import { NativePlatformDefinition } from "@src/NativePlatform";
import RulesetManager from "@src/RulesetManager";

describe("RulesetManager", () => {

  let manager: RulesetManager;
  const addonMock = moq.Mock.ofType<NativePlatformDefinition>();
  beforeEach(() => {
    addonMock.reset();
    manager = new RulesetManager(() => addonMock.object);
  });

  describe("get", () => {

    it("throws", async () => {
      // just to get coverage until the method gets implemented
      await expect(manager.get("")).to.eventually.be.rejected;
    });

    it.skip("calls addon's getRuleSet", async () => {
      const ruleset = { ruleSetId: faker.random.uuid() };
      // addonMock.setup((x) => x.getRuleSet(ruleset.ruleSetId)).returns(() => { result: ruleset }).verifiable();
      const result = await manager.get(ruleset.ruleSetId);
      expect(result).to.deep.eq(ruleset);
      addonMock.verifyAll();
    });

  });

  describe("add", () => {

    it("calls addon's addRuleSet", async () => {
      const ruleset = { ruleSetId: faker.random.uuid() };
      const registeredRuleset = new RegisteredRuleSet(manager, ruleset);
      addonMock.setup((x) => x.addRuleSet(JSON.stringify(ruleset))).verifiable();
      const result = await manager.add(ruleset);
      expect(result).to.deep.equal(registeredRuleset);
      addonMock.verifyAll();
    });

  });

  describe("remove", () => {

    it("calls addon's removeRuleSet with id argument", async () => {
      const rulesetId = faker.random.uuid();
      addonMock.setup((x) => x.removeRuleSet(rulesetId)).verifiable();
      await manager.remove(rulesetId);
      addonMock.verifyAll();
    });

    it("calls addon's removeRuleSet with ruleset argument", async () => {
      const ruleset = { ruleSetId: faker.random.uuid() };
      addonMock.setup((x) => x.removeRuleSet(ruleset.ruleSetId)).verifiable();
      await manager.remove(ruleset);
      addonMock.verifyAll();
    });

  });

  describe("clear", () => {

    it("calls addon's clearRuleSets", async () => {
      addonMock.setup((x) => x.clearRuleSets()).verifiable();
      await manager.clear();
      addonMock.verifyAll();
    });

  });

});
