/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import { createRandomId } from "@helpers/random";
import * as faker from "faker";
import { Id64 } from "@bentley/bentleyjs-core";
import { VariableValueTypes } from "@bentley/ecpresentation-common/lib/IRulesetVariablesManager";
import { NativePlatformDefinition } from "@src/NativePlatform";
import RulesetVariablesManager from "@src/RulesetVariablesManager";

describe("RulesetVariablesManager", () => {

  let manager: RulesetVariablesManager;
  let rulesetId = "";
  let variableId = "";
  const addonMock = moq.Mock.ofType<NativePlatformDefinition>();
  beforeEach(() => {
    addonMock.reset();
    rulesetId = faker.random.word();
    variableId = faker.random.word();
    manager = new RulesetVariablesManager(() => addonMock.object, rulesetId);
  });

  describe("setValue", () => {

    it("calls addon's setRulesetVariableValue", async () => {
      const value = faker.random.words();
      await manager.setValue(variableId, VariableValueTypes.String, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String, value), moq.Times.once());
    });

  });

  describe("getValue", () => {

    it("calls addon's getRulesetVariableValue", async () => {
      const value = faker.random.number();
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Int))
        .returns(() => value).verifiable(moq.Times.once());
      const result = await manager.getValue(variableId, VariableValueTypes.Int);
      addonMock.verifyAll();
      expect(result).to.eq(value);
    });

  });

  describe("getString", () => {

    it("gets string variable value", async () => {
      const value = faker.random.words();
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String))
        .returns(() => value)
        .verifiable();
      const result = await manager.getString(variableId);
      addonMock.verifyAll();
      expect(result).to.equal(value);
    });

  });

  describe("setString", () => {

    it("sets string variable value", async () => {
      const value = faker.random.words();
      addonMock
        .setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String, value))
        .verifiable();
      await manager.setString(variableId, value);
      addonMock.verifyAll();
    });

  });

  describe("getBool", () => {

    it("gets boolean variable value", async () => {
      const value = faker.random.boolean();
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Bool))
        .returns(() => value)
        .verifiable();
      const result = await manager.getBool(variableId);
      addonMock.verifyAll();
      expect(result).to.equal(value);
    });

  });

  describe("setBool", () => {

    it("sets boolean variable value", async () => {
      const value = faker.random.boolean();
      addonMock
        .setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Bool, value))
        .verifiable();
      await manager.setBool(variableId, value);
      addonMock.verifyAll();
    });

  });

  describe("getInt", () => {

    it("gets integer variable value", async () => {
      const value = faker.random.number();
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Int))
        .returns(() => (value))
        .verifiable();
      const result = await manager.getInt(variableId);
      addonMock.verifyAll();
      expect(result).to.equal(value);
    });

  });

  describe("setInt", () => {

    it("sets integer variable value", async () => {
      const value = faker.random.number();
      addonMock
        .setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Int, value))
        .verifiable();
      await manager.setInt(variableId, value);
      addonMock.verifyAll();
    });

  });

  describe("getInts", () => {

    it("gets integer array variable value", async () => {
      const valueArray = [faker.random.number(), faker.random.number(), faker.random.number()];
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.IntArray))
        .returns(() => valueArray)
        .verifiable();
      const result = await manager.getInts(variableId);
      addonMock.verifyAll();
      expect(result).to.deep.eq(valueArray);
    });

  });

  describe("setInts", () => {

    it("sets integer array variable value", async () => {
      const valueArray = [faker.random.number(), faker.random.number(), faker.random.number()];
      addonMock
        .setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.IntArray, valueArray))
        .verifiable();
      await manager.setInts(variableId, valueArray);
      addonMock.verifyAll();
    });

  });

  describe("getId64", () => {

    it("gets Id64 variable value", async () => {
      const value = createRandomId();
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64))
        .returns(() => value.value)
        .verifiable();
      const result = await manager.getId64(variableId);
      addonMock.verifyAll();
      expect(result).to.be.instanceof(Id64);
      expect(result).to.deep.equal(value);
    });

  });

  describe("setId64", () => {

    it("sets Id64 variable value", async () => {
      const value = createRandomId();
      addonMock
        .setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64, value.value))
        .verifiable();
      await manager.setId64(variableId, value);
      addonMock.verifyAll();
    });

  });

  describe("getId64s", () => {

    it("gets Id64 array variable value", async () => {
      const valueArray = [createRandomId(), createRandomId(), createRandomId()];
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array))
        .returns(() => valueArray.map((v) => v.value))
        .verifiable();
      const result = await manager.getId64s(variableId);
      expect(result).to.deep.equal(valueArray);
      addonMock.verifyAll();
    });

  });

  describe("setId64s", () => {

    it("sets Id64 array variable value", async () => {
      const valueArray = [createRandomId(), createRandomId(), createRandomId()];
      addonMock
        .setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array, valueArray.map((v) => v.value)))
        .verifiable();
      await manager.setId64s(variableId, valueArray);
      addonMock.verifyAll();
    });

  });

});
