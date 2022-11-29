/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription, PropertyValueFormat } from "@itwin/appui-abstract";
import { ActiveRuleGroupContext, PropertyFilterBuilderRuleGroupRenderer } from "./FilterBuilderRuleGroup";
import { PropertyFilterBuilderRuleOperatorProps } from "./FilterBuilderRuleOperator";
import { PropertyFilterBuilderRuleValueProps } from "./FilterBuilderRuleValue";
import {
  convertFilterToState,
  isPropertyFilterBuilderRuleGroup, PropertyFilterBuilderActions, PropertyFilterBuilderRule, PropertyFilterBuilderRuleGroup,
  PropertyFilterBuilderRuleGroupItem, usePropertyFilterBuilderState,
} from "./FilterBuilderState";
import { isUnaryPropertyFilterOperator } from "./Operators";
import { PropertyFilter } from "./Types";

/** @alpha */
export interface PropertyFilterBuilderProps {
  properties: PropertyDescription[];
  onFilterChanged: (filter?: PropertyFilter) => void;
  onRulePropertySelected?: (property: PropertyDescription) => void;
  ruleOperatorRenderer?: (props: PropertyFilterBuilderRuleOperatorProps) => React.ReactNode;
  ruleValueRenderer?: (props: PropertyFilterBuilderRuleValueProps) => React.ReactNode;
  ruleGroupDepthLimit?: number;
  propertyRenderer?: (name: string) => React.ReactNode;
  disablePropertySelection?: boolean;
  initialFilter?: PropertyFilter;
}

/** @alpha */
export interface PropertyFilterBuilderContextProps {
  actions: PropertyFilterBuilderActions;
  properties: PropertyDescription[];
  onRulePropertySelected?: (property: PropertyDescription) => void;
  ruleGroupDepthLimit?: number;
}

/** @alpha */
export const PropertyFilterBuilderContext = React.createContext<PropertyFilterBuilderContextProps>(null!);

/** @alpha */
export interface PropertyFilterBuilderRuleRenderingContextProps {
  ruleOperatorRenderer?: (props: PropertyFilterBuilderRuleOperatorProps) => React.ReactNode;
  ruleValueRenderer?: (props: PropertyFilterBuilderRuleValueProps) => React.ReactNode;
  propertyRenderer?: (name: string) => React.ReactNode;
  disablePropertySelection?: boolean;
}

/** @alpha */
export const PropertyFilterBuilderRuleRenderingContext = React.createContext<PropertyFilterBuilderRuleRenderingContextProps>({});

const ROOT_GROUP_PATH: string[] = [];

/** @alpha */
export function PropertyFilterBuilder(props: PropertyFilterBuilderProps) {
  const { properties, onFilterChanged, onRulePropertySelected, ruleOperatorRenderer, ruleValueRenderer, ruleGroupDepthLimit, propertyRenderer, disablePropertySelection, initialFilter } = props;
  const { state, actions } = usePropertyFilterBuilderState(convertFilterToState(initialFilter));
  const rootRef = React.useRef<HTMLDivElement>(null);

  const filter = React.useMemo(() => buildPropertyFilter(state.rootGroup), [state]);
  React.useEffect(() => {
    onFilterChanged(filter);
  }, [filter, onFilterChanged]);

  const contextValue = React.useMemo<PropertyFilterBuilderContextProps>(
    () => ({ actions, properties, onRulePropertySelected, ruleGroupDepthLimit }),
    [actions, properties, onRulePropertySelected, ruleGroupDepthLimit]
  );
  const renderingContextValue = React.useMemo<PropertyFilterBuilderRuleRenderingContextProps>(
    () => ({ ruleOperatorRenderer, ruleValueRenderer, propertyRenderer, disablePropertySelection }),
    [ruleOperatorRenderer, ruleValueRenderer, propertyRenderer, disablePropertySelection]
  );
  return (
    <PropertyFilterBuilderRuleRenderingContext.Provider value={renderingContextValue}>
      <PropertyFilterBuilderContext.Provider value={contextValue}>
        <ActiveRuleGroupContext.Provider value={useActiveRuleGroupContextProps(rootRef)}>
          <div ref={rootRef} className="filter-builder">
            <PropertyFilterBuilderRuleGroupRenderer path={ROOT_GROUP_PATH} group={state.rootGroup} />
          </div>
        </ActiveRuleGroupContext.Provider>
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
  const { property, operator, value } = rule;
  if (!property || operator === undefined)
    return undefined;

  if (!isUnaryPropertyFilterOperator(operator) && (value === undefined || value.valueFormat !== PropertyValueFormat.Primitive || value.value === undefined))
    return undefined;

  return { property, operator, value };
}

function useActiveRuleGroupContextProps(rootElementRef: React.RefObject<HTMLElement>) {
  const [activeElement, setActiveElement] = React.useState<HTMLElement | undefined>();

  const onFocus: React.FocusEventHandler<HTMLElement> = React.useCallback((e) => {
    e.stopPropagation();
    setActiveElement(e.currentTarget);
  }, []);

  const onBlur: React.FocusEventHandler<HTMLElement> = React.useCallback((e) => {
    e.stopPropagation();
    if (activeElement !== e.currentTarget || (rootElementRef.current && rootElementRef.current.contains(e.relatedTarget)))
      return;

    setActiveElement(undefined);
  }, [activeElement, rootElementRef]);

  const onMouseOver: React.MouseEventHandler<HTMLElement> = React.useCallback((e) => {
    e.stopPropagation();
    setActiveElement(e.currentTarget);
  }, []);

  const onMouseOut: React.MouseEventHandler<HTMLElement> = React.useCallback((e) => {
    e.stopPropagation();
    // istanbul ignore if
    if (activeElement !== e.currentTarget)
      return;

    setActiveElement(undefined);
  }, [activeElement]);

  return React.useMemo(() => ({
    activeElement,
    onFocus,
    onBlur,
    onMouseOver,
    onMouseOut,
  }), [activeElement, onFocus, onBlur, onMouseOver, onMouseOut]);
}
