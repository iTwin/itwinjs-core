/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import type { DisplayValuesArray, DisplayValuesArrayJSON, DisplayValuesMap, DisplayValuesMapJSON, NestedContentValue,
  NestedContentValueJSON, ValuesArray, ValuesArrayJSON, ValuesMap, ValuesMapJSON} from "../../presentation-common/content/Value";
import {
  DisplayValue, DisplayValueGroup, Value,
} from "../../presentation-common/content/Value";
import { InstanceKey } from "../../presentation-common/EC";
import { createRandomECInstanceKey, createRandomECInstanceKeyJSON } from "../_helpers/random";

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

    describe("isNestedContent", () => {

      it("returns correct results for different values", () => {
        expect(Value.isNestedContent(primitiveValue)).to.be.false;
        expect(Value.isNestedContent(arrayValue)).to.be.false;
        expect(Value.isNestedContent(mapValue)).to.be.false;
        expect(Value.isNestedContent([nestedContentValue])).to.be.true;
        expect(Value.isNestedContent([])).to.be.true;
      });

    });

    describe("isArray", () => {

      it("returns correct results for different values", () => {
        expect(Value.isArray(primitiveValue)).to.be.false;
        expect(Value.isArray(arrayValue)).to.be.true;
        expect(Value.isArray(mapValue)).to.be.false;
        expect(Value.isArray([nestedContentValue])).to.be.true;
        expect(Value.isArray([])).to.be.true;
      });

    });

    describe("isMap", () => {

      it("returns correct results for different values", () => {
        expect(Value.isMap(primitiveValue)).to.be.false;
        expect(Value.isMap(arrayValue)).to.be.false;
        expect(Value.isMap(mapValue)).to.be.true;
        expect(Value.isMap([nestedContentValue])).to.be.false;
      });

    });

    describe("isPrimitive", () => {

      it("returns correct results for different values", () => {
        expect(Value.isPrimitive(primitiveValue)).to.be.true;
        expect(Value.isPrimitive(arrayValue)).to.be.false;
        expect(Value.isPrimitive(mapValue)).to.be.false;
        expect(Value.isPrimitive([nestedContentValue])).to.be.false;
      });

    });

  });

  describe("fromJSON", () => {

    it("returns undefined for null value", () => {
      expect(Value.fromJSON(null)).to.eq(undefined);
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
      const result = Value.fromJSON([v]);
      expect(result).to.deep.eq([{
        primaryKeys: v.primaryKeys.map(InstanceKey.fromJSON),
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
      expect(Value.fromJSON(v)).to.deep.eq(v);
    });

    it("returns valid map value", () => {
      const v: ValuesMapJSON = {
        a: faker.random.word(),
        b: faker.random.number(),
      };
      expect(Value.fromJSON(v)).to.deep.eq(v);
    });

  });

  describe("toJSON", () => {

    it("returns null for undefined value", () => {
      expect(Value.toJSON(undefined)).to.eq(null);
    });

    it("returns 0 for 0 number value", () => {
      expect(Value.toJSON(0)).to.eq(0);
    });

    it("returns valid JSON for nested content value", () => {
      const v: NestedContentValue = {
        primaryKeys: [createRandomECInstanceKey()],
        values: {
          key1: faker.random.word(),
          key2: undefined,
        },
        displayValues: {
          key3: undefined,
        },
        mergedFieldNames: [faker.random.word()],
      };
      const result = Value.toJSON([v]);
      expect(result).to.deep.eq([{
        primaryKeys: v.primaryKeys.map(InstanceKey.toJSON),
        values: {
          key1: v.values.key1,
          key2: null,
        },
        displayValues: {
          key3: null,
        },
        mergedFieldNames: v.mergedFieldNames,
      }]);
    });

    it("returns valid JSON for array value", () => {
      const v: ValuesArray = [faker.random.word(), faker.random.word()];
      expect(Value.toJSON(v)).to.deep.eq(v);
    });

    it("returns valid JSON for map value", () => {
      const v: ValuesMap = {
        a: faker.random.word(),
        b: faker.random.number(),
      };
      expect(Value.toJSON(v)).to.deep.eq(v);
    });

  });

});

describe("DisplayValue", () => {

  describe("type checks", () => {

    let primitiveValue: string;
    let arrayValue: DisplayValuesArray;
    let mapValue: DisplayValuesMap;

    beforeEach(() => {
      primitiveValue = faker.random.words();
      arrayValue = [faker.random.word()];
      mapValue = {
        test: faker.random.word(),
      };
    });

    describe("isArray", () => {

      it("returns correct results for different values", () => {
        expect(DisplayValue.isArray(primitiveValue)).to.be.false;
        expect(DisplayValue.isArray(arrayValue)).to.be.true;
        expect(DisplayValue.isArray(mapValue)).to.be.false;
        expect(DisplayValue.isArray([])).to.be.true;
      });

    });

    describe("isMap", () => {

      it("returns correct results for different values", () => {
        expect(DisplayValue.isMap(primitiveValue)).to.be.false;
        expect(DisplayValue.isMap(arrayValue)).to.be.false;
        expect(DisplayValue.isMap(mapValue)).to.be.true;
      });

    });

    describe("isPrimitive", () => {

      it("returns correct results for different values", () => {
        expect(DisplayValue.isPrimitive(primitiveValue)).to.be.true;
        expect(DisplayValue.isPrimitive(arrayValue)).to.be.false;
        expect(DisplayValue.isPrimitive(mapValue)).to.be.false;
      });

    });

  });

  describe("fromJSON", () => {

    it("returns undefined for null value", () => {
      expect(DisplayValue.fromJSON(null)).to.eq(undefined);
    });

    it("returns valid array value", () => {
      const v: DisplayValuesArrayJSON = [faker.random.word(), faker.random.word()];
      expect(DisplayValue.fromJSON(v)).to.deep.eq(v);
    });

    it("returns valid map value", () => {
      const v: DisplayValuesMapJSON = {
        a: faker.random.word(),
      };
      expect(DisplayValue.fromJSON(v)).to.deep.eq(v);
    });

  });

  describe("toJSON", () => {

    it("returns null for undefined value", () => {
      expect(DisplayValue.toJSON(undefined)).to.eq(null);
    });

    it("returns \"\" for empty string value", () => {
      expect(DisplayValue.toJSON("")).to.eq("");
    });

    it("returns valid JSON for array value", () => {
      const v: DisplayValuesArray = [faker.random.word(), faker.random.word()];
      expect(DisplayValue.toJSON(v)).to.deep.eq(v);
    });

    it("returns valid JSON for map value", () => {
      const v: DisplayValuesMap = {
        a: faker.random.word(),
      };
      expect(DisplayValue.toJSON(v)).to.deep.eq(v);
    });

  });

});

describe("DisplayValueGroup", () => {

  describe("fromJSON", () => {

    it("returns valid DisplayValueGroup object", () => {
      expect(DisplayValueGroup.fromJSON({
        displayValue: "test",
        groupedRawValues: ["a"],
      })).to.deep.eq({
        displayValue: "test",
        groupedRawValues: ["a"],
      });
    });

  });

  describe("toJSON", () => {

    it("returns valid JSON", () => {
      expect(DisplayValueGroup.toJSON({
        displayValue: "test",
        groupedRawValues: ["a"],
      })).to.deep.eq({
        displayValue: "test",
        groupedRawValues: ["a"],
      });
    });

  });

});
