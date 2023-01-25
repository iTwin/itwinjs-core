/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "../../components-react/filter-builder/Operators";
import { isPropertyFilterRuleGroup } from "../../components-react/filter-builder/Types";

describe("isPropertyFilterRuleGroup", () => {
  it("returns correct values", () => {
    expect(isPropertyFilterRuleGroup({ operator: PropertyFilterRuleGroupOperator.And, rules: [] })).to.be.true;
    expect(isPropertyFilterRuleGroup({
      property: { name: "prop", displayLabel: "Prop", typename: "string" },
      operator: PropertyFilterRuleOperator.IsNull,
    }
    )).to.be.false;
  });
});
