/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@helpers/Mocks";
import { createRandomId } from "@helpers/random";
import { RpcRequestsHandler } from "@bentley/presentation-common";
import { VariableValueTypes, VariableValue } from "@bentley/presentation-common/lib/IRulesetVariablesManager";
import RulesetVariablesManager from "@src/RulesetVariablesManager";
import { using } from "@bentley/bentleyjs-core";

describe("RulesetVariablesManager", () => {

  let rpcRequestsHandlerMock: moq.IMock<RpcRequestsHandler>;
  let vars: RulesetVariablesManager;
  const testData = {
    rulesetId: "",
    variableId: "",
  };

  beforeEach(() => {
    testData.rulesetId = faker.random.uuid();
    testData.variableId = faker.random.word();
    rpcRequestsHandlerMock = moq.Mock.ofType<RpcRequestsHandler>();
    rpcRequestsHandlerMock.setup((x) => x.syncHandlers).returns(() => new Array<() => Promise<void>>());
    vars = new RulesetVariablesManager(rpcRequestsHandlerMock.object, testData.rulesetId);
  });

  describe("constructor", () => {

    it("registers a sync handler", () => {
      const syncHandlers = new Array<() => Promise<void>>();
      rpcRequestsHandlerMock.reset();
      rpcRequestsHandlerMock.setup((x) => x.syncHandlers).returns(() => syncHandlers);
      using(new RulesetVariablesManager(rpcRequestsHandlerMock.object, testData.rulesetId), () => {
        expect(syncHandlers.length).to.eq(1);
      });
    });

  });

  describe("dispose", () => {

    it("unregisters its sync handler", () => {
      const syncHandlers = new Array<() => Promise<void>>();
      rpcRequestsHandlerMock.reset();
      rpcRequestsHandlerMock.setup((x) => x.syncHandlers).returns(() => syncHandlers);
      const m = new RulesetVariablesManager(rpcRequestsHandlerMock.object, testData.rulesetId);
      expect(syncHandlers.length).to.eq(1);
      m.dispose();
      expect(syncHandlers.length).to.eq(0);
    });

  });

  describe("syncWithBackend", () => {

    const syncHandlers = new Array<() => Promise<void>>();

    beforeEach(() => {
      rpcRequestsHandlerMock.reset();
      rpcRequestsHandlerMock.setup((x) => x.syncHandlers).returns(() => syncHandlers);
      vars.dispose();
      vars = new RulesetVariablesManager(rpcRequestsHandlerMock.object, testData.rulesetId);
    });

    afterEach(() => {
      vars.dispose();
    });

    it("does nothing if there're no client rulesets", async () => {
      await Promise.all(syncHandlers.map((sh) => sh()));
      rpcRequestsHandlerMock.verify((x) => x.addRulesets(moq.It.isAny()), moq.Times.never());
    });

    it("adds all client rulesets using rpc requests handler", async () => {
      const values: Array<[string, VariableValueTypes, VariableValue]> = [
        [faker.random.word(), VariableValueTypes.Int, faker.random.number()],
        [faker.random.word(), VariableValueTypes.String, faker.random.words()],
      ];
      await vars.setInt(values[0][0], values[0][2] as number);
      await vars.setString(values[1][0], values[1][2] as string);
      await Promise.all(syncHandlers.map((sh) => sh()));
      rpcRequestsHandlerMock.verify((x) => x.setRulesetVariableValues(testData.rulesetId, values), moq.Times.once());
    });

  });

  describe("getString", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const value = faker.random.word();
      rpcRequestsHandlerMock
        .setup((x) => x.getRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.String))
        .returns(async () => value)
        .verifiable();
      const result = await vars.getString(testData.variableId);
      rpcRequestsHandlerMock.verifyAll();
      expect(result).to.equal(value);
    });

  });

  describe("setString", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const value = faker.random.word();
      rpcRequestsHandlerMock
        .setup((x) => x.setRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.String, value))
        .verifiable();
      await vars.setString(testData.variableId, value);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getBool", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const value = faker.random.boolean();
      rpcRequestsHandlerMock
        .setup((x) => x.getRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.Bool))
        .returns(async () => value)
        .verifiable();
      const result = await vars.getBool(testData.variableId);
      rpcRequestsHandlerMock.verifyAll();
      expect(result).to.equal(value);
    });

  });

  describe("setBool", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const value = faker.random.boolean();
      rpcRequestsHandlerMock
        .setup((x) => x.setRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.Bool, value))
        .verifiable();
      await vars.setBool(testData.variableId, value);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getInt", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const value = faker.random.number();
      rpcRequestsHandlerMock
        .setup((x) => x.getRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.Int))
        .returns(async () => value)
        .verifiable();
      const result = await vars.getInt(testData.variableId);
      rpcRequestsHandlerMock.verifyAll();
      expect(result).to.equal(value);
    });

  });

  describe("setInt", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const value = faker.random.number();
      rpcRequestsHandlerMock
        .setup((x) => x.setRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.Int, value))
        .verifiable();
      await vars.setInt(testData.variableId, value);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getInts", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const valuesArray = [faker.random.number(), faker.random.number(), faker.random.number()];
      rpcRequestsHandlerMock
        .setup((x) => x.getRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.IntArray))
        .returns(async () => valuesArray)
        .verifiable();
      const result = await vars.getInts(testData.variableId);
      rpcRequestsHandlerMock.verifyAll();
      expect(result).to.deep.equal(valuesArray);
    });

  });

  describe("setInts", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const valuesArray = [faker.random.number(), faker.random.number(), faker.random.number()];
      rpcRequestsHandlerMock
        .setup((x) => x.setRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.IntArray, valuesArray))
        .verifiable();
      await vars.setInts(testData.variableId, valuesArray);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getId64", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const value = createRandomId();
      rpcRequestsHandlerMock
        .setup((x) => x.getRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.Id64))
        .returns(async () => value)
        .verifiable();
      const result = await vars.getId64(testData.variableId);
      rpcRequestsHandlerMock.verifyAll();
      expect(result).to.deep.equal(value);
    });

  });

  describe("setId64", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const value = createRandomId();
      rpcRequestsHandlerMock
        .setup((x) => x.setRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.Id64, value))
        .verifiable();
      await vars.setId64(testData.variableId, value);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getId64s", () => {

    it("calls getRulesetVariableValue through proxy", async () => {
      const valueArray = [createRandomId(), createRandomId(), createRandomId()];
      rpcRequestsHandlerMock
        .setup((x) => x.getRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.Id64Array))
        .returns(async () => valueArray)
        .verifiable();
      const result = await vars.getId64s(testData.variableId);
      rpcRequestsHandlerMock.verifyAll();
      expect(result).to.deep.equal(valueArray);
    });

  });

  describe("setId64s", () => {

    it("calls setRulesetVariableValue through proxy", async () => {
      const valueArray = [createRandomId(), createRandomId(), createRandomId()];
      rpcRequestsHandlerMock
        .setup((x) => x.setRulesetVariableValue(testData.rulesetId, testData.variableId, VariableValueTypes.Id64Array, valueArray))
        .verifiable();
      await vars.setId64s(testData.variableId, valueArray);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

});
