/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import { RegisteredRuleset } from "@itwin/presentation-common";
import { NativePlatformDefinition } from "../presentation-backend/NativePlatform";
import { RulesetManagerImpl } from "../presentation-backend/RulesetManager";

describe("RulesetManager", () => {

  let manager: RulesetManagerImpl;
  const addonMock = moq.Mock.ofType<NativePlatformDefinition>();
  beforeEach(() => {
    addonMock.reset();
    manager = new RulesetManagerImpl(() => addonMock.object);
  });

  describe("get", () => {

    it("calls addon's getRulesets", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      addonMock.setup((x) => x.getRulesets(ruleset.id)).returns(() => ({ result: JSON.stringify([{ ruleset, hash }]) })).verifiable();
      const result = manager.get(ruleset.id);
      addonMock.verifyAll();
      expect(result).to.not.be.undefined;
      expect(result!.toJSON()).to.deep.eq(ruleset);
      expect(result!.uniqueIdentifier).to.deep.eq(hash);
    });

    it("handles empty array response", async () => {
      const rulesetId = faker.random.uuid();
      addonMock.setup((x) => x.getRulesets(rulesetId)).returns(() => ({ result: JSON.stringify([]) })).verifiable();
      const result = manager.get(rulesetId);
      addonMock.verifyAll();
      expect(result).to.be.undefined;
    });

    it("does not call addon's getRulesets second time", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      addonMock.setup((x) => x.getRulesets(ruleset.id)).returns(() => ({ result: JSON.stringify([{ ruleset, hash }]) })).verifiable(moq.Times.once());
      manager.get(ruleset.id);
      const result = manager.get(ruleset.id);
      addonMock.verifyAll();
      expect(result).to.not.be.undefined;
      expect(result!.toJSON()).to.deep.eq(ruleset);
      expect(result!.uniqueIdentifier).to.deep.eq(hash);
    });

  });

  describe("add", () => {

    it("calls addon's addRuleset", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      addonMock.setup((x) => x.addRuleset(JSON.stringify(ruleset))).returns(() => ({ result: hash })).verifiable();
      const result = manager.add(ruleset);
      addonMock.verifyAll();
      expect(ruleset).to.deep.equal(result.toJSON());
      expect(hash).to.equal(result.uniqueIdentifier);
    });

    it("does not call addon's addRuleset second time", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      addonMock.setup((x) => x.addRuleset(JSON.stringify(ruleset))).returns(() => ({ result: hash })).verifiable(moq.Times.once());
      manager.add(ruleset);
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
      addonMock.setup((x) => x.removeRuleset(rulesetId, hash)).returns(() => ({ result: true })).verifiable();
      const result = manager.remove([rulesetId, hash]);
      addonMock.verifyAll();
      expect(result).to.be.true;
    });

    it("calls addon's removeRuleset with RegisteredRuleset argument", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const registered = new RegisteredRuleset(ruleset, faker.random.uuid(), (r: RegisteredRuleset) => manager.remove(r));
      addonMock.setup((x) => x.removeRuleset(ruleset.id, registered.uniqueIdentifier)).returns(() => ({ result: true })).verifiable();
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
      addonMock.setup((x) => x.getRulesets(ruleset.id)).returns(() => ({ result: JSON.stringify([{ ruleset, hash }]) })).verifiable();
      addonMock.setup((x) => x.removeRuleset(ruleset.id, hash)).returns(() => ({ result: true })).verifiable();

      const result = manager.get(ruleset.id);
      expect(result).to.not.be.undefined;
      result!.dispose();

      addonMock.verifyAll();
    });

    it("disposes registered ruleset for add result", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      addonMock.setup((x) => x.addRuleset(JSON.stringify(ruleset))).returns(() => ({ result: hash })).verifiable();
      addonMock.setup((x) => x.removeRuleset(ruleset.id, hash)).returns(() => ({ result: true })).verifiable();

      const result = manager.add(ruleset);
      expect(result).to.not.be.undefined;
      result.dispose();

      addonMock.verifyAll();
    });
  });

});
