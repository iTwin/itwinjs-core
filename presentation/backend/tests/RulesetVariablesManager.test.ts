/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/tests/_helpers/Mocks";
import { createRandomId } from "@bentley/presentation-common/tests/_helpers/random";
import { Id64String } from "@bentley/bentleyjs-core";
import { VariableValueTypes } from "@bentley/presentation-common/lib/RulesetVariables";
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
      manager.setValue(variableId, VariableValueTypes.Bool, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Bool, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with Id64", async () => {
      const value = createRandomId();
      manager.setValue(variableId, VariableValueTypes.Id64, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with Id64[]", async () => {
      const value = [createRandomId()];
      manager.setValue(variableId, VariableValueTypes.Id64Array, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array, value.map((v) => v)), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with number", async () => {
      const value = faker.random.number();
      manager.setValue(variableId, VariableValueTypes.Int, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Int, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with number[]", async () => {
      const value = [faker.random.number()];
      manager.setValue(variableId, VariableValueTypes.IntArray, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.IntArray, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with string", async () => {
      const value = faker.random.words();
      manager.setValue(variableId, VariableValueTypes.String, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String, value), moq.Times.once());
    });

  });

  describe("getValue", () => {

    it("calls addon's getRulesetVariableValue with boolean", async () => {
      const value = faker.random.boolean();
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Bool))
        .returns(() => value).verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.Bool);
      addonMock.verifyAll();
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with Id64", async () => {
      const value = createRandomId();
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64))
        .returns(() => value).verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.Id64);
      addonMock.verifyAll();
      expect(typeof result).to.eq("string");
      expect(result as Id64String).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with Id64[]", async () => {
      const value = [createRandomId()];
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array))
        .returns(() => value.map((v) => v)).verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.Id64Array);
      addonMock.verifyAll();
      expect(Array.isArray(result)).to.be.true;
      (result as Id64String[]).forEach((r, i) => {
        expect(typeof r).to.equal("string");
        expect(r).to.eq(value[i]);
      });
    });

    it("calls addon's getRulesetVariableValue with number", async () => {
      const value = faker.random.number();
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Int))
        .returns(() => value).verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.Int);
      addonMock.verifyAll();
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with number[]", async () => {
      const value = [faker.random.number()];
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.IntArray))
        .returns(() => value).verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.IntArray);
      addonMock.verifyAll();
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with string", async () => {
      const value = faker.random.words();
      addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String))
        .returns(() => value).verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.String);
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
      const result = manager.getString(variableId);
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
      manager.setString(variableId, value);
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
      const result = manager.getBool(variableId);
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
      manager.setBool(variableId, value);
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
      const result = manager.getInt(variableId);
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
      manager.setInt(variableId, value);
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
      const result = manager.getInts(variableId);
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
      manager.setInts(variableId, valueArray);
      addonMock.verifyAll();
    });

  });

  describe("getId64", () => {

    it("gets Id64 variable value", async () => {
      const value = createRandomId();
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64))
        .returns(() => value)
        .verifiable();
      const result = manager.getId64(variableId);
      addonMock.verifyAll();
      expect(typeof result).to.eq("string");
      expect(result).to.deep.equal(value);
    });

  });

  describe("setId64", () => {

    it("sets Id64 variable value", async () => {
      const value = createRandomId();
      addonMock
        .setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64, value))
        .verifiable();
      manager.setId64(variableId, value);
      addonMock.verifyAll();
    });

  });

  describe("getId64s", () => {

    it("gets Id64 array variable value", async () => {
      const valueArray = [createRandomId(), createRandomId(), createRandomId()];
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array))
        .returns(() => valueArray.map((v) => v))
        .verifiable();
      const result = manager.getId64s(variableId);
      expect(result).to.deep.equal(valueArray);
      addonMock.verifyAll();
    });

  });

  describe("setId64s", () => {

    it("sets Id64 array variable value", async () => {
      const valueArray = [createRandomId(), createRandomId(), createRandomId()];
      addonMock
        .setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array, valueArray.map((v) => v)))
        .verifiable();
      manager.setId64s(variableId, valueArray);
      addonMock.verifyAll();
    });

  });

});
