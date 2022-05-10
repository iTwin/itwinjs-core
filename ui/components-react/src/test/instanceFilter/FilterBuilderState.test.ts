/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import { PropertyDescription, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { renderHook } from "@testing-library/react-hooks";
import { FilterRule, FilterRuleGroup, useFilterBuilderState } from "../../components-react/instanceFilter/FilterBuilderState";
import { FilterRuleGroupOperator, FilterRuleOperator } from "../../components-react/instanceFilter/Operators";
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
    const [state] = result.current;
    expect(state.rootGroup).to.containSubset({
      operator: FilterRuleGroupOperator.And,
      items: [{
        groupId: state.rootGroup.id,
      }],
    });
  });

  it("adds rule to root group", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const dispatch = result.current[1];
    dispatch({type: "ADD_ITEM", itemType: "RULE", path: []});

    const rootGroup = result.current[0].rootGroup;
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
    const dispatch = result.current[1];
    dispatch({type: "ADD_ITEM", itemType: "RULE_GROUP", path: []});

    const nestedGroup = result.current[0].rootGroup.items[1];
    expect(nestedGroup).to.not.be.undefined;

    dispatch({type: "ADD_ITEM", itemType: "RULE", path: [nestedGroup.id]});

    const rootGroup = result.current[0].rootGroup;
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
    const dispatch = result.current[1];
    dispatch({type: "ADD_ITEM", itemType: "RULE_GROUP", path: []});

    const rootGroup = result.current[0].rootGroup;
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
    const [state, dispatch] = result.current;
    dispatch({type: "ADD_ITEM", itemType: "RULE_GROUP", path: ["invalidParent"]});

    const newState = result.current[0];
    expect(state).to.be.eq(newState);
  });

  it("removes rule from root group", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const dispatch = result.current[1];

    let rootGroup = result.current[0].rootGroup;
    expect(rootGroup.items).to.have.lengthOf(1);
    dispatch({type: "REMOVE_ITEM", path: [rootGroup.items[0].id]});

    rootGroup = result.current[0].rootGroup;
    expect(rootGroup).to.containSubset({
      operator: FilterRuleGroupOperator.And,
      items: [],
    });
  });

  it("does not change state if parent group is not found when removing item", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const [state, dispatch] = result.current;
    dispatch({type: "REMOVE_ITEM", path: ["invalidParent", state.rootGroup.items[0].id]});

    const newState = result.current[0];
    expect(state).to.be.eq(newState);
  });

  it("does not change state when removing non existing item", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const [state, dispatch] = result.current;
    dispatch({type: "REMOVE_ITEM", path: ["invalidItem"]});

    const newState = result.current[0];
    expect(state).to.be.eq(newState);
  });

  it("sets root group operator", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const [state, dispatch] = result.current;

    expect(state.rootGroup.operator).to.be.eq(FilterRuleGroupOperator.And);
    dispatch({type: "SET_RULE_GROUP_OPERATOR", operator: FilterRuleGroupOperator.Or, path: []});

    const rootGroup = result.current[0].rootGroup;
    expect(rootGroup).to.containSubset({
      operator: FilterRuleGroupOperator.Or,
      items: [{
        groupId: rootGroup.id,
      }],
    });
  });

  it("does not change state when setting non existing group operator", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const [state, dispatch] = result.current;
    dispatch({type: "SET_RULE_GROUP_OPERATOR", operator: FilterRuleGroupOperator.Or, path: ["invalidGroup"]});

    const newState = result.current[0];
    expect(state).to.be.eq(newState);
  });

  it("sets rule property", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const [state, dispatch] = result.current;

    const property: PropertyDescription = {name: "prop", displayLabel: "Prop", typename: "string"};
    dispatch({type: "SET_RULE_PROPERTY", property, path: [state.rootGroup.items[0].id]});

    const rootGroup = result.current[0].rootGroup;
    expect(rootGroup).to.containSubset({
      items: [{
        groupId: rootGroup.id,
        property,
      }],
    });
  });

  it("does not change state when setting non existing rule property", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const [state, dispatch] = result.current;

    const property: PropertyDescription = {name: "prop", displayLabel: "Prop", typename: "string"};
    dispatch({type: "SET_RULE_PROPERTY", property, path: ["invalidRule"]});

    const newState = result.current[0];
    expect(state).to.be.eq(newState);
  });

  it("sets rule operator", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const [state, dispatch] = result.current;

    dispatch({type: "SET_RULE_OPERATOR", operator: FilterRuleOperator.IsEqual, path: [state.rootGroup.items[0].id]});

    const rootGroup = result.current[0].rootGroup;
    expect(rootGroup).to.containSubset({
      items: [{
        groupId: rootGroup.id,
        operator: FilterRuleOperator.IsEqual,
      }],
    });
  });

  it("resets rule value if new operator does not need value", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const [state, dispatch] = result.current;

    const value: PropertyValue = {valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING"};
    dispatch({type: "SET_RULE_VALUE", value, path: [state.rootGroup.items[0].id]});
    const rule = result.current[0].rootGroup.items[0] as FilterRule;
    expect(rule.value).to.be.deep.eq(value);

    dispatch({type: "SET_RULE_OPERATOR", operator: FilterRuleOperator.IsNull, path: [state.rootGroup.items[0].id]});

    const rootGroup = result.current[0].rootGroup;
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
    const [state, dispatch] = result.current;

    dispatch({type: "SET_RULE_OPERATOR", operator: FilterRuleOperator.IsEqual, path: ["invalidRule"]});

    const newState = result.current[0];
    expect(state).to.be.eq(newState);
  });

  it("sets rule value", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const [state, dispatch] = result.current;

    const value: PropertyValue = {valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING"};
    dispatch({type: "SET_RULE_VALUE", value, path: [state.rootGroup.items[0].id]});

    const rootGroup = result.current[0].rootGroup;
    expect(rootGroup).to.containSubset({
      items: [{
        groupId: rootGroup.id,
        value,
      }],
    });
  });

  it("does not change state when setting non existing rule value", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const [state, dispatch] = result.current;

    const value: PropertyValue = {valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING"};
    dispatch({type: "SET_RULE_VALUE", value, path: ["invalidRule"]});

    const newState = result.current[0];
    expect(state).to.be.eq(newState);
  });

  it("does not change state when trying to set property on rule group", () => {
    const {result} = renderHook(() => useFilterBuilderState());
    const [state, dispatch] = result.current;

    const property: PropertyDescription = {name: "prop", displayLabel: "Prop", typename: "string"};
    dispatch({type: "SET_RULE_PROPERTY", property, path: []});

    const newState = result.current[0];
    expect(state).to.be.eq(newState);
  });

  describe("nested rule", () => {
    function getStateWithNestedRule() {
      const {result} = renderHook(() => useFilterBuilderState());
      const [_, dispatch] = result.current;

      const getNestingRule = () => result.current[0].rootGroup.items[1] as FilterRuleGroup;
      const getNestedRule = () => getNestingRule().items[0] as FilterRule;
      const getNestedRulePath = () => [getNestingRule().id, getNestedRule().id];

      dispatch({type: "ADD_ITEM", itemType: "RULE_GROUP", path: []});
      expect(getNestingRule()).to.not.be.undefined;
      expect(getNestedRule()).to.not.be.undefined;

      return {result, getNestingRule, getNestedRule, getNestedRulePath};
    }

    it("sets property", () => {
      const {result, getNestingRule, getNestedRule, getNestedRulePath} = getStateWithNestedRule();
      const [_, dispatch] = result.current;

      const property: PropertyDescription = {name: "prop", displayLabel: "Prop", typename: "string"};
      dispatch({type: "SET_RULE_PROPERTY", property, path: getNestedRulePath()});

      const rule = getNestedRule();
      expect(rule).to.containSubset({
        groupId: getNestingRule().id,
        property,
      });
    });

    it("sets operator", () => {
      const {result, getNestingRule, getNestedRule, getNestedRulePath} = getStateWithNestedRule();
      const [_, dispatch] = result.current;

      dispatch({type: "SET_RULE_OPERATOR", operator: FilterRuleOperator.IsEqual, path: getNestedRulePath()});

      const rule = getNestedRule();
      expect(rule).to.containSubset({
        groupId: getNestingRule().id,
        operator: FilterRuleOperator.IsEqual,
      });
    });

    it("sets value", () => {
      const {result, getNestingRule, getNestedRule, getNestedRulePath} = getStateWithNestedRule();
      const [_, dispatch] = result.current;

      const value: PropertyValue = {valueFormat: PropertyValueFormat.Primitive, value: "test string", displayValue: "TEST STRING"};
      dispatch({type: "SET_RULE_VALUE", value, path: getNestedRulePath()});

      const rule = getNestedRule();
      expect(rule).to.containSubset({
        groupId: getNestingRule().id,
        value,
      });
    });

    it("removes", () => {
      const {result, getNestingRule, getNestedRulePath} = getStateWithNestedRule();
      const [_, dispatch] = result.current;

      dispatch({type: "REMOVE_ITEM", path: getNestedRulePath()});

      const nestingRule = getNestingRule();
      expect(nestingRule.items).to.be.empty;
    });
  });
});
