/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import { PropertyDescription, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { renderHook } from "@testing-library/react-hooks";
import { FilterBuilderRule, FilterBuilderRuleGroup, useFilterBuilderState } from "../../components-react/filter-builder/FilterBuilderState";
import { FilterRuleGroupOperator, FilterRuleOperator } from "../../components-react/filter-builder/Operators";
import TestUtils from "../TestUtils";

chai.use(chaiSubset);

describe("useFilterBuilderState", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  it("initializes group with one empty rule", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state} = result.current;
    expect(state.rootGroup).to.containSubset({
      operator: FilterRuleGroupOperator.And,
      items: [{
        groupId: state.rootGroup.id,
      }],
    });
  });

  it("adds rule to root group", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {actions} = result.current;
    actions.addItem([], "RULE");

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      operator: FilterRuleGroupOperator.And,
      items: [{
        groupId: rootGroup.id,
      },{
        groupId: rootGroup.id,
      }],
    });
  });

  it("adds rule to nested group", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {actions} = result.current;
    actions.addItem([], "RULE_GROUP");

    const nestedGroup = result.current.state.rootGroup.items[1];
    expect(nestedGroup).to.not.be.undefined;

    actions.addItem([], "RULE");

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      operator: FilterRuleGroupOperator.And,
      items: [{
        groupId: rootGroup.id,
      },{
        groupId: rootGroup.id,
        operator: FilterRuleGroupOperator.And,
        items: [{
          groupId: nestedGroup.id,
        }],
      }],
    });
  });

  it("adds rule group to root group", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {actions} = result.current;
    actions.addItem([], "RULE_GROUP");

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      operator: FilterRuleGroupOperator.And,
      items: [{
        groupId: rootGroup.id,
      },{
        groupId: rootGroup.id,
        operator: FilterRuleGroupOperator.And,
        items: [],
      }],
    });
  });

  it("does not change state if parent group is not found when adding item", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;
    actions.addItem(["invalidParent"], "RULE_GROUP");

    const {state: newState} = result.current;
    expect(state).to.be.eq(newState);
  });

  it("removes rule from root group", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {actions} = result.current;

    let rootGroup = result.current.state.rootGroup;
    expect(rootGroup.items).to.have.lengthOf(1);
    actions.removeItem([rootGroup.items[0].id]);

    rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      operator: FilterRuleGroupOperator.And,
      items: [],
    });
  });

  it("does not change state if parent group is not found when removing item", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;
    actions.removeItem(["invalidParent", state.rootGroup.items[0].id]);

    const {state: newState} = result.current;
    expect(state).to.be.eq(newState);
  });

  it("does not change state when removing non existing item", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;
    actions.removeItem(["invalidItem"]);

    const {state: newState} = result.current;
    expect(state).to.be.eq(newState);
  });

  it("sets root group operator", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;

    expect(state.rootGroup.operator).to.be.eq(FilterRuleGroupOperator.And);
    actions.setRuleGroupOperator([], FilterRuleGroupOperator.Or);

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      operator: FilterRuleGroupOperator.Or,
      items: [{
        groupId: rootGroup.id,
      }],
    });
  });

  it("does not change state when setting non existing group operator", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;
    actions.setRuleGroupOperator(["invalidGroup"], FilterRuleGroupOperator.Or);

    const {state: newState} = result.current;
    expect(state).to.be.eq(newState);
  });

  it("sets rule property", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;

    const property: PropertyDescription = {name: "prop", displayLabel: "Prop", typename: "string"};
    actions.setRuleProperty([state.rootGroup.items[0].id], property);

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      items: [{
        groupId: rootGroup.id,
        property,
      }],
    });
  });

  it("does not change state when setting non existing rule property", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;

    const property: PropertyDescription = {name: "prop", displayLabel: "Prop", typename: "string"};
    actions.setRuleProperty(["invalidRule"], property);

    const {state: newState} = result.current;
    expect(state).to.be.eq(newState);
  });

  it("sets rule operator", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;

    actions.setRuleOperator([state.rootGroup.items[0].id], FilterRuleOperator.IsEqual);

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      items: [{
        groupId: rootGroup.id,
        operator: FilterRuleOperator.IsEqual,
      }],
    });
  });

  it("resets rule value if new operator does not need value", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;

    const value: PropertyValue = {valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING"};
    actions.setRuleValue([state.rootGroup.items[0].id], value);
    const rule = result.current.state.rootGroup.items[0] as FilterBuilderRule;
    expect(rule.value).to.be.deep.eq(value);

    actions.setRuleOperator([state.rootGroup.items[0].id], FilterRuleOperator.IsNull);

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      items: [{
        groupId: rootGroup.id,
        operator: FilterRuleOperator.IsNull,
        value: undefined,
      }],
    });
  });

  it("does not change state when setting non existing rule operator", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;

    actions.setRuleOperator(["invalidRule"], FilterRuleOperator.IsEqual);

    const {state: newState} = result.current;
    expect(state).to.be.eq(newState);
  });

  it("sets rule value", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;

    const value: PropertyValue = {valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING"};
    actions.setRuleValue([state.rootGroup.items[0].id], value);

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      items: [{
        groupId: rootGroup.id,
        value,
      }],
    });
  });

  it("does not change state when setting non existing rule value", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;

    const value: PropertyValue = {valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING"};
    actions.setRuleValue(["invalidRule"], value);

    const {state: newState} = result.current;
    expect(state).to.be.eq(newState);
  });

  it("does not change state when trying to set property on rule group", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const {state, actions} = result.current;

    const property: PropertyDescription = {name: "prop", displayLabel: "Prop", typename: "string"};
    actions.setRuleProperty([], property);

    const {state: newState} = result.current;
    expect(state).to.be.eq(newState);
  });

  describe("nested rule", () => {
    function getStateWithNestedRule() {
      const {result} = renderHook(() => useFilterBuilderState());
      const {actions} = result.current;

      const getNestingRule = () => result.current.state.rootGroup.items[1] as FilterBuilderRuleGroup;
      const getNestedRule = () => getNestingRule().items[0] as FilterBuilderRule;
      const getNestedRulePath = () => [getNestingRule().id, getNestedRule().id];

      actions.addItem([], "RULE_GROUP");
      expect(getNestingRule()).to.not.be.undefined;
      expect(getNestedRule()).to.not.be.undefined;

      return {result, getNestingRule, getNestedRule, getNestedRulePath};
    }

    it("sets property", () => {
      const {result, getNestingRule, getNestedRule, getNestedRulePath} = getStateWithNestedRule();
      const {actions} = result.current;

      const property: PropertyDescription = {name: "prop", displayLabel: "Prop", typename: "string"};
      actions.setRuleProperty(getNestedRulePath(), property);

      const rule = getNestedRule();
      expect(rule).to.containSubset({
        groupId: getNestingRule().id,
        property,
      });
    });

    it("sets operator", () => {
      const {result, getNestingRule, getNestedRule, getNestedRulePath} = getStateWithNestedRule();
      const {actions} = result.current;

      actions.setRuleOperator(getNestedRulePath(), FilterRuleOperator.IsEqual);

      const rule = getNestedRule();
      expect(rule).to.containSubset({
        groupId: getNestingRule().id,
        operator: FilterRuleOperator.IsEqual,
      });
    });

    it("sets value", () => {
      const {result, getNestingRule, getNestedRule, getNestedRulePath} = getStateWithNestedRule();
      const {actions} = result.current;

      const value: PropertyValue = {valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING"};
      actions.setRuleValue(getNestedRulePath(), value);

      const rule = getNestedRule();
      expect(rule).to.containSubset({
        groupId: getNestingRule().id,
        value,
      });
    });

    it("removes", () => {
      const {result, getNestingRule, getNestedRulePath} = getStateWithNestedRule();
      const {actions} = result.current;

      actions.removeItem(getNestedRulePath());

      const nestingRule = getNestingRule();
      expect(nestingRule.items).to.be.empty;
    });
  });
});
