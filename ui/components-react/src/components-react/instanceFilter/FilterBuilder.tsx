/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import {
  FilterBuilderAction, FilterRule, FilterRuleGroup, FilterRuleGroupItem, isFilterRuleGroup, useFilterBuilderState,
} from "./FilterBuilderState";
import { FilterBuilderRuleGroup } from "./FilterRuleGroup";
import { FilterBuilderRuleOperatorProps } from "./FilterRuleOperator";
import { FilterBuilderRuleValueProps } from "./FilterRuleValue";
import { filterRuleOperatorNeedsValue } from "./Operators";
import { Filter } from "./Types";
import "./FilterBuilder.scss";

/** @alpha */
export interface FilterBuilderProps {
  properties: PropertyDescription[];
  onFilterChanged: (filter?: Filter) => void;
  onRulePropertySelected: (property: PropertyDescription) => void;
  ruleOperatorRenderer?: (props: FilterBuilderRuleOperatorProps) => React.ReactNode;
  ruleValueRenderer?: (props: FilterBuilderRuleValueProps) => React.ReactNode;
}

/** @alpha */
export type FilterBuilderDispatch = (action: FilterBuilderAction) => void;

/** @alpha */
interface FilterBuilderContext {
  dispatch: FilterBuilderDispatch;
  properties: PropertyDescription[];
  onRulePropertySelected: (property: PropertyDescription) => void;
}
/** @alpha */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const FilterBuilderContext = React.createContext<FilterBuilderContext>(undefined!);

/** @alpha */
interface FilterBuilderRuleRenderingContext {
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

  React.useEffect(() => {
    onFilterChanged(buildFilter(state.rootGroup));
  }, [state, onFilterChanged]);

  const contextValue = React.useMemo<FilterBuilderContext>(() => ({dispatch, properties, onRulePropertySelected}), [dispatch, properties, onRulePropertySelected]);
  const renderingContextValue = React.useMemo<FilterBuilderRuleRenderingContext>(() => ({ruleOperatorRenderer, ruleValueRenderer}), [ruleOperatorRenderer, ruleValueRenderer]);
  return (
    <FilterBuilderRuleRenderingContext.Provider value={renderingContextValue}>
      <FilterBuilderContext.Provider value={contextValue}>
        <div className="filter-builder">
          <FilterBuilderRuleGroup path={ROOT_GROUP_PATH} group={state.rootGroup} />
        </div>
      </FilterBuilderContext.Provider>
    </FilterBuilderRuleRenderingContext.Provider>
  );
}

function buildFilter(groupItem: FilterRuleGroupItem): Filter | undefined {
  if (isFilterRuleGroup(groupItem))
    return buildFilterFromRuleGroup(groupItem);
  return buildFilterFromRule(groupItem);
}

function buildFilterFromRuleGroup(rootGroup: FilterRuleGroup): Filter | undefined {
  if (rootGroup.items.length === 0)
    return undefined;

  const conditions = new Array<Filter>();
  for (const item of rootGroup.items) {
    const condition = buildFilter(item);
    if (!condition)
      return undefined;
    conditions.push(condition);
  }

  if (conditions.length === 1)
    return conditions[0];

  return {
    operator: rootGroup.operator,
    conditions,
  };
}

function buildFilterFromRule(rule: FilterRule): Filter | undefined {
  const {property, operator, value} = rule;
  if (!property || operator === undefined)
    return undefined;

  if (filterRuleOperatorNeedsValue(operator) && !value)
    return undefined;

  return {property, operator, value};
}
