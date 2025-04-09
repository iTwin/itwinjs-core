/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import { VariableValueTypes } from "@itwin/presentation-common";
import { NativePlatformDefinition } from "../presentation-backend/NativePlatform.js";
import { RulesetVariablesManagerImpl } from "../presentation-backend/RulesetVariablesManager.js";

describe("RulesetVariablesManager", () => {
  let manager: RulesetVariablesManagerImpl;
  let rulesetId = "";
  let variableId = "";
  const addonMock = moq.Mock.ofType<NativePlatformDefinition>();
  beforeEach(() => {
    addonMock.reset();
    rulesetId = "test-ruleset-id";
    variableId = "test-var-id";
    manager = new RulesetVariablesManagerImpl(() => addonMock.object, rulesetId);
  });

  describe("setValue", () => {
    it("calls addon's setRulesetVariableValue with boolean", async () => {
      const value = false;
      manager.setValue(variableId, VariableValueTypes.Bool, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Bool, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with Id64", async () => {
      const value = "0x123";
      manager.setValue(variableId, VariableValueTypes.Id64, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with Id64[]", async () => {
      const value = ["0x123"];
      manager.setValue(variableId, VariableValueTypes.Id64Array, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with number", async () => {
      const value = 1753;
      manager.setValue(variableId, VariableValueTypes.Int, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Int, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with number[]", async () => {
      const value = [456];
      manager.setValue(variableId, VariableValueTypes.IntArray, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.IntArray, value), moq.Times.once());
    });

    it("calls addon's setRulesetVariableValue with string", async () => {
      const value = "sample text";
      manager.setValue(variableId, VariableValueTypes.String, value);
      addonMock.verify((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String, value), moq.Times.once());
    });
  });

  describe("unset", () => {
    it("calls addon's unsetRulesetVariableValue", async () => {
      manager.unset(variableId);
      addonMock.verify((x) => x.unsetRulesetVariableValue(rulesetId, variableId), moq.Times.once());
    });
  });

  describe("getValue", () => {
    it("calls addon's getRulesetVariableValue with boolean", async () => {
      const value = true;
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Bool))
        .returns(() => ({ result: value }))
        .verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.Bool);
      addonMock.verifyAll();
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with Id64", async () => {
      const value = "0x123";
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64))
        .returns(() => ({ result: value }))
        .verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.Id64);
      addonMock.verifyAll();
      expect(typeof result).to.eq("string");
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with Id64[]", async () => {
      const value = ["0x123"];
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array))
        .returns(() => ({ result: value }))
        .verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.Id64Array);
      addonMock.verifyAll();
      expect(Array.isArray(result)).to.be.true;
      (result as Id64String[]).forEach((r, i) => {
        expect(typeof r).to.equal("string");
        expect(r).to.eq(value[i]);
      });
    });

    it("calls addon's getRulesetVariableValue with number", async () => {
      const value = 2025;
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Int))
        .returns(() => ({ result: value }))
        .verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.Int);
      addonMock.verifyAll();
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with number[]", async () => {
      const value = [1991];
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.IntArray))
        .returns(() => ({ result: value }))
        .verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.IntArray);
      addonMock.verifyAll();
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with string", async () => {
      const value = "sample text";
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String))
        .returns(() => ({ result: value }))
        .verifiable(moq.Times.once());
      const result = manager.getValue(variableId, VariableValueTypes.String);
      addonMock.verifyAll();
      expect(result).to.eq(value);
    });
  });

  describe("getString", () => {
    it("gets string variable value", async () => {
      const value = "lorem ipsum";
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String))
        .returns(() => ({ result: value }))
        .verifiable();
      const result = manager.getString(variableId);
      addonMock.verifyAll();
      expect(result).to.equal(value);
    });
  });

  describe("setString", () => {
    it("sets string variable value", async () => {
      const value = "some text";
      addonMock.setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String, value)).verifiable();
      manager.setString(variableId, value);
      addonMock.verifyAll();
    });
  });

  describe("getBool", () => {
    it("gets boolean variable value", async () => {
      const value = false;
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Bool))
        .returns(() => ({ result: value }))
        .verifiable();
      const result = manager.getBool(variableId);
      addonMock.verifyAll();
      expect(result).to.equal(value);
    });
  });

  describe("setBool", () => {
    it("sets boolean variable value", async () => {
      const value = true;
      addonMock.setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Bool, value)).verifiable();
      manager.setBool(variableId, value);
      addonMock.verifyAll();
    });
  });

  describe("getInt", () => {
    it("gets integer variable value", async () => {
      const value = 456;
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Int))
        .returns(() => ({ result: value }))
        .verifiable();
      const result = manager.getInt(variableId);
      addonMock.verifyAll();
      expect(result).to.equal(value);
    });
  });

  describe("setInt", () => {
    it("sets integer variable value", async () => {
      const value = 789;
      addonMock.setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Int, value)).verifiable();
      manager.setInt(variableId, value);
      addonMock.verifyAll();
    });
  });

  describe("getInts", () => {
    it("gets integer array variable value", async () => {
      const valueArray = [111, 222, 333];
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.IntArray))
        .returns(() => ({ result: valueArray }))
        .verifiable();
      const result = manager.getInts(variableId);
      addonMock.verifyAll();
      expect(result).to.deep.eq(valueArray);
    });
  });

  describe("setInts", () => {
    it("sets integer array variable value", async () => {
      const valueArray = [9, 8, 7];
      addonMock.setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.IntArray, valueArray)).verifiable();
      manager.setInts(variableId, valueArray);
      addonMock.verifyAll();
    });
  });

  describe("getId64", () => {
    it("gets Id64 variable value", async () => {
      const value = "0x123";
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64))
        .returns(() => ({ result: value }))
        .verifiable();
      const result = manager.getId64(variableId);
      addonMock.verifyAll();
      expect(typeof result).to.eq("string");
      expect(result).to.deep.equal(value);
    });
  });

  describe("setId64", () => {
    it("sets Id64 variable value", async () => {
      const value = "0x123";
      addonMock.setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64, value)).verifiable();
      manager.setId64(variableId, value);
      addonMock.verifyAll();
    });
  });

  describe("getId64s", () => {
    it("gets Id64 array variable value", async () => {
      const valueArray = ["0x123", "0x123", "0x123"];
      addonMock
        .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array))
        .returns(() => ({ result: valueArray }))
        .verifiable();
      const result = manager.getId64s(variableId);
      expect(result).to.deep.equal(valueArray);
      addonMock.verifyAll();
    });
  });

  describe("setId64s", () => {
    it("sets Id64 array variable value", async () => {
      const valueArray = ["0x123", "0x123", "0x123"];
      addonMock
        .setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.Id64Array, OrderedId64Iterable.sortArray(valueArray)))
        .verifiable();
      manager.setId64s(variableId, valueArray);
      addonMock.verifyAll();
    });
  });
});
