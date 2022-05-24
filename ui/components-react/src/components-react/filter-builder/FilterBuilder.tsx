/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription, PropertyValueFormat } from "@itwin/appui-abstract";
import { FilterBuilderRuleGroupRenderer } from "./FilterBuilderRuleGroup";
import { FilterBuilderRuleOperatorProps } from "./FilterBuilderRuleOperator";
import { FilterBuilderRuleValueProps } from "./FilterBuilderRuleValue";
import {
  FilterBuilderActions, FilterBuilderRule, FilterBuilderRuleGroup, FilterBuilderRuleGroupItem, isFilterBuilderRuleGroup, useFilterBuilderState,
} from "./FilterBuilderState";
import { filterRuleOperatorNeedsValue } from "./Operators";
import { Filter } from "./Types";
import "./FilterBuilder.scss";

/** @alpha */
export interface FilterBuilderProps {
  properties: PropertyDescription[];
  onFilterChanged: (filter?: Filter) => void;
  onRulePropertySelected?: (property: PropertyDescription) => void;
  ruleOperatorRenderer?: (props: FilterBuilderRuleOperatorProps) => React.ReactNode;
  ruleValueRenderer?: (props: FilterBuilderRuleValueProps) => React.ReactNode;
}

/** @alpha */
export interface FilterBuilderContextProps {
  actions: FilterBuilderActions;
  properties: PropertyDescription[];
  onRulePropertySelected?: (property: PropertyDescription) => void;
}

/** @alpha */
export const FilterBuilderContext = React.createContext<FilterBuilderContextProps>(null!);

/** @alpha */
export interface FilterBuilderRuleRenderingContextProps {
  ruleOperatorRenderer?: (props: FilterBuilderRuleOperatorProps) => React.ReactNode;
  ruleValueRenderer?: (props: FilterBuilderRuleValueProps) => React.ReactNode;
}

/** @alpha */
export const FilterBuilderRuleRenderingContext = React.createContext<FilterBuilderRuleRenderingContextProps>({});

const ROOT_GROUP_PATH: string[] = [];

/** @alpha */
export function FilterBuilder(props: FilterBuilderProps) {
  const { properties, onFilterChanged, onRulePropertySelected, ruleOperatorRenderer, ruleValueRenderer } = props;
  const {state, actions} = useFilterBuilderState();

  const filter = React.useMemo(() => buildFilter(state.rootGroup), [state]);
  React.useEffect(() => {
    onFilterChanged(filter);
  }, [filter, onFilterChanged]);

  const contextValue = React.useMemo<FilterBuilderContextProps>(() => ({actions, properties, onRulePropertySelected}), [actions, properties, onRulePropertySelected]);
  const renderingContextValue = React.useMemo<FilterBuilderRuleRenderingContextProps>(() => ({ruleOperatorRenderer, ruleValueRenderer}), [ruleOperatorRenderer, ruleValueRenderer]);
  return (
    <FilterBuilderRuleRenderingContext.Provider value={renderingContextValue}>
      <FilterBuilderContext.Provider value={contextValue}>
        <div className="filter-builder">
          <FilterBuilderRuleGroupRenderer path={ROOT_GROUP_PATH} group={state.rootGroup} />
        </div>
      </FilterBuilderContext.Provider>
    </FilterBuilderRuleRenderingContext.Provider>
  );
}

/** @internal */
export function buildFilter(groupItem: FilterBuilderRuleGroupItem): Filter | undefined {
  if (isFilterBuilderRuleGroup(groupItem))
    return buildFilterFromRuleGroup(groupItem);
  return buildFilterFromRule(groupItem);
}

function buildFilterFromRuleGroup(rootGroup: FilterBuilderRuleGroup): Filter | undefined {
  if (rootGroup.items.length === 0)
    return undefined;

  const rules = new Array<Filter>();
  for (const item of rootGroup.items) {
    const rule = buildFilter(item);
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

function buildFilterFromRule(rule: FilterBuilderRule): Filter | undefined {
  const {property, operator, value} = rule;
  if (!property || operator === undefined)
    return undefined;

  if (filterRuleOperatorNeedsValue(operator) && (value === undefined || value.valueFormat !== PropertyValueFormat.Primitive || value.value === undefined))
    return undefined;

  return {property, operator, value};
}
