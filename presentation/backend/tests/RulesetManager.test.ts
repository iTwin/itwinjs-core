/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect, spy } from "chai";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/tests/_helpers/Mocks";
import { RegisteredRuleset } from "@bentley/presentation-common";
import { NativePlatformDefinition } from "../lib/NativePlatform";
import RulesetManager from "../lib/RulesetManager";

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
      const result = manager.get(ruleset.id);
      addonMock.verifyAll();
      expect(result).to.not.be.undefined;
      expect(result!.toJSON()).to.deep.eq(ruleset);
      expect(result!.uniqueIdentifier).to.deep.eq(hash);
    });

    it("handles empty array response", async () => {
      const rulesetId = faker.random.uuid();
      addonMock.setup((x) => x.getRulesets(rulesetId)).returns(() => JSON.stringify([])).verifiable();
      const result = manager.get(rulesetId);
      addonMock.verifyAll();
      expect(result).to.be.undefined;
    });

  });

  describe("add", () => {

    it("calls addon's addRuleset", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      addonMock.setup((x) => x.addRuleset(JSON.stringify(ruleset))).returns(() => hash).verifiable();
      const result = manager.add(ruleset);
      addonMock.verifyAll();
      expect(ruleset).to.deep.equal(result.toJSON());
      expect(hash).to.equal(result.uniqueIdentifier);
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
      const registered = new RegisteredRuleset(ruleset, faker.random.uuid(), (ruleset: RegisteredRuleset) => manager.remove(ruleset));
      addonMock.setup((x) => x.removeRuleset(ruleset.id, registered.uniqueIdentifier)).returns(() => true).verifiable();
      const result = manager.remove(registered);
      addonMock.verifyAll();
      expect(result).to.be.true;
    });

  });

  describe("clear", () => {

    it("calls addon's clearRulesets", async () => {
      addonMock.setup((x) => x.clearRulesets()).verifiable();
      manager.clear();
      addonMock.verifyAll();
    });

  });

  describe("dispose", () => {

    it("disposes registered ruleset for get result", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      addonMock.setup((x) => x.getRulesets(ruleset.id)).returns(() => JSON.stringify([{ ruleset, hash }])).verifiable();
      const result = await manager.get(ruleset.id);
      const eventSpy = spy.on(manager, manager.remove.name);

      expect(result).to.not.be.undefined;
      (result as RegisteredRuleset).dispose();
      expect(eventSpy).to.have.been.called();
    });

    it("disposes registered ruleset for add result", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      addonMock.setup((x) => x.addRuleset(JSON.stringify(ruleset))).returns(() => hash).verifiable();
      const result = manager.add(ruleset);
      const eventSpy = spy.on(manager, manager.remove.name);

      expect(result).to.not.be.undefined;
      result.dispose();
      expect(eventSpy).to.have.been.called();
    });
  });

});
