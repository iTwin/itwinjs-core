/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@helpers/Mocks";
import { createRandomId } from "@helpers/random";
import { PresentationRpcInterface } from "@bentley/presentation-common";
import { VariableValueTypes } from "@bentley/presentation-common/lib/IRulesetVariablesManager";
import RulesetVariablesManager from "@src/RulesetVariablesManager";
import { initializeRpcInterface } from "@helpers/RpcHelper";

describe("RulesetVariablesManager", () => {

  let interfaceMock: moq.IMock<PresentationRpcInterface>;
  let vars: RulesetVariablesManager;
  const testData = {
    rulesetId: "",
    variableId: "",
    clientId: "",
  };

  beforeEach(() => {
    initializeRpcInterface(PresentationRpcInterface);

    interfaceMock = moq.Mock.ofType<PresentationRpcInterface>();
    PresentationRpcInterface.getClient = () => interfaceMock.object;

    testData.clientId = faker.random.uuid();
    testData.rulesetId = faker.random.uuid();
    testData.variableId = faker.random.word();

    vars = new RulesetVariablesManager(testData.clientId, testData.rulesetId);
  });

  const requestOptions = () => ({
    rulesetId: testData.rulesetId,
    clientId: testData.clientId,
    variableId: testData.variableId,
  });

  describe("getString", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const value = faker.random.word();
      interfaceMock
        .setup((x) => x.getRulesetVariableValue(requestOptions(), VariableValueTypes.String))
        .returns(async () => value)
        .verifiable();
      const result = await vars.getString(testData.variableId);
      interfaceMock.verifyAll();
      expect(result).to.equal(value);
    });

  });

  describe("setString", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const value = faker.random.word();
      interfaceMock
        .setup((x) => x.setRulesetVariableValue(requestOptions(), VariableValueTypes.String, value))
        .verifiable();
      await vars.setString(testData.variableId, value);
      interfaceMock.verifyAll();
    });

  });

  describe("getBool", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const value = faker.random.boolean();
      interfaceMock
        .setup((x) => x.getRulesetVariableValue(requestOptions(), VariableValueTypes.Bool))
        .returns(async () => value)
        .verifiable();
      const result = await vars.getBool(testData.variableId);
      interfaceMock.verifyAll();
      expect(result).to.equal(value);
    });

  });

  describe("setBool", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const value = faker.random.boolean();
      interfaceMock
        .setup((x) => x.setRulesetVariableValue(requestOptions(), VariableValueTypes.Bool, value))
        .verifiable();
      await vars.setBool(testData.variableId, value);
      interfaceMock.verifyAll();
    });

  });

  describe("getInt", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const value = faker.random.number();
      interfaceMock
        .setup((x) => x.getRulesetVariableValue(requestOptions(), VariableValueTypes.Int))
        .returns(async () => value)
        .verifiable();
      const result = await vars.getInt(testData.variableId);
      interfaceMock.verifyAll();
      expect(result).to.equal(value);
    });

  });

  describe("setInt", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const value = faker.random.number();
      interfaceMock
        .setup((x) => x.setRulesetVariableValue(requestOptions(), VariableValueTypes.Int, value))
        .verifiable();
      await vars.setInt(testData.variableId, value);
      interfaceMock.verifyAll();
    });

  });

  describe("getInts", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const valuesArray = [faker.random.number(), faker.random.number(), faker.random.number()];
      interfaceMock
        .setup((x) => x.getRulesetVariableValue(requestOptions(), VariableValueTypes.IntArray))
        .returns(async () => valuesArray)
        .verifiable();
      const result = await vars.getInts(testData.variableId);
      interfaceMock.verifyAll();
      expect(result).to.deep.equal(valuesArray);
    });

  });

  describe("setInts", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const valuesArray = [faker.random.number(), faker.random.number(), faker.random.number()];
      interfaceMock
        .setup((x) => x.setRulesetVariableValue(requestOptions(), VariableValueTypes.IntArray, valuesArray))
        .verifiable();
      await vars.setInts(testData.variableId, valuesArray);
      interfaceMock.verifyAll();
    });

  });

  describe("getId64", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const value = createRandomId();
      interfaceMock
        .setup((x) => x.getRulesetVariableValue(requestOptions(), VariableValueTypes.Id64))
        .returns(async () => value.value)
        .verifiable();
      const result = await vars.getId64(testData.variableId);
      interfaceMock.verifyAll();
      expect(result).to.deep.equal(value);
    });

  });

  describe("setId64", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const value = createRandomId();
      interfaceMock
        .setup((x) => x.setRulesetVariableValue(requestOptions(), VariableValueTypes.Id64, value.value))
        .verifiable();
      await vars.setId64(testData.variableId, value);
      interfaceMock.verifyAll();
    });

  });

  describe("getId64s", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const valueArray = [createRandomId(), createRandomId(), createRandomId()];
      interfaceMock
        .setup((x) => x.getRulesetVariableValue(requestOptions(), VariableValueTypes.Id64Array))
        .returns(async () => valueArray.map((v) => v.value))
        .verifiable();
      const result = await vars.getId64s(testData.variableId);
      interfaceMock.verifyAll();
      expect(result).to.deep.equal(valueArray);
    });

  });

  describe("setId64s", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const valueArray = [createRandomId(), createRandomId(), createRandomId()];
      interfaceMock
        .setup((x) => x.setRulesetVariableValue(requestOptions(), VariableValueTypes.Id64Array, valueArray.map((v) => v.value)))
        .verifiable();
      await vars.setId64s(testData.variableId, valueArray);
      interfaceMock.verifyAll();
    });

  });

});
