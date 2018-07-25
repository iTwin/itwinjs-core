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
      interfaceMock.setup((x) => x.getRuleset(requestOptions(), ruleset.id)).returns(async () => ruleset).verifiable();
      const result = await manager.get(ruleset.id);
      expect(result).to.not.be.undefined;
      expect(result!.toJSON()).to.deep.eq(ruleset);
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
      const registeredRuleset = new RegisteredRuleset(manager, ruleset);
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
      const ruleset = { id: faker.random.uuid(), rules: [] };
      interfaceMock.setup((x) => x.removeRuleset(requestOptions(), ruleset.id)).verifiable();
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
