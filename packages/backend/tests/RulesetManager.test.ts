/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { RegisteredRuleset } from "@common/index";
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

    it("calls addon's getRulesets", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      addonMock.setup((x) => x.getRulesets(ruleset.id)).returns(() => JSON.stringify([ruleset])).verifiable();
      const result = await manager.get(ruleset.id);
      expect(result).to.not.be.undefined;
      expect(result!.toJSON()).to.deep.eq(ruleset);
      addonMock.verifyAll();
    });

    it("handles empty array response", async () => {
      const rulesetId = faker.random.uuid();
      addonMock.setup((x) => x.getRulesets(rulesetId)).returns(() => JSON.stringify([])).verifiable();
      const result = await manager.get(rulesetId);
      expect(result).to.be.undefined;
      addonMock.verifyAll();
    });

  });

  describe("add", () => {

    it("calls addon's addRuleset", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const registeredRuleset = new RegisteredRuleset(manager, ruleset);
      addonMock.setup((x) => x.addRuleset(JSON.stringify(ruleset))).verifiable();
      const result = await manager.add(ruleset);
      expect(result).to.deep.equal(registeredRuleset);
      addonMock.verifyAll();
    });

  });

  describe("remove", () => {

    it("calls addon's removeRuleset with id argument", async () => {
      const rulesetId = faker.random.uuid();
      addonMock.setup((x) => x.removeRuleset(rulesetId)).verifiable();
      await manager.remove(rulesetId);
      addonMock.verifyAll();
    });

    it("calls addon's removeRuleset with ruleset argument", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      addonMock.setup((x) => x.removeRuleset(ruleset.id)).verifiable();
      await manager.remove(ruleset);
      addonMock.verifyAll();
    });

  });

  describe("clear", () => {

    it("calls addon's clearRulesets", async () => {
      addonMock.setup((x) => x.clearRulesets()).verifiable();
      await manager.clear();
      addonMock.verifyAll();
    });

  });

});
