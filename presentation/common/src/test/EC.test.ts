/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { InstanceKey } from "../EC";
import { Id64 } from "@bentley/bentleyjs-core";

describe("InstanceKey", () => {

  describe("compare", () => {

    it("returns less than 0 when `lhs.className` < `rhs.className`", () => {
      const lhs = { className: "a", id: Id64.invalid };
      const rhs = { className: "b", id: Id64.invalid };
      expect(InstanceKey.compare(lhs, rhs)).to.be.lt(0);
    });

    it("returns less than 0 when `lhs.className` = `rhs.className` and `lhs.id` < `rhs.id`", () => {
      const lhs = { className: "a", id: "0x1" };
      const rhs = { className: "a", id: "0x2" };
      expect(InstanceKey.compare(lhs, rhs)).to.be.lt(0);
    });

    it("returns 0 when `lhs.className` = `rhs.className` and `lhs.id` = `rhs.id`", () => {
      const lhs = { className: "a", id: "0x1" };
      const rhs = { className: "a", id: "0x1" };
      expect(InstanceKey.compare(lhs, rhs)).to.eq(0);
    });

    it("returns more than 0 when `lhs.className` > `rhs.className`", () => {
      const lhs = { className: "b", id: Id64.invalid };
      const rhs = { className: "1", id: Id64.invalid };
      expect(InstanceKey.compare(lhs, rhs)).to.be.gt(0);
    });

    it("returns more than 0 when `lhs.className` = `rhs.className` and `lhs.id` > `rhs.id`", () => {
      const lhs = { className: "a", id: "0x2" };
      const rhs = { className: "a", id: "0x1" };
      expect(InstanceKey.compare(lhs, rhs)).to.be.gt(0);
    });

  });

});
