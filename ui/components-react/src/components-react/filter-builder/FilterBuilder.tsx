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
  FilterBuilderAction, FilterBuilderRule, FilterBuilderRuleGroup, FilterBuilderRuleGroupItem, isFilterBuilderRuleGroup, useFilterBuilderState,
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
export type FilterBuilderDispatch = (action: FilterBuilderAction) => void;

/** @alpha */
export interface FilterBuilderContext {
  dispatch: FilterBuilderDispatch;
  properties: PropertyDescription[];
  onRulePropertySelected?: (property: PropertyDescription) => void;
}
/** @alpha */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const FilterBuilderContext = React.createContext<FilterBuilderContext>(undefined!);

/** @alpha */
export interface FilterBuilderRuleRenderingContext {
  ruleOperatorRenderer?: (props: FilterBuilderRuleOperatorProps) => React.ReactNode;
  ruleValueRenderer?: (props: FilterBuilderRuleValueProps) => React.ReactNode;
}

/** @alpha */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const FilterBuilderRuleRenderingContext = React.createContext<FilterBuilderRuleRenderingContext>(undefined!);

const ROOT_GROUP_PATH: string[] = [];

/** @alpha */
export function FilterBuilder(props: FilterBuilderProps) {
  const { properties, onFilterChanged, onRulePropertySelected, ruleOperatorRenderer, ruleValueRenderer } = props;
  const [state, dispatch] = useFilterBuilderState();

  const filter = React.useMemo(() => buildFilter(state.rootGroup), [state]);
  React.useEffect(() => {
    onFilterChanged(filter);
  }, [filter, onFilterChanged]);

  const contextValue = React.useMemo<FilterBuilderContext>(() => ({dispatch, properties, onRulePropertySelected}), [dispatch, properties, onRulePropertySelected]);
  const renderingContextValue = React.useMemo<FilterBuilderRuleRenderingContext>(() => ({ruleOperatorRenderer, ruleValueRenderer}), [ruleOperatorRenderer, ruleValueRenderer]);
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
