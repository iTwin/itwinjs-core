/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { DisplayValue, DisplayValuesArray, DisplayValuesMap, NestedContentValue, Value, ValuesArray, ValuesMap } from "../../presentation-common/content/Value";

describe("Value", () => {
  describe("type checks", () => {
    let primitiveValue: number;
    let arrayValue: ValuesArray;
    let mapValue: ValuesMap;
    let nestedContentValue: NestedContentValue;

    beforeEach(() => {
      primitiveValue = 123;
      arrayValue = ["456"];
      mapValue = {
        test: "789",
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
});

describe("DisplayValue", () => {
  describe("type checks", () => {
    let primitiveValue: string;
    let arrayValue: DisplayValuesArray;
    let mapValue: DisplayValuesMap;

    beforeEach(() => {
      primitiveValue = "lorem ipsum";
      arrayValue = ["lorem"];
      mapValue = {
        test: "ipsum",
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
});
