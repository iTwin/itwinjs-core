/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import { VariableValueTypes } from "@itwin/presentation-common";
import { NativePlatformDefinition } from "../presentation-backend/NativePlatform.js";
import { RulesetVariablesManagerImpl } from "../presentation-backend/RulesetVariablesManager.js";

describe("RulesetVariablesManager", () => {
  let manager: RulesetVariablesManagerImpl;
  let rulesetId = "";
  let variableId = "";
  let addonMock: ReturnType<typeof stubAddon>;
  let addon: NativePlatformDefinition;

  beforeEach(() => {
    rulesetId = "test-ruleset-id";
    variableId = "test-var-id";
    addonMock = stubAddon();
    addon = addonMock as unknown as NativePlatformDefinition;
    manager = new RulesetVariablesManagerImpl(() => addon, rulesetId);
  });

  afterEach(() => {
    sinon.restore();
  });

  function stubAddon() {
    return {
      setRulesetVariableValue: sinon.stub(),
      unsetRulesetVariableValue: sinon.stub(),
      getRulesetVariableValue: sinon.stub(),
    };
  }

  describe("setValue", () => {
    it("calls addon's setRulesetVariableValue with boolean", async () => {
      const value = false;
      manager.setValue(variableId, VariableValueTypes.Bool, value);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Bool, value);
    });

    it("calls addon's setRulesetVariableValue with Id64", async () => {
      const value = "0x123";
      manager.setValue(variableId, VariableValueTypes.Id64, value);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Id64, value);
    });

    it("calls addon's setRulesetVariableValue with Id64[]", async () => {
      const value = ["0x123"];
      manager.setValue(variableId, VariableValueTypes.Id64Array, value);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Id64Array, value);
    });

    it("calls addon's setRulesetVariableValue with number", async () => {
      const value = 1753;
      manager.setValue(variableId, VariableValueTypes.Int, value);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Int, value);
    });

    it("calls addon's setRulesetVariableValue with number[]", async () => {
      const value = [456];
      manager.setValue(variableId, VariableValueTypes.IntArray, value);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.IntArray, value);
    });

    it("calls addon's setRulesetVariableValue with string", async () => {
      const value = "sample text";
      manager.setValue(variableId, VariableValueTypes.String, value);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.String, value);
    });
  });

  describe("unset", () => {
    it("calls addon's unsetRulesetVariableValue", async () => {
      manager.unset(variableId);
      expect(addonMock.unsetRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId);
    });
  });

  describe("getValue", () => {
    it("calls addon's getRulesetVariableValue with boolean", async () => {
      const value = true;
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Bool).returns({ result: value });
      const result = manager.getValue(variableId, VariableValueTypes.Bool);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Bool);
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with Id64", async () => {
      const value = "0x123";
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Id64).returns({ result: value });
      const result = manager.getValue(variableId, VariableValueTypes.Id64);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Id64);
      expect(typeof result).to.eq("string");
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with Id64[]", async () => {
      const value = ["0x123"];
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Id64Array).returns({ result: value });
      const result = manager.getValue(variableId, VariableValueTypes.Id64Array);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Id64Array);
      expect(Array.isArray(result)).to.be.true;
      (result as Id64String[]).forEach((r, i) => {
        expect(typeof r).to.equal("string");
        expect(r).to.eq(value[i]);
      });
    });

    it("calls addon's getRulesetVariableValue with number", async () => {
      const value = 2025;
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Int).returns({ result: value });
      const result = manager.getValue(variableId, VariableValueTypes.Int);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Int);
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with number[]", async () => {
      const value = [1991];
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.IntArray).returns({ result: value });
      const result = manager.getValue(variableId, VariableValueTypes.IntArray);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.IntArray);
      expect(result).to.eq(value);
    });

    it("calls addon's getRulesetVariableValue with string", async () => {
      const value = "sample text";
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.String).returns({ result: value });
      const result = manager.getValue(variableId, VariableValueTypes.String);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.String);
      expect(result).to.eq(value);
    });
  });

  describe("getString", () => {
    it("gets string variable value", async () => {
      const value = "lorem ipsum";
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.String).returns({ result: value });
      const result = manager.getString(variableId);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.String);
      expect(result).to.equal(value);
    });
  });

  describe("setString", () => {
    it("sets string variable value", async () => {
      const value = "some text";
      addonMock.setRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.String, value);
      manager.setString(variableId, value);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.String, value);
    });
  });

  describe("getBool", () => {
    it("gets boolean variable value", async () => {
      const value = false;
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Bool).returns({ result: value });
      const result = manager.getBool(variableId);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Bool);
      expect(result).to.equal(value);
    });
  });

  describe("setBool", () => {
    it("sets boolean variable value", async () => {
      const value = true;
      addonMock.setRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Bool, value);
      manager.setBool(variableId, value);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Bool, value);
    });
  });

  describe("getInt", () => {
    it("gets integer variable value", async () => {
      const value = 456;
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Int).returns({ result: value });
      const result = manager.getInt(variableId);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Int);
      expect(result).to.equal(value);
    });
  });

  describe("setInt", () => {
    it("sets integer variable value", async () => {
      const value = 789;
      addonMock.setRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Int, value);
      manager.setInt(variableId, value);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Int, value);
    });
  });

  describe("getInts", () => {
    it("gets integer array variable value", async () => {
      const valueArray = [111, 222, 333];
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.IntArray).returns({ result: valueArray });
      const result = manager.getInts(variableId);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.IntArray);
      expect(result).to.deep.eq(valueArray);
    });
  });

  describe("setInts", () => {
    it("sets integer array variable value", async () => {
      const valueArray = [9, 8, 7];
      addonMock.setRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.IntArray, valueArray);
      manager.setInts(variableId, valueArray);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.IntArray, valueArray);
    });
  });

  describe("getId64", () => {
    it("gets Id64 variable value", async () => {
      const value = "0x123";
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Id64).returns({ result: value });
      const result = manager.getId64(variableId);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Id64);
      expect(typeof result).to.eq("string");
      expect(result).to.deep.equal(value);
    });
  });

  describe("setId64", () => {
    it("sets Id64 variable value", async () => {
      const value = "0x123";
      addonMock.setRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Id64, value);
      manager.setId64(variableId, value);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Id64, value);
    });
  });

  describe("getId64s", () => {
    it("gets Id64 array variable value", async () => {
      const valueArray = ["0x123", "0x123", "0x123"];
      addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Id64Array).returns({ result: valueArray });
      const result = manager.getId64s(variableId);
      expect(result).to.deep.equal(valueArray);
      expect(addonMock.getRulesetVariableValue).to.be.calledOnceWithExactly(rulesetId, variableId, VariableValueTypes.Id64Array);
    });
  });

  describe("setId64s", () => {
    it("sets Id64 array variable value", async () => {
      const valueArray = ["0x123", "0x123", "0x123"];
      addonMock.setRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.Id64Array, OrderedId64Iterable.sortArray(valueArray));
      manager.setId64s(variableId, valueArray);
      expect(addonMock.setRulesetVariableValue).to.be.calledOnceWithExactly(
        rulesetId,
        variableId,
        VariableValueTypes.Id64Array,
        OrderedId64Iterable.sortArray(valueArray),
      );
    });
  });
});
