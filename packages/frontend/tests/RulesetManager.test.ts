/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { initializeRpcInterface } from "@helpers/RpcHelper";
import { RegisteredRuleset } from "@common/index";
import { ECPresentationRpcInterface } from "@common/index";
import RulesetManager from "@src/RulesetManager";

describe("RulesetManager", () => {

  let interfaceMock: moq.IMock<ECPresentationRpcInterface>;
  let manager: RulesetManager;
  const testData = {
    clientId: "",
  };

  beforeEach(() => {
    initializeRpcInterface(ECPresentationRpcInterface);

    interfaceMock = moq.Mock.ofType<ECPresentationRpcInterface>();
    ECPresentationRpcInterface.getClient = () => interfaceMock.object;

    testData.clientId = faker.random.uuid();

    manager = new RulesetManager(testData.clientId);
  });

  const requestOptions = () => ({
    clientId: testData.clientId,
  });

  describe("get", () => {

    it("calls getRuleset through proxy", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      interfaceMock.setup((x) => x.getRuleset(requestOptions(), ruleset.id)).returns(async () => [ruleset, hash]).verifiable();
      const result = await manager.get(ruleset.id);
      expect(result).to.not.be.undefined;
      expect(result!.toJSON()).to.deep.eq(ruleset);
      expect(result!.hash).to.eq(hash);
      interfaceMock.verifyAll();
    });

    it("handles undefined response", async () => {
      const rulesetId = faker.random.uuid();
      interfaceMock.setup((x) => x.getRuleset(requestOptions(), rulesetId)).returns(async () => undefined).verifiable();
      const result = await manager.get(rulesetId);
      expect(result).to.be.undefined;
      interfaceMock.verifyAll();
    });

  });

  describe("add", () => {

    it("calls addRuleset through proxy", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      const registeredRuleset = new RegisteredRuleset(manager, ruleset, hash);
      interfaceMock.setup((x) => x.addRuleset(requestOptions(), ruleset)).returns(async () => hash).verifiable();
      const result = await manager.add(ruleset);
      interfaceMock.verifyAll();
      expect(result).to.deep.equal(registeredRuleset);
    });

  });

  describe("remove", () => {

    it("calls removeRuleset through proxy with [rulesetId, hash] argument", async () => {
      const rulesetId = faker.random.uuid();
      const hash = faker.random.uuid();
      interfaceMock.setup((x) => x.removeRuleset(requestOptions(), rulesetId, hash)).returns(async () => true).verifiable();
      const result = await manager.remove([rulesetId, hash]);
      interfaceMock.verifyAll();
      expect(result).to.be.true;
    });

    it("calls removeRuleset through proxy with RegisteredRuleset argument", async () => {
      const ruleset = { id: faker.random.uuid(), rules: [] };
      const hash = faker.random.uuid();
      interfaceMock.setup((x) => x.removeRuleset(requestOptions(), ruleset.id, hash)).returns(async () => true).verifiable();
      const result = await manager.remove(new RegisteredRuleset(manager, ruleset, hash));
      interfaceMock.verifyAll();
      expect(result).to.be.true;
    });

  });

  describe("clear", () => {

    it("calls clearRulesets through proxy", async () => {
      interfaceMock.setup((x) => x.clearRulesets(requestOptions())).verifiable();
      await manager.clear();
      interfaceMock.verifyAll();
    });

  });

});
