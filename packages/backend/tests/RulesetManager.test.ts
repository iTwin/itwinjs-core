/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { RegisteredRuleset } from "@bentley/presentation-common";
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
      const hash = faker.random.uuid();
      addonMock.setup((x) => x.getRulesets(ruleset.id)).returns(() => JSON.stringify([{ ruleset, hash }])).verifiable();
      const result = await manager.get(ruleset.id);
      addonMock.verifyAll();
      expect(result).to.not.be.undefined;
      expect(result!.toJSON()).to.deep.eq(ruleset);
      expect(result!.hash).to.eq(hash);
    });

    it("handles empty array response", async () => {
      const rulesetId = faker.random.uuid();
      addonMock.setup((x) => x.getRulesets(rulesetId)).returns(() => JSON.stringify([])).verifiable();
      const result = await manager.get(rulesetId);
      addonMock.verifyAll();
      expect(result).to.be.undefined;
    });

  });

  describe("add", () => {

    it("calls addon's addRuleset", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      const registeredRuleset = new RegisteredRuleset(manager, ruleset, hash);
      addonMock.setup((x) => x.addRuleset(JSON.stringify(ruleset))).returns(() => hash).verifiable();
      const result = await manager.add(ruleset);
      addonMock.verifyAll();
      expect(result).to.deep.equal(registeredRuleset);
    });

  });

  describe("remove", () => {

    it("calls addon's removeRuleset with [id, hash] argument", async () => {
      const rulesetId = faker.random.uuid();
      const hash = faker.random.uuid();
      addonMock.setup((x) => x.removeRuleset(rulesetId, hash)).returns(() => true).verifiable();
      const result = await manager.remove([rulesetId, hash]);
      addonMock.verifyAll();
      expect(result).to.be.true;
    });

    it("calls addon's removeRuleset with RegisteredRuleset argument", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const registered = new RegisteredRuleset(manager, ruleset, faker.random.uuid());
      addonMock.setup((x) => x.removeRuleset(ruleset.id, registered.hash)).returns(() => true).verifiable();
      const result = await manager.remove(registered);
      addonMock.verifyAll();
      expect(result).to.be.true;
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
