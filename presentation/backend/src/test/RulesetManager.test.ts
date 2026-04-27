/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { RegisteredRuleset } from "@itwin/presentation-common";
import { NativePlatformDefinition } from "../presentation-backend/NativePlatform.js";
import { RulesetManagerImpl } from "../presentation-backend/RulesetManager.js";

describe("RulesetManager", () => {
  let manager: RulesetManagerImpl;
  let addonMock: ReturnType<typeof stubAddon>;
  let addon: NativePlatformDefinition;

  beforeEach(() => {
    addonMock = stubAddon();
    addon = addonMock as unknown as NativePlatformDefinition;
    manager = new RulesetManagerImpl(() => addon);
  });

  afterEach(() => {
    sinon.restore();
  });

  function stubAddon() {
    return {
      getRulesets: sinon.stub(),
      addRuleset: sinon.stub(),
      removeRuleset: sinon.stub(),
      clearRulesets: sinon.stub(),
    };
  }

  describe("get", () => {
    it("calls addon's getRulesets", async () => {
      const ruleset = { id: "ruleset-id", rules: [] };
      const hash = "test-hash";
      addonMock.getRulesets.withArgs(ruleset.id).returns({ result: JSON.stringify([{ ruleset, hash }]) });
      const result = manager.get(ruleset.id);
      expect(addonMock.getRulesets).to.be.calledOnceWithExactly(ruleset.id);
      expect(result).to.not.be.undefined;
      expect(result!.toJSON()).to.deep.eq(ruleset);
      expect(result!.uniqueIdentifier).to.deep.eq(hash);
    });

    it("handles empty array response", async () => {
      const rulesetId = "ruleset-id";
      addonMock.getRulesets.withArgs(rulesetId).returns({ result: JSON.stringify([]) });
      const result = manager.get(rulesetId);
      expect(addonMock.getRulesets).to.be.calledOnceWithExactly(rulesetId);
      expect(result).to.be.undefined;
    });

    it("does not call addon's getRulesets second time", async () => {
      const ruleset = { id: "ruleset-id", rules: [] };
      const hash = "test-hash";
      addonMock.getRulesets.withArgs(ruleset.id).returns({ result: JSON.stringify([{ ruleset, hash }]) });
      manager.get(ruleset.id);
      const result = manager.get(ruleset.id);
      expect(addonMock.getRulesets).to.be.calledOnceWithExactly(ruleset.id);
      expect(result).to.not.be.undefined;
      expect(result!.toJSON()).to.deep.eq(ruleset);
      expect(result!.uniqueIdentifier).to.deep.eq(hash);
    });
  });

  describe("add", () => {
    it("calls addon's addRuleset", async () => {
      const ruleset = { id: "ruleset-id", rules: [] };
      const hash = "test-hash";
      addonMock.addRuleset.withArgs(JSON.stringify(ruleset)).returns({ result: hash });
      const result = manager.add(ruleset);
      expect(addonMock.addRuleset).to.be.calledOnceWithExactly(JSON.stringify(ruleset));
      expect(ruleset).to.deep.equal(result.toJSON());
      expect(hash).to.equal(result.uniqueIdentifier);
    });

    it("does not call addon's addRuleset second time", async () => {
      const ruleset = { id: "ruleset-id", rules: [] };
      const hash = "test-hash";
      addonMock.addRuleset.withArgs(JSON.stringify(ruleset)).returns({ result: hash });
      manager.add(ruleset);
      const result = manager.add(ruleset);
      expect(addonMock.addRuleset).to.be.calledOnceWithExactly(JSON.stringify(ruleset));
      expect(ruleset).to.deep.equal(result.toJSON());
      expect(hash).to.equal(result.uniqueIdentifier);
    });
  });

  describe("remove", () => {
    it("calls addon's removeRuleset with [id, hash] argument", async () => {
      const rulesetId = "ruleset-id";
      const hash = "test-hash";
      addonMock.removeRuleset.withArgs(rulesetId, hash).returns({ result: true });
      const result = manager.remove([rulesetId, hash]);
      expect(addonMock.removeRuleset).to.be.calledOnceWithExactly(rulesetId, hash);
      expect(result).to.be.true;
    });

    it("calls addon's removeRuleset with RegisteredRuleset argument", async () => {
      const ruleset = { id: "ruleset-id", rules: [] };
      const registered = new RegisteredRuleset(ruleset, "ruleset-id-unique", (r: RegisteredRuleset) => manager.remove(r));
      addonMock.removeRuleset.withArgs(ruleset.id, registered.uniqueIdentifier).returns({ result: true });
      const result = manager.remove(registered);
      expect(addonMock.removeRuleset).to.be.calledOnceWithExactly(ruleset.id, registered.uniqueIdentifier);
      expect(result).to.be.true;
    });
  });

  describe("clear", () => {
    it("calls addon's clearRulesets", async () => {
      addonMock.clearRulesets.withArgs();
      manager.clear();
      expect(addonMock.clearRulesets).to.be.calledOnce;
    });
  });

  describe("dispose", () => {
    it("disposes registered ruleset for get result", async () => {
      const ruleset = { id: "ruleset-id", rules: [] };
      const hash = "test-hash";
      addonMock.getRulesets.withArgs(ruleset.id).returns({ result: JSON.stringify([{ ruleset, hash }]) });
      addonMock.removeRuleset.withArgs(ruleset.id, hash).returns({ result: true });

      const result = manager.get(ruleset.id);
      expect(result).to.not.be.undefined;
      result![Symbol.dispose]();

      expect(addonMock.getRulesets).to.be.calledOnceWithExactly(ruleset.id);
      expect(addonMock.removeRuleset).to.be.calledOnceWithExactly(ruleset.id, hash);
    });

    it("disposes registered ruleset for add result", async () => {
      const ruleset = { id: "ruleset-id", rules: [] };
      const hash = "test-hash";
      addonMock.addRuleset.withArgs(JSON.stringify(ruleset)).returns({ result: hash });
      addonMock.removeRuleset.withArgs(ruleset.id, hash).returns({ result: true });

      const result = manager.add(ruleset);
      expect(result).to.not.be.undefined;
      result[Symbol.dispose]();

      expect(addonMock.addRuleset).to.be.calledOnceWithExactly(JSON.stringify(ruleset));
      expect(addonMock.removeRuleset).to.be.calledOnceWithExactly(ruleset.id, hash);
    });
  });
});
