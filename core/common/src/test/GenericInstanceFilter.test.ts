/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { GenericInstanceFilter, GenericInstanceFilterRule, GenericInstanceFilterRuleValue } from "../GenericInstanceFilter";

describe("GenericInstanceFilterRuleValue", () => {
  it("'isPoint2d' returns correct result", () => {
    expect(GenericInstanceFilterRuleValue.isPoint2d({ x: 1, y: 2 })).to.be.true;
    expect(GenericInstanceFilterRuleValue.isPoint2d({ x: 1, y: 2, z: 3 })).to.be.true;
    expect(GenericInstanceFilterRuleValue.isPoint2d(1)).to.be.false;
    expect(GenericInstanceFilterRuleValue.isPoint2d(false)).to.be.false;
    expect(GenericInstanceFilterRuleValue.isPoint2d("text")).to.be.false;
    expect(GenericInstanceFilterRuleValue.isPoint2d(new Date())).to.be.false;
    expect(GenericInstanceFilterRuleValue.isPoint2d({ id: "0x1", className: "TestClass"})).to.be.false;
  });

  it("'isPoint3d' returns correct result", () => {
    expect(GenericInstanceFilterRuleValue.isPoint3d({ x: 1, y: 2, z: 3 })).to.be.true;
    expect(GenericInstanceFilterRuleValue.isPoint3d({ x: 1, y: 2 })).to.be.false;
    expect(GenericInstanceFilterRuleValue.isPoint3d(1)).to.be.false;
    expect(GenericInstanceFilterRuleValue.isPoint3d(false)).to.be.false;
    expect(GenericInstanceFilterRuleValue.isPoint3d("text")).to.be.false;
    expect(GenericInstanceFilterRuleValue.isPoint3d(new Date())).to.be.false;
    expect(GenericInstanceFilterRuleValue.isPoint3d({ id: "0x1", className: "TestClass"})).to.be.false;
  });

  it("'isInstanceKey' returns correct result", () => {
    expect(GenericInstanceFilterRuleValue.isInstanceKey({ id: "0x1", className: "TestClass"})).to.be.true;
    expect(GenericInstanceFilterRuleValue.isInstanceKey({ x: 1, y: 2, z: 3 })).to.be.false;
    expect(GenericInstanceFilterRuleValue.isInstanceKey({ x: 1, y: 2 })).to.be.false;
    expect(GenericInstanceFilterRuleValue.isInstanceKey(1)).to.be.false;
    expect(GenericInstanceFilterRuleValue.isInstanceKey(false)).to.be.false;
    expect(GenericInstanceFilterRuleValue.isInstanceKey("text")).to.be.false;
    expect(GenericInstanceFilterRuleValue.isInstanceKey(new Date())).to.be.false;
  });
});

describe("GenericInstanceFilter", () => {
  it("'isFilterRuleGroup' returns correct result", () => {
    const rule: GenericInstanceFilterRule = {
      operator: "is-equal",
      propertyName: "PropName",
      propertyTypeName: "string",
      sourceAlias: "alias",
    };

    expect(GenericInstanceFilter.isFilterRuleGroup(rule)).to.be.false;
    expect(GenericInstanceFilter.isFilterRuleGroup({ operator: "and", rules: [rule] })).to.be.true;
  });
});
