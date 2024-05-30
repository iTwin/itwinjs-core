/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Setting } from "../../workspace/Settings";

describe("Setting", () => {
  describe("areEqual", () => {
    it("should return true for two identical primitive values", () => {
      expect(Setting.areEqual(5, 5)).to.be.true;
      expect(Setting.areEqual("test", "test")).to.be.true;
      expect(Setting.areEqual(undefined, undefined)).to.be.true;
    });

    it("should return false for two different primitive values", () => {
      expect(Setting.areEqual(5, 6)).to.be.false;
      expect(Setting.areEqual("test", "test1")).to.be.false;
      expect(Setting.areEqual(undefined, "undefined")).to.be.false;
    });

    it("should return true for two identical arrays", () => {
      expect(Setting.areEqual([1, 2, 3], [1, 2, 3])).to.be.true;
    });

    it("should return false for two different arrays", () => {
      expect(Setting.areEqual([1, 2, 3], [1, 2, 4])).to.be.false;
      expect(Setting.areEqual([1, 2, 3], [1, 2, 3, 4])).to.be.false;
    });

    it("should return true for two identical objects", () => {
      const obj1: Setting = { key: "test", value: "value" };
      const obj2: Setting = { key: "test", value: "value" };
      expect(Setting.areEqual(obj1, obj2)).to.be.true;
    });

    it("should return false for two different objects", () => {
      const obj1: Setting = { key: "test", value: "value" };
      const obj2: Setting = { key: "test1", value: "value" };
      const obj3: Setting = { key: "test", value: "value1" };
      expect(Setting.areEqual(obj1, obj2)).to.be.false;
      expect(Setting.areEqual(obj1, obj3)).to.be.false;
    });

    it("should return true for two identical nested objects", () => {
      const obj1: Setting = { key: "test", value: { subKey: "subValue" } };
      const obj2: Setting = { key: "test", value: { subKey: "subValue" } };
      expect(Setting.areEqual(obj1, obj2)).to.be.true;
    });

    it("should return false for two different nested objects", () => {
      const obj1: Setting = { key: "test", value: { subKey: "subValue" } };
      const obj2: Setting = { key: "test", value: { subKey: "subValue1" } };
      expect(Setting.areEqual(obj1, obj2)).to.be.false;
    });

    it("should return true for two identical nested arrays", () => {
      expect(Setting.areEqual([[1, 2], [3, 4]], [[1, 2], [3, 4]])).to.be.true;
    });

    it("should return false for two different nested arrays", () => {
      expect(Setting.areEqual([[1, 2], [3, 4]], [[1, 2], [3, 5]])).to.be.false;
    });

    it("should return false for different types", () => {
      expect(Setting.areEqual("1", 1)).to.be.false;
      expect(Setting.areEqual([], { })).to.be.false;
      expect(Setting.areEqual(false, undefined)).to.be.false;
      expect(Setting.areEqual("", false)).to.be.false;
      expect(Setting.areEqual([8, 9], { "0": 8, "1": 9 })).to.be.false;
    });

    it("should return true if objects have the same properties in different orders", () => {
      const a: Setting = { x: 5, y: 10 };
      const b: Setting = { y: 10, x: 5 };
      expect(JSON.stringify(a)).not.to.equal(JSON.stringify(b));
      expect(Setting.areEqual(a, b)).to.be.true;
      expect(Setting.areEqual(b, a)).to.be.true;
    });

    it("should return false for objects with different numbers of properties", () => {
      const a: Setting = { x: 5, y: 10 };
      const b: Setting = { x: 5, y: 10, z: 0 };
      expect(Setting.areEqual(a, b)).to.be.false;
      expect(Setting.areEqual(b, a)).to.be.false;
    });
  });
});
