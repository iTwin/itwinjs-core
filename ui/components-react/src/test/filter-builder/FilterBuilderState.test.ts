/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import { PropertyDescription, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { renderHook } from "@testing-library/react-hooks";
import {
  PropertyFilterBuilderRule, PropertyFilterBuilderRuleGroup, usePropertyFilterBuilderState,
} from "../../components-react/filter-builder/FilterBuilderState";
import { PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "../../components-react/filter-builder/Operators";
import TestUtils from "../TestUtils";

chai.use(chaiSubset);

describe("usePropertyFilterBuilderState", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  it("initializes group with one empty rule", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state } = result.current;
    expect(state.rootGroup).to.containSubset({
      operator: PropertyFilterRuleGroupOperator.And,
      items: [{
        groupId: state.rootGroup.id,
      }],
    });
  });

  it("adds rule to root group", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { actions } = result.current;
    actions.addItem([], "RULE");

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      operator: PropertyFilterRuleGroupOperator.And,
      items: [{
        groupId: rootGroup.id,
      }, {
        groupId: rootGroup.id,
      }],
    });
  });

  it("adds rule to nested group", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { actions } = result.current;
    actions.addItem([], "RULE_GROUP");

    const nestedGroup = result.current.state.rootGroup.items[1];
    expect(nestedGroup).to.not.be.undefined;

    actions.addItem([], "RULE");

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      operator: PropertyFilterRuleGroupOperator.And,
      items: [{
        groupId: rootGroup.id,
      }, {
        groupId: rootGroup.id,
        operator: PropertyFilterRuleGroupOperator.And,
        items: [{
          groupId: nestedGroup.id,
        }],
      }],
    });
  });

  it("adds rule group to root group", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { actions } = result.current;
    actions.addItem([], "RULE_GROUP");

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      operator: PropertyFilterRuleGroupOperator.And,
      items: [{
        groupId: rootGroup.id,
      }, {
        groupId: rootGroup.id,
        operator: PropertyFilterRuleGroupOperator.And,
        items: [],
      }],
    });
  });

  it("does not change state if parent group is not found when adding item", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;
    actions.addItem(["invalidParent"], "RULE_GROUP");

    const { state: newState } = result.current;
    expect(state).to.be.eq(newState);
  });

  it("removes rule from root group", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { actions } = result.current;

    let rootGroup = result.current.state.rootGroup;
    expect(rootGroup.items).to.have.lengthOf(1);
    actions.removeItem([rootGroup.items[0].id]);

    rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      operator: PropertyFilterRuleGroupOperator.And,
      items: [],
    });
  });

  it("does not change state if parent group is not found when removing item", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;
    actions.removeItem(["invalidParent", state.rootGroup.items[0].id]);

    const { state: newState } = result.current;
    expect(state).to.be.eq(newState);
  });

  it("does not change state when removing non existing item", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;
    actions.removeItem(["invalidItem"]);

    const { state: newState } = result.current;
    expect(state).to.be.eq(newState);
  });

  it("sets root group operator", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;

    expect(state.rootGroup.operator).to.be.eq(PropertyFilterRuleGroupOperator.And);
    actions.setRuleGroupOperator([], PropertyFilterRuleGroupOperator.Or);

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      operator: PropertyFilterRuleGroupOperator.Or,
      items: [{
        groupId: rootGroup.id,
      }],
    });
  });

  it("does not change state when setting non existing group operator", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;
    actions.setRuleGroupOperator(["invalidGroup"], PropertyFilterRuleGroupOperator.Or);

    const { state: newState } = result.current;
    expect(state).to.be.eq(newState);
  });

  it("sets rule property", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;

    const property: PropertyDescription = { name: "prop", displayLabel: "Prop", typename: "string" };
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
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;

    const property: PropertyDescription = { name: "prop", displayLabel: "Prop", typename: "string" };
    actions.setRuleProperty(["invalidRule"], property);

    const { state: newState } = result.current;
    expect(state).to.be.eq(newState);
  });

  it("sets rule operator", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;

    actions.setRuleOperator([state.rootGroup.items[0].id], PropertyFilterRuleOperator.IsEqual);

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      items: [{
        groupId: rootGroup.id,
        operator: PropertyFilterRuleOperator.IsEqual,
      }],
    });
  });

  it("resets rule value if new operator does not need value", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;

    const value: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING" };
    actions.setRuleValue([state.rootGroup.items[0].id], value);
    const rule = result.current.state.rootGroup.items[0] as PropertyFilterBuilderRule;
    expect(rule.value).to.be.deep.eq(value);

    actions.setRuleOperator([state.rootGroup.items[0].id], PropertyFilterRuleOperator.IsNull);

    const rootGroup = result.current.state.rootGroup;
    expect(rootGroup).to.containSubset({
      items: [{
        groupId: rootGroup.id,
        operator: PropertyFilterRuleOperator.IsNull,
        value: undefined,
      }],
    });
  });

  it("does not change state when setting non existing rule operator", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;

    actions.setRuleOperator(["invalidRule"], PropertyFilterRuleOperator.IsEqual);

    const { state: newState } = result.current;
    expect(state).to.be.eq(newState);
  });

  it("sets rule value", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;

    const value: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING" };
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
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;

    const value: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING" };
    actions.setRuleValue(["invalidRule"], value);

    const { state: newState } = result.current;
    expect(state).to.be.eq(newState);
  });

  it("does not change state when trying to set property on rule group", () => {
    const { result } = renderHook(() => usePropertyFilterBuilderState());
    const { state, actions } = result.current;

    const property: PropertyDescription = { name: "prop", displayLabel: "Prop", typename: "string" };
    actions.setRuleProperty([], property);

    const { state: newState } = result.current;
    expect(state).to.be.eq(newState);
  });

  describe("rule group", () => {
    function getStateWithNestedRule() {
      const { result } = renderHook(() => usePropertyFilterBuilderState());
      const { actions } = result.current;

      const getNestingRule = () => result.current.state.rootGroup.items[1] as PropertyFilterBuilderRuleGroup;
      const getNestedRule = () => getNestingRule().items[0] as PropertyFilterBuilderRule;
      const getNestedRulePath = () => [getNestingRule().id, getNestedRule().id];

      actions.addItem([], "RULE_GROUP");
      expect(getNestingRule()).to.not.be.undefined;
      expect(getNestedRule()).to.not.be.undefined;

      return { result, getNestingRule, getNestedRule, getNestedRulePath };
    }

    describe("nested rule", () => {
      it("sets property", () => {
        const { result, getNestingRule, getNestedRule, getNestedRulePath } = getStateWithNestedRule();
        const { actions } = result.current;

        const property: PropertyDescription = { name: "prop", displayLabel: "Prop", typename: "string" };
        actions.setRuleProperty(getNestedRulePath(), property);

        const rule = getNestedRule();
        expect(rule).to.containSubset({
          groupId: getNestingRule().id,
          property,
        });
      });

      it("sets operator", () => {
        const { result, getNestingRule, getNestedRule, getNestedRulePath } = getStateWithNestedRule();
        const { actions } = result.current;

        actions.setRuleOperator(getNestedRulePath(), PropertyFilterRuleOperator.IsEqual);

        const rule = getNestedRule();
        expect(rule).to.containSubset({
          groupId: getNestingRule().id,
          operator: PropertyFilterRuleOperator.IsEqual,
        });
      });

      it("sets value", () => {
        const { result, getNestingRule, getNestedRule, getNestedRulePath } = getStateWithNestedRule();
        const { actions } = result.current;

        const value: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING" };
        actions.setRuleValue(getNestedRulePath(), value);

        const rule = getNestedRule();
        expect(rule).to.containSubset({
          groupId: getNestingRule().id,
          value,
        });
      });
    });

    it("adds and removes rule", () => {
      const { result, getNestingRule } = getStateWithNestedRule();
      const { actions } = result.current;

      actions.addItem([getNestingRule().id], "RULE");
      expect(getNestingRule().items).to.have.lengthOf(2);

      actions.removeItem([getNestingRule().id, getNestingRule().items[1].id]);
      expect(getNestingRule().items).to.have.lengthOf(1);
    });

    it("removes group when last rule is removed", () => {
      const { result, getNestingRule, getNestedRulePath } = getStateWithNestedRule();
      const { actions } = result.current;

      actions.removeItem(getNestedRulePath());

      expect(getNestingRule()).to.be.undefined;
    });
  });
});
