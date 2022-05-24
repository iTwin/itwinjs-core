/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Draft, produce } from "immer";
import * as React from "react";
import { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import { Guid } from "@itwin/core-bentley";
import { FilterRuleGroupOperator, FilterRuleOperator, filterRuleOperatorNeedsValue } from "./Operators";

/** @alpha */
export interface FilterBuilderState {
  rootGroup: FilterBuilderRuleGroup;
}

/** @alpha */
export type FilterBuilderRuleGroupItem = FilterBuilderRuleGroup | FilterBuilderRule;

/** @alpha */
export interface FilterBuilderRuleGroup {
  id: string;
  groupId?: string;
  operator: FilterRuleGroupOperator;
  items: FilterBuilderRuleGroupItem[];
}

/** @alpha */
export interface FilterBuilderRule {
  id: string;
  groupId: string;
  property?: PropertyDescription;
  operator?: FilterRuleOperator;
  value?: PropertyValue;
}

/** @alpha */
export class FilterBuilderActions {
  constructor(private setState: (setter: (prevState: FilterBuilderState) => FilterBuilderState) => void) {}

  private updateState(updater: (state: Draft<FilterBuilderState>) => void) {
    this.setState(produce(updater));
  }

  public addItem(path: string[], itemType: "RULE_GROUP" | "RULE") {
    this.updateState((state) => {
      const parentGroup = findRuleGroup(state.rootGroup, path);
      if (!parentGroup)
        return;
      const item = itemType === "RULE_GROUP" ? createEmptyRuleGroup(parentGroup.id) : createEmptyRule(parentGroup.id);
      parentGroup.items.push(item);
    });
  }

  public removeItem(path: string[]) {
    this.updateState((state) => {
      const itemId = path.pop();
      const parentGroup = findRuleGroup(state.rootGroup, path);
      if (!parentGroup)
        return;
      const itemIndex = parentGroup.items.findIndex((item) => item.id === itemId);
      if (itemIndex === -1)
        return;
      parentGroup.items.splice(itemIndex, 1);
    });
  }

  public setRuleGroupOperator(path: string[], operator: FilterRuleGroupOperator) {
    this.updateState((state) => {
      const group = findRuleGroup(state.rootGroup, path);
      if (!group)
        return;
      group.operator = operator;
    });
  }

  public setRuleProperty(path: string[], property?: PropertyDescription) {
    this.updateState((state) => {
      const rule = findRule(state.rootGroup, path);
      if (!rule)
        return;
      rule.property = property;
      rule.operator = undefined;
      rule.value = undefined;
    });
  }

  public setRuleOperator(path: string[], operator: FilterRuleOperator) {
    this.updateState((state) => {
      const rule = findRule(state.rootGroup, path);
      if (!rule)
        return;
      if (!filterRuleOperatorNeedsValue(operator))
        rule.value = undefined;
      rule.operator = operator;
    });
  }

  public setRuleValue(path: string[], value: PropertyValue) {
    this.updateState((state) => {
      const rule = findRule(state.rootGroup, path);
      if (!rule)
        return;
      rule.value = value;
    });
  }
}

/** @alpha */
export function isFilterBuilderRuleGroup(item: FilterBuilderRuleGroupItem): item is FilterBuilderRuleGroup {
  return (item as any).items !== undefined;
}

/** @alpha */
export function useFilterBuilderState() {
  const [state, setState] = React.useState<FilterBuilderState>(() => ({
    rootGroup: createEmptyRuleGroup(),
  }));
  const [actions] = React.useState(() => new FilterBuilderActions(setState));

  return { state, actions };
}

function createEmptyRule(groupId: string): FilterBuilderRule {
  return {
    id: Guid.createValue(),
    groupId,
  };
}

function createEmptyRuleGroup(groupId?: string): FilterBuilderRuleGroup {
  const id = Guid.createValue();
  return {
    id,
    groupId,
    operator: FilterRuleGroupOperator.And,
    items: [createEmptyRule(id)],
  };
}

function findRuleGroup(rootGroup: FilterBuilderRuleGroup, path: string[]): FilterBuilderRuleGroup | undefined {
  if (path.length === 0)
    return rootGroup;

  const [currentItemId, ...rest] = path;
  const currentItem = rootGroup.items.find((item) => item.id === currentItemId);
  if (!currentItem || !isFilterBuilderRuleGroup(currentItem))
    return undefined;

  return findRuleGroup(currentItem, rest);
}

function findRule(rootGroup: FilterBuilderRuleGroup, path: string[]): FilterBuilderRule | undefined {
  if (path.length === 0)
    return undefined;

  const [currentItemId, ...rest] = path;
  const currentItem = rootGroup.items.find((item) => item.id === currentItemId);
  if (!currentItem)
    return undefined;

  if (isFilterBuilderRuleGroup(currentItem))
    return findRule(currentItem, rest);

  return currentItem;
}
