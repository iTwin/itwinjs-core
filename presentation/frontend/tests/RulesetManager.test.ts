/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { RegisteredRuleset } from "@bentley/presentation-common";
import { RpcRequestsHandler } from "@bentley/presentation-common";
import RulesetManager from "@src/RulesetManager";
import { using } from "@bentley/bentleyjs-core";
import { createRandomRuleset } from "@helpersrandom";

describe("RulesetManager", () => {

  let rpcRequestsHandlerMock: moq.IMock<RpcRequestsHandler>;
  let manager: RulesetManager;

  beforeEach(() => {
    rpcRequestsHandlerMock = moq.Mock.ofType<RpcRequestsHandler>();
    rpcRequestsHandlerMock.setup((x) => x.syncHandlers).returns(() => new Array<() => Promise<void>>());
    manager = new RulesetManager(rpcRequestsHandlerMock.object);
  });

  afterEach(() => {
    manager.dispose();
  });

  describe("constructor", () => {

    it("registers a sync handler", () => {
      const syncHandlers = new Array<() => Promise<void>>();
      rpcRequestsHandlerMock.reset();
      rpcRequestsHandlerMock.setup((x) => x.syncHandlers).returns(() => syncHandlers);
      using(new RulesetManager(rpcRequestsHandlerMock.object), () => {
        expect(syncHandlers.length).to.eq(1);
      });
    });

  });

  describe("dispose", () => {

    it("unregisters its sync handler", () => {
      const syncHandlers = new Array<() => Promise<void>>();
      rpcRequestsHandlerMock.reset();
      rpcRequestsHandlerMock.setup((x) => x.syncHandlers).returns(() => syncHandlers);
      const m = new RulesetManager(rpcRequestsHandlerMock.object);
      expect(syncHandlers.length).to.eq(1);
      m.dispose();
      expect(syncHandlers.length).to.eq(0);
    });

  });

  describe("syncWithBackend", () => {

    const syncHandlers = new Array<() => Promise<void>>();

    beforeEach(() => {
      rpcRequestsHandlerMock.reset();
      rpcRequestsHandlerMock.setup((x) => x.syncHandlers).returns(() => syncHandlers);
      manager.dispose();
      manager = new RulesetManager(rpcRequestsHandlerMock.object);
    });

    afterEach(() => {
      manager.dispose();
    });

    it("does nothing if there're no client rulesets", async () => {
      await Promise.all(syncHandlers.map((sh) => sh()));
      rpcRequestsHandlerMock.verify((x) => x.addRulesets(moq.It.isAny()), moq.Times.never());
    });

    it("adds all client rulesets using rpc requests handler", async () => {
      const rulesets = await Promise.all([createRandomRuleset(), createRandomRuleset()]);
      await Promise.all(rulesets.map((r) => manager.add(r)));
      await Promise.all(syncHandlers.map((sh) => sh()));
      rpcRequestsHandlerMock.verify((x) => x.addRulesets(rulesets), moq.Times.once());
    });

  });

  describe("get", () => {

    it("calls getRuleset through proxy", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      rpcRequestsHandlerMock.setup((x) => x.getRuleset(ruleset.id)).returns(async () => [ruleset, hash]).verifiable();
      const result = await manager.get(ruleset.id);
      expect(result).to.not.be.undefined;
      expect(result!.toJSON()).to.deep.eq(ruleset);
      expect(result!.hash).to.eq(hash);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("handles undefined response", async () => {
      const rulesetId = faker.random.uuid();
      rpcRequestsHandlerMock.setup((x) => x.getRuleset(rulesetId)).returns(async () => undefined).verifiable();
      const result = await manager.get(rulesetId);
      expect(result).to.be.undefined;
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("add", () => {

    it("calls addRuleset through proxy", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      const registeredRuleset = new RegisteredRuleset(manager, ruleset, hash);
      rpcRequestsHandlerMock.setup((x) => x.addRuleset(ruleset)).returns(async () => hash).verifiable();
      const result = await manager.add(ruleset);
      rpcRequestsHandlerMock.verifyAll();
      expect(result).to.deep.equal(registeredRuleset);
    });

  });

  describe("remove", () => {

    it("calls removeRuleset through proxy with [rulesetId, hash] argument", async () => {
      const rulesetId = faker.random.uuid();
      const hash = faker.random.uuid();
      rpcRequestsHandlerMock.setup((x) => x.removeRuleset(rulesetId, hash)).returns(async () => true).verifiable();
      const result = await manager.remove([rulesetId, hash]);
      rpcRequestsHandlerMock.verifyAll();
      expect(result).to.be.true;
    });

    it("calls removeRuleset through proxy with RegisteredRuleset argument", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      rpcRequestsHandlerMock.setup((x) => x.removeRuleset(ruleset.id, hash)).returns(async () => true).verifiable();
      const result = await manager.remove(new RegisteredRuleset(manager, ruleset, hash));
      rpcRequestsHandlerMock.verifyAll();
      expect(result).to.be.true;
    });

  });

  describe("clear", () => {

    it("calls clearRulesets through proxy", async () => {
      rpcRequestsHandlerMock.setup((x) => x.clearRulesets()).verifiable();
      await manager.clear();
      rpcRequestsHandlerMock.verifyAll();
    });

  });

});
