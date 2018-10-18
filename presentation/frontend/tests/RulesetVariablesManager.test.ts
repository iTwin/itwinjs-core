/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect, spy } from "chai";
import * as faker from "faker";
import { createRandomId } from "@bentley/presentation-common/tests/_helpers/random";
import { Id64 } from "@bentley/bentleyjs-core";
import RulesetVariablesManager from "../lib/RulesetVariablesManager";
import { VariableValueTypes, VariableValue } from "@bentley/presentation-common/lib/RulesetVariables";

describe("RulesetVariablesManager", () => {

  let vars: RulesetVariablesManager;
  let rulesetId: string;
  let variableId: string;

  beforeEach(() => {
    rulesetId = faker.random.uuid();
    variableId = faker.random.word();
    vars = new RulesetVariablesManager(rulesetId);
  });

  describe("[get] state", () => {

    it("returns valid object when there're no values", async () => {
      expect(vars.state).to.deep.eq({ [rulesetId]: [] });
    });

    it("returns values stored by the manager", async () => {
      const values: Array<[string, VariableValueTypes, VariableValue]> = [
        [faker.random.word(), VariableValueTypes.Int, faker.random.number()],
        [faker.random.word(), VariableValueTypes.String, faker.random.words()],
      ];
      await vars.setInt(values[0][0], values[0][2] as number);
      await vars.setString(values[1][0], values[1][2] as string);
      expect(vars.state).to.deep.eq({ [rulesetId]: values });
    });

  });

  describe("string", () => {

    it("returns empty string if there's no value", async () => {
      expect(await vars.getString(variableId)).to.eq("");
    });

    it("sets and returns value", async () => {
      const eventSpy = spy.on(vars.onStateChanged, vars.onStateChanged.raiseEvent.name);
      const value = faker.random.word();
      await vars.setString(variableId, value);
      expect(eventSpy).to.be.called();
      expect(await vars.getString(variableId)).to.eq(value);
    });

  });

  describe("bool", () => {

    it("returns `false` if there's no value", async () => {
      expect(await vars.getBool(variableId)).to.be.false;
    });

    it("sets and returns value", async () => {
      const eventSpy = spy.on(vars.onStateChanged, vars.onStateChanged.raiseEvent.name);
      const value = faker.random.boolean();
      await vars.setBool(variableId, value);
      expect(eventSpy).to.be.called();
      expect(await vars.getBool(variableId)).to.eq(value);
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
      const eventSpy = spy.on(vars.onStateChanged, vars.onStateChanged.raiseEvent.name);
      const value = faker.random.number();
      await vars.setInt(variableId, value);
      expect(eventSpy).to.be.called();
      expect(await vars.getInt(variableId)).to.eq(value);
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
      const eventSpy = spy.on(vars.onStateChanged, vars.onStateChanged.raiseEvent.name);
      const value = [faker.random.number(), faker.random.number()];
      await vars.setInts(variableId, value);
      expect(eventSpy).to.be.called();
      expect(await vars.getInts(variableId)).to.eq(value);
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
      const eventSpy = spy.on(vars.onStateChanged, vars.onStateChanged.raiseEvent.name);
      const value = createRandomId();
      await vars.setId64(variableId, value);
      expect(eventSpy).to.be.called();
      expect(await vars.getId64(variableId)).to.eq(value);
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
      const eventSpy = spy.on(vars.onStateChanged, vars.onStateChanged.raiseEvent.name);
      const value = [createRandomId(), createRandomId()];
      await vars.setId64s(variableId, value);
      expect(eventSpy).to.be.called();
      expect(await vars.getId64s(variableId)).to.eq(value);
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

});
