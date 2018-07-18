/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { initializeRpcInterface } from "@helpers/RpcHelper";
import { RegisteredRuleSet } from "@common/index";
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

    it("throws", async () => {
      // just to get coverage until the method gets implemented
      await expect(manager.get("")).to.eventually.be.rejected;
    });

    it.skip("calls getRuleset through proxy", async () => {
      const ruleset = { ruleSetId: faker.random.uuid() };
      // interfaceMock.setup((x) => x.getRuleSet(ruleset.ruleSetId)).returns(() => { result: ruleset }).verifiable();
      const result = await manager.get(ruleset.ruleSetId);
      expect(result).to.deep.eq(ruleset);
      interfaceMock.verifyAll();
    });

  });

  describe("add", () => {

    it("calls addRuleset through proxy", async () => {
      const ruleset = { ruleSetId: faker.random.uuid() };
      const registeredRuleset = new RegisteredRuleSet(manager, ruleset);
      interfaceMock.setup((x) => x.addRuleset(requestOptions(), ruleset)).verifiable();
      const result = await manager.add(ruleset);
      expect(result).to.deep.equal(registeredRuleset);
      interfaceMock.verifyAll();
    });

  });

  describe("remove", () => {

    it("calls removeRuleSet through proxy with id argument", async () => {
      const rulesetId = faker.random.uuid();
      interfaceMock.setup((x) => x.removeRuleset(requestOptions(), rulesetId)).verifiable();
      await manager.remove(rulesetId);
      interfaceMock.verifyAll();
    });

    it("calls removeRuleSet through proxy with ruleset argument", async () => {
      const ruleset = { ruleSetId: faker.random.uuid() };
      interfaceMock.setup((x) => x.removeRuleset(requestOptions(), ruleset.ruleSetId)).verifiable();
      await manager.remove(ruleset);
      interfaceMock.verifyAll();
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
