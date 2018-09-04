/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/tests/_helpers/Mocks";
import { createRandomId } from "@bentley/presentation-common/tests/_helpers/random";
import { Id64 } from "@bentley/bentleyjs-core";
import { VariableValueTypes } from "@bentley/presentation-common/lib/IRulesetVariablesManager";
import { NativePlatformDefinition } from "../lib/NativePlatform";
import RulesetVariablesManager from "../lib/RulesetVariablesManager";

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

    it("calls addon's setRulesetVariableValue with boolean", async () => {
      const value = faker.random.boolean();
      await manager.setValue(variableId, VariableValueTypes.Bool, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Bool, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with Id64", async () => {
      const value = createRandomId();
      await manager.setValue(variableId, VariableValueTypes.Id64, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64, value.value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with Id64[]", async () => {
      const value = [createRandomId()];
      await manager.setValue(variableId, VariableValueTypes.Id64Array, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array, value.map((v) => v.value)), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with number", async () => {
      const value = faker.random.number();
      await manager.setValue(variableId, VariableValueTypes.Int, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Int, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with number[]", async () => {
      const value = [faker.random.number()];
      await manager.setValue(variableId, VariableValueTypes.IntArray, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.IntArray, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with string", async () => {
      const value = faker.random.words();
      await manager.setValue(variableId, VariableValueTypes.String, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String, value), moq.Times.once());
    });

  });

  describe("getValue", () => {

    it("calls addon's getRulesetVariableValue with boolean", async () => {
      const value = faker.random.boolean();
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Bool))
        .returns(() => value).verifiable(moq.Times.once());
      const result = await manager.getValue(variableId, VariableValueTypes.Bool);
      addonMock.verifyAll();
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with Id64", async () => {
      const value = createRandomId();
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64))
        .returns(() => value.value).verifiable(moq.Times.once());
      const result = await manager.getValue(variableId, VariableValueTypes.Id64);
      addonMock.verifyAll();
      expect(result).to.be.instanceOf(Id64);
      expect((result as Id64).value).to.eq(value.value);
    });

    it("calls addon's getRulesetVariableValue with Id64[]", async () => {
      const value = [createRandomId()];
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array))
        .returns(() => value.map((v) => v.value)).verifiable(moq.Times.once());
      const result = await manager.getValue(variableId, VariableValueTypes.Id64Array);
      addonMock.verifyAll();
      expect(Array.isArray(result)).to.be.true;
      (result as Id64[]).forEach((r, i) => {
        expect(r).to.be.instanceOf(Id64);
        expect(r.value).to.eq(value[i].value);
      });
    });

    it("calls addon's getRulesetVariableValue with number", async () => {
      const value = faker.random.number();
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Int))
        .returns(() => value).verifiable(moq.Times.once());
      const result = await manager.getValue(variableId, VariableValueTypes.Int);
      addonMock.verifyAll();
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with number[]", async () => {
      const value = [faker.random.number()];
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.IntArray))
        .returns(() => value).verifiable(moq.Times.once());
      const result = await manager.getValue(variableId, VariableValueTypes.IntArray);
      addonMock.verifyAll();
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with string", async () => {
      const value = faker.random.words();
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String))
        .returns(() => value).verifiable(moq.Times.once());
      const result = await manager.getValue(variableId, VariableValueTypes.String);
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
