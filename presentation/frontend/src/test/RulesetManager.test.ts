/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import { RegisteredRuleset, Rule, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { createRandomRuleset } from "@itwin/presentation-common/lib/cjs/test";
import { RulesetManagerImpl } from "../presentation-frontend/RulesetManager";

describe("RulesetManager", () => {

  let onRulesetModifiedSpy: sinon.SinonSpy<[RegisteredRuleset, Ruleset], Promise<void>>;
  let manager: RulesetManagerImpl;

  beforeEach(() => {
    onRulesetModifiedSpy = sinon.stub<[RegisteredRuleset, Ruleset], Promise<void>>().resolves();
    manager = RulesetManagerImpl.create();
    manager.onRulesetModified.addListener(onRulesetModifiedSpy);
  });

  describe("get", () => {

    it("returns undefined when ruleset is not registered", async () => {
      expect(await manager.get(faker.random.word())).to.be.undefined;
    });

    it("returns registered ruleset", async () => {
      const ruleset = await createRandomRuleset();
      const added = await manager.add(ruleset);
      const result = await manager.get(ruleset.id);
      expect(result).to.not.be.undefined;
      expect(result!.toJSON()).to.deep.eq(ruleset);
      expect(result!.uniqueIdentifier).to.eq(added.uniqueIdentifier);
    });

  });

  describe("add", () => {

    it("registers a ruleset", async () => {
      const ruleset = await createRandomRuleset();
      await manager.add(ruleset);
      expect((await manager.get(ruleset.id))!.toJSON()).to.deep.eq(ruleset);
    });

    it("allows registering 2 rulesets with the same id", async () => {
      const rulesetId = faker.random.uuid();
      const rulesets = [await createRandomRuleset(), await createRandomRuleset()];
      await Promise.all(rulesets.map(async (r) => {
        r.id = rulesetId;
        return manager.add(r);
      }));
    });

  });

  describe("modify", () => {

    it("modifies given ruleset and raises the `onRulesetModified` event", async () => {
      const initialRuleset = await createRandomRuleset();
      const registered = await manager.add(initialRuleset);
      expect(await manager.get(initialRuleset.id)).to.eq(registered);
      const newRule: Rule = {
        ruleType: RuleTypes.Content,
        condition: "test",
        specifications: [],
      };
      const modified = await manager.modify(registered, { rules: [newRule] });
      expect(modified.rules).to.deep.eq([newRule]);
      expect(onRulesetModifiedSpy).to.be.calledOnce;
      expect(onRulesetModifiedSpy.firstCall.args[0]).to.eq(modified);
      expect(onRulesetModifiedSpy.firstCall.args[1]).to.deep.eq(initialRuleset);
    });

  });

  describe("remove", () => {

    it("does nothing if ruleset with the specified id is not registered", async () => {
      expect(await manager.remove([faker.random.uuid(), faker.random.uuid()])).to.be.false;
    });

    it("does nothing if ruleset with the specified uniqueIdentifier is not registered", async () => {
      const ruleset = await createRandomRuleset();
      await manager.add(ruleset);
      expect(await manager.remove([ruleset.id, faker.random.uuid()])).to.be.false;
    });

    it("removes ruleset with [id, uniqueIdentifier] argument", async () => {
      const ruleset = await createRandomRuleset();
      const registered = await manager.add(ruleset);
      expect(await manager.get(ruleset.id)).to.not.be.undefined;
      expect(await manager.remove([ruleset.id, registered.uniqueIdentifier])).to.be.true;
      expect(await manager.get(ruleset.id)).to.be.undefined;
    });

    it("removes ruleset with RegisteredRuleset argument", async () => {
      const ruleset = await createRandomRuleset();
      const registered = await manager.add(ruleset);
      expect(await manager.get(ruleset.id)).to.not.be.undefined;
      expect(await manager.remove(registered)).to.be.true;
      expect(await manager.get(ruleset.id)).to.be.undefined;
    });

  });

  describe("clear", () => {

    it("clears only if there are rulesets", async () => {
      await manager.clear();
    });

    it("clears rulesets", async () => {
      const ruleset = await createRandomRuleset();
      await manager.add(ruleset);
      await manager.clear();
    });

  });

  describe("dispose", () => {

    it("disposes registered ruleset for add result", async () => {
      const ruleset = await createRandomRuleset();
      const result = await manager.add(ruleset);
      const eventSpy = sinon.spy(manager, "remove");

      result.dispose();
      expect(eventSpy).to.have.been.calledOnce;
    });

  });

});
