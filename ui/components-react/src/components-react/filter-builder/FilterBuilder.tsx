/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription, PropertyValueFormat } from "@itwin/appui-abstract";
import { PropertyFilterBuilderRuleGroupRenderer } from "./FilterBuilderRuleGroup";
import { PropertyFilterBuilderRuleOperatorProps } from "./FilterBuilderRuleOperator";
import { PropertyFilterBuilderRuleValueProps } from "./FilterBuilderRuleValue";
import {
  isPropertyFilterBuilderRuleGroup, PropertyFilterBuilderActions, PropertyFilterBuilderRule, PropertyFilterBuilderRuleGroup,
  PropertyFilterBuilderRuleGroupItem, usePropertyFilterBuilderState,
} from "./FilterBuilderState";
import { propertyFilterOperatorNeedsValue } from "./Operators";
import { PropertyFilter } from "./Types";
import "./FilterBuilder.scss";

/** @alpha */
export interface PropertyFilterBuilderProps {
  properties: PropertyDescription[];
  onFilterChanged: (filter?: PropertyFilter) => void;
  onRulePropertySelected?: (property: PropertyDescription) => void;
  ruleOperatorRenderer?: (props: PropertyFilterBuilderRuleOperatorProps) => React.ReactNode;
  ruleValueRenderer?: (props: PropertyFilterBuilderRuleValueProps) => React.ReactNode;
}

/** @alpha */
export interface PropertyFilterBuilderContextProps {
  actions: PropertyFilterBuilderActions;
  properties: PropertyDescription[];
  onRulePropertySelected?: (property: PropertyDescription) => void;
}

/** @alpha */
export const PropertyFilterBuilderContext = React.createContext<PropertyFilterBuilderContextProps>(null!);

/** @alpha */
export interface PropertyFilterBuilderRuleRenderingContextProps {
  ruleOperatorRenderer?: (props: PropertyFilterBuilderRuleOperatorProps) => React.ReactNode;
  ruleValueRenderer?: (props: PropertyFilterBuilderRuleValueProps) => React.ReactNode;
}

/** @alpha */
export const PropertyFilterBuilderRuleRenderingContext = React.createContext<PropertyFilterBuilderRuleRenderingContextProps>({});

const ROOT_GROUP_PATH: string[] = [];

/** @alpha */
export function PropertyFilterBuilder(props: PropertyFilterBuilderProps) {
  const { properties, onFilterChanged, onRulePropertySelected, ruleOperatorRenderer, ruleValueRenderer } = props;
  const {state, actions} = usePropertyFilterBuilderState();

  const filter = React.useMemo(() => buildPropertyFilter(state.rootGroup), [state]);
  React.useEffect(() => {
    onFilterChanged(filter);
  }, [filter, onFilterChanged]);

  const contextValue = React.useMemo<PropertyFilterBuilderContextProps>(() => ({actions, properties, onRulePropertySelected}), [actions, properties, onRulePropertySelected]);
  const renderingContextValue = React.useMemo<PropertyFilterBuilderRuleRenderingContextProps>(() => ({ruleOperatorRenderer, ruleValueRenderer}), [ruleOperatorRenderer, ruleValueRenderer]);
  return (
    <PropertyFilterBuilderRuleRenderingContext.Provider value={renderingContextValue}>
      <PropertyFilterBuilderContext.Provider value={contextValue}>
        <div className="filter-builder">
          <PropertyFilterBuilderRuleGroupRenderer path={ROOT_GROUP_PATH} group={state.rootGroup} />
        </div>
      </PropertyFilterBuilderContext.Provider>
    </PropertyFilterBuilderRuleRenderingContext.Provider>
  );
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
  const {property, operator, value} = rule;
  if (!property || operator === undefined)
    return undefined;

  if (propertyFilterOperatorNeedsValue(operator) && (value === undefined || value.valueFormat !== PropertyValueFormat.Primitive || value.value === undefined))
    return undefined;

  return {property, operator, value};
}
