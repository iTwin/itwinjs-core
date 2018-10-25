/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import {
  ValuesArray, ValuesMap, NestedContentValue,
  isNestedContentValue, isArray, isMap, isPrimitive,
  ValuesArrayJSON, ValuesMapJSON, valueFromJSON,
  DisplayValuesArrayJSON, DisplayValuesMapJSON, displayValueFromJSON,
  NestedContentValueJSON,
} from "../../lib/content/Value";
import { createRandomECInstanceKeyJSON } from "../_helpers/random";
import { instanceKeyFromJSON } from "../../lib";

describe("Value", () => {

  describe("type checks", () => {

    let primitiveValue: number;
    let arrayValue: ValuesArray;
    let mapValue: ValuesMap;
    let nestedContentValue: NestedContentValue;

    beforeEach(() => {
      primitiveValue = faker.random.number();
      arrayValue = [faker.random.word()];
      mapValue = {
        test: faker.random.word(),
      };
      nestedContentValue = {
        primaryKeys: [],
        values: {},
        displayValues: {},
        mergedFieldNames: [],
      };
    });

    describe("isNestedContentValue", () => {

      it("returns correct results for different values", () => {
        expect(isNestedContentValue(primitiveValue)).to.be.false;
        expect(isNestedContentValue(arrayValue)).to.be.false;
        expect(isNestedContentValue(mapValue)).to.be.false;
        expect(isNestedContentValue([nestedContentValue])).to.be.true;
        expect(isNestedContentValue([])).to.be.true;
      });

    });

    describe("isArray", () => {

      it("returns correct results for different values", () => {
        expect(isArray(primitiveValue)).to.be.false;
        expect(isArray(arrayValue)).to.be.true;
        expect(isArray(mapValue)).to.be.false;
        expect(isArray([nestedContentValue])).to.be.true;
        expect(isArray([])).to.be.true;
      });

    });

    describe("isMap", () => {

      it("returns correct results for different values", () => {
        expect(isMap(primitiveValue)).to.be.false;
        expect(isMap(arrayValue)).to.be.false;
        expect(isMap(mapValue)).to.be.true;
        expect(isMap([nestedContentValue])).to.be.false;
      });

    });

    describe("isPrimitive", () => {

      it("returns correct results for different values", () => {
        expect(isPrimitive(primitiveValue)).to.be.true;
        expect(isPrimitive(arrayValue)).to.be.false;
        expect(isPrimitive(mapValue)).to.be.false;
        expect(isPrimitive([nestedContentValue])).to.be.false;
      });

    });

  });

  describe("valueFromJSON", () => {

    it("returns undefined for null value", () => {
      expect(valueFromJSON(null)).to.eq(undefined);
    });

    it("returns valid nested content value", () => {
      const v: NestedContentValueJSON = {
        primaryKeys: [createRandomECInstanceKeyJSON()],
        values: {
          key1: faker.random.word(),
          key2: null,
        },
        displayValues: {
          key3: null,
        },
        mergedFieldNames: [faker.random.word()],
      };
      const result = valueFromJSON([v]);
      expect(result).to.deep.eq([{
        primaryKeys: v.primaryKeys.map(instanceKeyFromJSON),
        values: {
          key1: v.values.key1,
          key2: undefined,
        },
        displayValues: {
          key3: undefined,
        },
        mergedFieldNames: v.mergedFieldNames,
      }]);
    });

    it("returns valid array value", () => {
      const v: ValuesArrayJSON = [faker.random.word(), faker.random.word()];
      expect(valueFromJSON(v)).to.deep.eq(v);
    });

    it("returns valid map value", () => {
      const v: ValuesMapJSON = {
        a: faker.random.word(),
        b: faker.random.number(),
      };
      expect(valueFromJSON(v)).to.deep.eq(v);
    });

  });

  describe("displayValueFromJSON", () => {

    it("returns undefined for null value", () => {
      expect(displayValueFromJSON(null)).to.eq(undefined);
    });

    it("returns valid array value", () => {
      const v: DisplayValuesArrayJSON = [faker.random.word(), faker.random.word()];
      expect(displayValueFromJSON(v)).to.deep.eq(v);
    });

    it("returns valid map value", () => {
      const v: DisplayValuesMapJSON = {
        a: faker.random.word(),
      };
      expect(displayValueFromJSON(v)).to.deep.eq(v);
    });

  });

});
