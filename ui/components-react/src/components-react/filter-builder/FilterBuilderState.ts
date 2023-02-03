/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyFilterBuilder
 */

import { Draft, produce } from "immer";
import * as React from "react";
import { PropertyDescription, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { Guid } from "@itwin/core-bentley";
import { isUnaryPropertyFilterOperator, PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "./Operators";
import { isPropertyFilterRuleGroup, PropertyFilter, PropertyFilterRule } from "./Types";

/**
 * Data structure that describes [[PropertyFilterBuilder]] component state.
 * @internal
 */
export interface PropertyFilterBuilderState {
  /** Root group of rules in [[PropertyFilterBuilder]] component. */
  rootGroup: PropertyFilterBuilderRuleGroup;
}

/**
 * Type that describes [[PropertyFilterBuilder]] component group item.
 * @internal
 */
export type PropertyFilterBuilderRuleGroupItem = PropertyFilterBuilderRuleGroup | PropertyFilterBuilderRule;

/**
 * Data structure that describes [[PropertyFilterBuilder]] component rule group.
 * @internal
 */
export interface PropertyFilterBuilderRuleGroup {
  /** Id of this rule group. */
  id: string;
  /** Id of rule group that this group is nested in. */
  groupId?: string;
  /** Operator that should join items in this group. */
  operator: PropertyFilterRuleGroupOperator;
  /** Items in this group. */
  items: PropertyFilterBuilderRuleGroupItem[];
}

/**
 * Data structure that describes [[PropertyFilterBuilder]] component single rule.
 * @internal
 */
export interface PropertyFilterBuilderRule {
  /** Id of this rule. */
  id: string;
  /** Id of rule group that this rule is nested in. */
  groupId: string;
  /** Property used in this rule. */
  property?: PropertyDescription;
  /** Operator that should be used to compare property value. */
  operator?: PropertyFilterRuleOperator;
  /** Value that property should be compared to. */
  value?: PropertyValue;
}

/**
 * Actions for controlling [[PropertyFilterBuilder]] component state.
 * @internal
 */
export class PropertyFilterBuilderActions {
  constructor(private setState: (setter: (prevState: PropertyFilterBuilderState) => PropertyFilterBuilderState) => void) { }

  private updateState(updater: (state: Draft<PropertyFilterBuilderState>) => void) {
    this.setState(produce(updater));
  }

  /** Adds new rule or group of rules to the group specified by path. */
  public addItem(path: string[], itemType: "RULE_GROUP" | "RULE") {
    this.updateState((state) => {
      const parentGroup = findRuleGroup(state.rootGroup, path);
      if (!parentGroup)
        return;
      const item = itemType === "RULE_GROUP" ? createEmptyRuleGroup(parentGroup.id) : createEmptyRule(parentGroup.id);
      parentGroup.items.push(item);
    });
  }

  /** Removes item specified by path. */
  public removeItem(path: string[]) {
    function removeItemFromGroup(state: Draft<PropertyFilterBuilderState>, pathToItem: string[]) {
      const pathToParent = pathToItem.slice(0, -1);
      const parentGroup = findRuleGroup(state.rootGroup, pathToParent);
      if (!parentGroup)
        return;
      const itemId = pathToItem[pathToItem.length - 1];
      const itemIndex = parentGroup.items.findIndex((item) => item.id === itemId);
      if (itemIndex === -1)
        return;
      parentGroup.items.splice(itemIndex, 1);
      if (parentGroup.items.length === 0)
        removeItemFromGroup(state, pathToParent);
    }

    this.updateState((state) => {
      removeItemFromGroup(state, path);
    });
  }

  /** Sets operator of rule group specified by the path. */
  public setRuleGroupOperator(path: string[], operator: PropertyFilterRuleGroupOperator) {
    this.updateState((state) => {
      const group = findRuleGroup(state.rootGroup, path);
      if (!group)
        return;
      group.operator = operator;
    });
  }

  /** Sets property of rule specified by the path. */
  public setRuleProperty(path: string[], property?: PropertyDescription) {
    this.updateState((state) => {
      const rule = findRule(state.rootGroup, path);
      if (!rule)
        return;
      rule.property = property;
      rule.value = undefined;
    });
  }

  /** Sets operator of rule specified by the path. */
  public setRuleOperator(path: string[], operator: PropertyFilterRuleOperator) {
    this.updateState((state) => {
      const rule = findRule(state.rootGroup, path);
      if (!rule)
        return;
      if (isUnaryPropertyFilterOperator(operator))
        rule.value = undefined;
      rule.operator = operator;
    });
  }

  /** Sets value of rule specified by the path. */
  public setRuleValue(path: string[], value: PropertyValue) {
    this.updateState((state) => {
      const rule = findRule(state.rootGroup, path);
      if (!rule)
        return;
      rule.value = value;
    });
  }
}

/**
 * Function to check if supplied [[PropertyFilterBuilderRuleGroupItem]] is [[PropertyFilterBuilderRuleGroup]].
 * @internal
 */
export function isPropertyFilterBuilderRuleGroup(item: PropertyFilterBuilderRuleGroupItem): item is PropertyFilterBuilderRuleGroup {
  return (item as any).items !== undefined;
}

/**
 * Custom hook that creates state for [[PropertyFilterBuilder]] component. It creates empty state or initializes
 * state from supplied initial filter.
 * @internal
 */
export function usePropertyFilterBuilderState(initialFilter?: PropertyFilter) {
  const [state, setState] = React.useState<PropertyFilterBuilderState>(
    () => initialFilter ? convertFilterToState(initialFilter) : { rootGroup: createEmptyRuleGroup() }
  );
  const [actions] = React.useState(() => new PropertyFilterBuilderActions(setState));

  return { state, actions };
}

/** @internal */
export function buildPropertyFilter(groupItem: PropertyFilterBuilderRuleGroupItem): PropertyFilter | undefined {
  if (isPropertyFilterBuilderRuleGroup(groupItem))
    return buildPropertyFilterFromRuleGroup(groupItem);
  return buildPropertyFilterFromRule(groupItem);
}

function buildPropertyFilterFromRuleGroup(rootGroup: PropertyFilterBuilderRuleGroup): PropertyFilter | undefined {
  if (rootGroup.items.length === 0)
    return undefined;

  const rules = new Array<PropertyFilter>();
  for (const item of rootGroup.items) {
    const rule = buildPropertyFilter(item);
    if (!rule)
      return undefined;
    rules.push(rule);
  }

  if (rules.length === 1)
    return rules[0];

  return {
    operator: rootGroup.operator,
    rules,
  };
}

function buildPropertyFilterFromRule(rule: PropertyFilterBuilderRule): PropertyFilter | undefined {
  const { property, operator, value } = rule;
  if (!property || operator === undefined)
    return undefined;

  if (!isUnaryPropertyFilterOperator(operator) && (value === undefined || value.valueFormat !== PropertyValueFormat.Primitive || value.value === undefined))
    return undefined;

  return { property, operator, value };
}

function createEmptyRule(groupId: string): PropertyFilterBuilderRule {
  return {
    id: Guid.createValue(),
    groupId,
  };
}

function createEmptyRuleGroup(groupId?: string): PropertyFilterBuilderRuleGroup {
  const id = Guid.createValue();
  return {
    id,
    groupId,
    operator: PropertyFilterRuleGroupOperator.And,
    items: [createEmptyRule(id)],
  };
}

function findRuleGroup(rootGroup: PropertyFilterBuilderRuleGroup, path: string[]): PropertyFilterBuilderRuleGroup | undefined {
  if (path.length === 0)
    return rootGroup;

  const [currentItemId, ...rest] = path;
  const currentItem = rootGroup.items.find((item) => item.id === currentItemId);
  if (!currentItem || !isPropertyFilterBuilderRuleGroup(currentItem))
    return undefined;

  return findRuleGroup(currentItem, rest);
}

function findRule(rootGroup: PropertyFilterBuilderRuleGroup, path: string[]): PropertyFilterBuilderRule | undefined {
  if (path.length === 0)
    return undefined;

  const [currentItemId, ...rest] = path;
  const currentItem = rootGroup.items.find((item) => item.id === currentItemId);
  if (!currentItem)
    return undefined;

  if (isPropertyFilterBuilderRuleGroup(currentItem))
    return findRule(currentItem, rest);

  return currentItem;
}

function getRuleGroupItem(filter: PropertyFilter, parentId: string): PropertyFilterBuilderRuleGroupItem {
  const id = Guid.createValue();
  if (isPropertyFilterRuleGroup(filter))
    return {
      id,
      groupId: parentId,
      operator: filter.operator,
      items: filter.rules.map((rule) => getRuleGroupItem(rule, id)),
    };
  return getRuleItem(filter, id);
}

function getRuleItem(filter: PropertyFilterRule, parentId: string) {
  return {
    id: Guid.createValue(),
    groupId: parentId,
    property: filter.property,
    operator: filter.operator,
    value: filter.value,
  };
}

function convertFilterToState(filter: PropertyFilter): PropertyFilterBuilderState {
  const id = Guid.createValue();
  if (isPropertyFilterRuleGroup(filter)) {
    return {
      rootGroup: {
        id,
        operator: filter.operator,
        items: filter.rules.map((rule) => getRuleGroupItem(rule, id)),
      },
    };
  }
  return {
    rootGroup: {
      id,
      operator: PropertyFilterRuleGroupOperator.And,
      items: [getRuleItem(filter, id)],
    },
  };
}
