/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as faker from "faker";
import sinon from "sinon";
import * as moq from "typemoq";
import { Id64 } from "@itwin/core-bentley";
import { IpcApp } from "@itwin/core-frontend";
import type { RulesetVariable} from "@itwin/presentation-common";
import { VariableValueTypes } from "@itwin/presentation-common";
import { createRandomId } from "@itwin/presentation-common/lib/cjs/test";
import type { IpcRequestsHandler } from "../presentation-frontend/IpcRequestsHandler";
import { RulesetVariablesManagerImpl } from "../presentation-frontend/RulesetVariablesManager";

describe("RulesetVariablesManager", () => {

  let vars: RulesetVariablesManagerImpl;
  let variableId: string;

  beforeEach(() => {
    variableId = faker.random.word();
    vars = new RulesetVariablesManagerImpl("test-ruleset-id");
  });

  describe("one-backend-one-frontend mode", () => {

    it("calls ipc handler to set variable value on backend", async () => {
      sinon.stub(IpcApp, "isValid").get(() => true);
      const ipcHandlerMock = moq.Mock.ofType<IpcRequestsHandler>();
      const rulesetId = "test-ruleset-id";
      vars = new RulesetVariablesManagerImpl(rulesetId, ipcHandlerMock.object);

      const testVariable: RulesetVariable = {
        id: "test-var-id",
        type: VariableValueTypes.String,
        value: "test-value",
      };
      ipcHandlerMock.setup(async (x) => x.setRulesetVariable(moq.It.isObjectWith({ rulesetId, variable: testVariable }))).verifiable(moq.Times.once());

      await vars.setString(testVariable.id, testVariable.value);
      ipcHandlerMock.verifyAll();
    });

    it("calls ipc handler to unset variable value on backend", async () => {
      sinon.stub(IpcApp, "isValid").get(() => true);
      const ipcHandlerMock = moq.Mock.ofType<IpcRequestsHandler>();
      const rulesetId = "test-ruleset-id";

      vars = new RulesetVariablesManagerImpl(rulesetId, ipcHandlerMock.object);
      await vars.setString("test-id", "test-value");

      ipcHandlerMock.setup(async (x) => x.unsetRulesetVariable(moq.It.isObjectWith({ rulesetId, variableId: "test-id" }))).verifiable(moq.Times.once());
      await vars.unset("test-id");
      ipcHandlerMock.verifyAll();
    });

  });

  describe("getAllVariables", () => {

    it("return empty array if there's no variables", async () => {
      expect(vars.getAllVariables()).to.deep.eq([]);
    });

    it("returns variables", async () => {
      const variables = [{ id: variableId, type: VariableValueTypes.String, value: faker.random.word() }];
      await vars.setString(variables[0].id, variables[0].value);
      const allVariables = vars.getAllVariables();
      expect(allVariables).to.deep.eq(variables);
    });
  });

  describe("unset", () => {

    it("unsets existing value", async () => {
      await vars.setString(variableId, "a");
      expect(vars.getAllVariables()).to.deep.eq([{
        id: variableId,
        type: VariableValueTypes.String,
        value: "a",
      }]);
      await vars.unset(variableId);
      expect(vars.getAllVariables()).to.deep.eq([]);
    });

    it("doesn't raise onVariableChanged event when value is not set", async () => {
      const spy = sinon.spy();
      vars.onVariableChanged.addListener(spy);
      await vars.unset(variableId);
      expect(spy).to.not.be.called;
    });

  });

  describe("string", () => {

    it("returns empty string if there's no value", async () => {
      expect(await vars.getString(variableId)).to.eq("");
    });

    it("sets and returns value", async () => {
      const value = faker.random.word();
      await vars.setString(variableId, value);
      expect(await vars.getString(variableId)).to.eq(value);
    });

    it("raises onVariableChanged event when variable changes", async () => {
      const spy = sinon.spy();
      vars.onVariableChanged.addListener(spy);

      await vars.setString(variableId, "a");
      expect(spy).to.be.calledWithExactly(variableId, undefined, "a");
      spy.resetHistory();

      await vars.setString(variableId, "b");
      expect(spy).to.be.calledWith(variableId, "a", "b");
      spy.resetHistory();

      await vars.setString(variableId, "b");
      expect(spy).to.not.be.called;
      spy.resetHistory();

      await vars.unset(variableId);
      expect(spy).to.be.calledWith(variableId, "b", undefined);
    });

  });

  describe("bool", () => {

    it("returns `false` if there's no value", async () => {
      expect(await vars.getBool(variableId)).to.be.false;
    });

    it("sets and returns value", async () => {
      const value = faker.random.boolean();
      await vars.setBool(variableId, value);
      expect(await vars.getBool(variableId)).to.eq(value);
    });

    it("raises onVariableChanged event when variable changes", async () => {
      const spy = sinon.spy();
      vars.onVariableChanged.addListener(spy);

      await vars.setBool(variableId, false);
      expect(spy).to.be.calledWith(variableId, undefined, false);
      spy.resetHistory();

      await vars.setBool(variableId, true);
      expect(spy).to.be.calledWith(variableId, false, true);
      spy.resetHistory();

      await vars.setBool(variableId, true);
      expect(spy).to.not.be.called;
      spy.resetHistory();

      await vars.unset(variableId);
      expect(spy).to.be.calledWith(variableId, true, undefined);
    });

    it("handles type conversion", async () => {
      await vars.setBool(variableId, false);
      expect(await vars.getString(variableId)).to.deep.eq("");
      expect(await vars.getInt(variableId)).to.deep.eq(0);
      expect(await vars.getInts(variableId)).to.deep.eq([]);
      expect(await vars.getId64(variableId)).to.deep.eq(Id64.invalid);
      expect(await vars.getId64s(variableId)).to.deep.eq([]);

      await vars.setBool(variableId, true);
      expect(await vars.getString(variableId)).to.deep.eq("");
      expect(await vars.getInt(variableId)).to.deep.eq(1);
      expect(await vars.getInts(variableId)).to.deep.eq([]);
      expect(await vars.getId64(variableId)).to.deep.eq(Id64.fromLocalAndBriefcaseIds(1, 0));
      expect(await vars.getId64s(variableId)).to.deep.eq([]);
    });

  });

  describe("int", () => {

    it("returns `0` if there's no value", async () => {
      expect(await vars.getInt(variableId)).to.eq(0);
    });

    it("sets and returns value", async () => {
      const value = faker.random.number();
      await vars.setInt(variableId, value);
      expect(await vars.getInt(variableId)).to.eq(value);
    });

    it("raises onVariableChanged event when variable changes", async () => {
      const spy = sinon.spy();
      vars.onVariableChanged.addListener(spy);

      await vars.setInt(variableId, 123);
      expect(spy).to.be.calledWith(variableId, undefined, 123);
      spy.resetHistory();

      await vars.setInt(variableId, 456);
      expect(spy).to.be.calledWith(variableId, 123, 456);
      spy.resetHistory();

      await vars.setInt(variableId, 456);
      expect(spy).to.not.be.called;
      spy.resetHistory();

      await vars.unset(variableId);
      expect(spy).to.be.calledWith(variableId, 456, undefined);
    });

    it("handles type conversion", async () => {
      const value = faker.random.number();
      await vars.setInt(variableId, value);
      expect(await vars.getBool(variableId)).to.deep.eq(true);
      expect(await vars.getString(variableId)).to.deep.eq("");
      expect(await vars.getInts(variableId)).to.deep.eq([]);
      expect(await vars.getId64(variableId)).to.deep.eq(Id64.fromLocalAndBriefcaseIds(value, 0));
      expect(await vars.getId64s(variableId)).to.deep.eq([]);
    });

  });

  describe("int[]", () => {

    it("returns empty list if there's no value", async () => {
      expect(await vars.getInts(variableId)).to.deep.eq([]);
    });

    it("sets and returns value", async () => {
      const value = [faker.random.number(), faker.random.number()];
      await vars.setInts(variableId, value);
      expect(await vars.getInts(variableId)).to.deep.eq(value);
    });

    it("raises onVariableChanged event when immutable variable changes", async () => {
      const spy = sinon.spy();
      vars.onVariableChanged.addListener(spy);

      await vars.setInts(variableId, [1, 2]);
      expect(spy).to.be.calledWith(variableId, undefined, [1, 2]);
      spy.resetHistory();

      await vars.setInts(variableId, [1, 2, 3]);
      expect(spy).to.be.calledWith(variableId, [1, 2], [1, 2, 3]);
      spy.resetHistory();

      await vars.setInts(variableId, [4, 5, 6]);
      expect(spy).to.be.calledWith(variableId, [1, 2, 3], [4, 5, 6]);
      spy.resetHistory();

      await vars.setInts(variableId, [4, 5, 6]);
      expect(spy).to.not.be.called;
      spy.resetHistory();

      await vars.unset(variableId);
      expect(spy).to.be.calledWith(variableId, [4, 5, 6], undefined);
    });

    it("raises onVariableChanged event when mutable variable changes", async () => {
      const spy = sinon.spy();
      vars.onVariableChanged.addListener(spy);

      const value = [1, 2];
      await vars.setInts(variableId, value);
      expect(spy).to.be.calledWith(variableId, undefined, value);
      spy.resetHistory();

      value.push(3);
      await vars.setInts(variableId, value);
      expect(spy).to.be.calledWith(variableId, [1, 2], value);
      spy.resetHistory();

      value.splice(2, 1, 4);
      await vars.setInts(variableId, value);
      expect(spy).to.be.calledWith(variableId, [1, 2, 3], value);
      spy.resetHistory();

      await vars.setInts(variableId, value);
      expect(spy).to.not.be.called;
      spy.resetHistory();

      await vars.unset(variableId);
      expect(spy).to.be.calledWith(variableId, value, undefined);
    });

    it("handles type conversion", async () => {
      const value = [faker.random.number(), faker.random.number()];
      await vars.setInts(variableId, value);
      expect(await vars.getBool(variableId)).to.deep.eq(false);
      expect(await vars.getString(variableId)).to.deep.eq("");
      expect(await vars.getInt(variableId)).to.deep.eq(0);
      expect(await vars.getId64(variableId)).to.deep.eq(Id64.invalid);
      expect(await vars.getId64s(variableId)).to.deep.eq(value.map((v) => Id64.fromLocalAndBriefcaseIds(v, 0)));
    });

  });

  describe("Id64", () => {

    it("returns invalid Id64 if there's no value", async () => {
      expect(await vars.getId64(variableId)).to.deep.eq(Id64.invalid);
    });

    it("sets and returns value", async () => {
      const value = createRandomId();
      await vars.setId64(variableId, value);
      expect(await vars.getId64(variableId)).to.eq(value);
    });

    it("raises onVariableChanged event when variable changes", async () => {
      const spy = sinon.spy();
      vars.onVariableChanged.addListener(spy);

      await vars.setId64(variableId, "0x123");
      expect(spy).to.be.calledWith(variableId, undefined, "0x123");
      spy.resetHistory();

      await vars.setId64(variableId, "0x456");
      expect(spy).to.be.calledWith(variableId, "0x123", "0x456");
      spy.resetHistory();

      await vars.setId64(variableId, "0x456");
      expect(spy).to.not.be.called;
      spy.resetHistory();

      await vars.unset(variableId);
      expect(spy).to.be.calledWith(variableId, "0x456", undefined);
    });

    it("handles type conversion", async () => {
      const value = createRandomId();
      await vars.setId64(variableId, value);
      expect(await vars.getBool(variableId)).to.deep.eq(Id64.isValid(value));
      expect(await vars.getString(variableId)).to.deep.eq("");
      expect(await vars.getInt(variableId)).to.deep.eq(Id64.getUpperUint32(value));
      expect(await vars.getInts(variableId)).to.deep.eq([]);
      expect(await vars.getId64s(variableId)).to.deep.eq([]);
    });

  });

  describe("Id64[]", () => {

    it("returns empty list if there's no value", async () => {
      expect(await vars.getId64s(variableId)).to.deep.eq([]);
    });

    it("sets and returns value", async () => {
      const value = [createRandomId(), createRandomId()];
      await vars.setId64s(variableId, value);
      expect(await vars.getId64s(variableId)).to.deep.eq(value);
    });

    it("raises onVariableChanged event when immutable variable changes", async () => {
      const spy = sinon.spy();
      vars.onVariableChanged.addListener(spy);

      await vars.setId64s(variableId, ["0x123", "0x789"]);
      expect(spy).to.be.calledWith(variableId, undefined, ["0x123", "0x789"]);
      spy.resetHistory();

      await vars.setId64s(variableId, ["0x456"]);
      expect(spy).to.be.calledWith(variableId, ["0x123", "0x789"], ["0x456"]);
      spy.resetHistory();

      await vars.setId64s(variableId, ["0x789"]);
      expect(spy).to.be.calledWith(variableId, ["0x456"], ["0x789"]);
      spy.resetHistory();

      await vars.setId64s(variableId, ["0x789"]);
      expect(spy).to.not.be.called;
      spy.resetHistory();

      await vars.unset(variableId);
      expect(spy).to.be.calledWith(variableId, ["0x789"], undefined);
    });

    it("raises onVariableChanged event when mutable variable changes", async () => {
      const spy = sinon.spy();
      vars.onVariableChanged.addListener(spy);

      const value = ["0x123", "0x789"];
      await vars.setId64s(variableId, value);
      expect(spy).to.be.calledWith(variableId, undefined, value);
      spy.resetHistory();

      value.splice(0, 2, "0x456");
      await vars.setId64s(variableId, value);
      expect(spy).to.be.calledWith(variableId, ["0x123", "0x789"], value);
      spy.resetHistory();

      value.splice(0, 1, "0x789");
      await vars.setId64s(variableId, value);
      expect(spy).to.be.calledWith(variableId, ["0x456"], value);
      spy.resetHistory();

      await vars.setId64s(variableId, value);
      expect(spy).to.not.be.called;
      spy.resetHistory();

      await vars.unset(variableId);
      expect(spy).to.be.calledWith(variableId, value, undefined);
    });

    it("handles type conversion", async () => {
      const value = [createRandomId(), createRandomId()];
      await vars.setId64s(variableId, value);
      expect(await vars.getBool(variableId)).to.deep.eq(false);
      expect(await vars.getString(variableId)).to.deep.eq("");
      expect(await vars.getInt(variableId)).to.deep.eq(0);
      expect(await vars.getInts(variableId)).to.deep.eq(value.map((v) => Id64.getUpperUint32(v)));
      expect(await vars.getId64(variableId)).to.deep.eq(Id64.invalid);
    });

  });

  it("sets value to different type", async () => {
    await vars.setInt(variableId, 123);
    expect(vars.getAllVariables()).to.deep.eq([{
      id: variableId,
      type: VariableValueTypes.Int,
      value: 123,
    }]);

    await vars.setString(variableId, "456");
    expect(vars.getAllVariables()).to.deep.eq([{
      id: variableId,
      type: VariableValueTypes.String,
      value: "456",
    }]);
  });

});
