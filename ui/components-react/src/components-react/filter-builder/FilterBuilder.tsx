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
import { isUnaryPropertyFilterOperator } from "./Operators";
import { PropertyFilter } from "./Types";

/**
 * Props for [[PropertyFilterBuilder]] component,
 * @beta
 */
export interface PropertyFilterBuilderProps {
  /** List of properties to use in filter rules. */
  properties: PropertyDescription[];
  /** Callback that is invoked when filter changes. */
  onFilterChanged: (filter?: PropertyFilter) => void;
  /** Callback that is invoked when property is selected in any rule. */
  onRulePropertySelected?: (property: PropertyDescription) => void;
  /** Custom renderer for rule operator selector. */
  ruleOperatorRenderer?: (props: PropertyFilterBuilderRuleOperatorProps) => React.ReactNode;
  /** Custom renderer for rule value input. */
  ruleValueRenderer?: (props: PropertyFilterBuilderRuleValueProps) => React.ReactNode;
  /** Specifies how deep rule groups can be nested. */
  ruleGroupDepthLimit?: number;
  /** Custom renderer for property selector in rule. */
  propertyRenderer?: (name: string) => React.ReactNode;
  /** Specifies whether component is disables or not. */
  isDisabled?: boolean;
  /** Initial filter to show when component is mounted. */
  initialFilter?: PropertyFilter;
}

/**
 * Data structure that describes [[PropertyFilterBuilderContext]] value.
 * @beta
 */
export interface PropertyFilterBuilderContextProps {
  /** Actions for modifying filter. */
  actions: PropertyFilterBuilderActions;
  /** List of available properties. */
  properties: PropertyDescription[];
  /** Callback to invoke when property is selected in any rule. */
  onRulePropertySelected?: (property: PropertyDescription) => void;
  /** Limit for how deep rule groups can be nested. */
  ruleGroupDepthLimit?: number;
}

/**
 * Context used to store data for rules and rule groups inside [[PropertyFilterBuilder]] component.
 * @beta
 */
export const PropertyFilterBuilderContext = React.createContext<PropertyFilterBuilderContextProps>(null!);

/**
 * Data structure that describes [[PropertyFilterBuilderRuleRenderingContext]] value.
 * @beta
 */
export interface PropertyFilterBuilderRuleRenderingContextProps {
  /** Custom renderer for operator selector in rule. */
  ruleOperatorRenderer?: (props: PropertyFilterBuilderRuleOperatorProps) => React.ReactNode;
  /** Custom renderer for value input in rule. */
  ruleValueRenderer?: (props: PropertyFilterBuilderRuleValueProps) => React.ReactNode;
  /** Custom renderer for property selector in rule. */
  propertyRenderer?: (name: string) => React.ReactNode;
  /** Specifies that properties selection is disabled. */
  isDisabled?: boolean;
}

/**
 * Context for rendering rules and rule groups inside [[PropertyFilterBuilder]] component.
 * @beta
 */
export const PropertyFilterBuilderRuleRenderingContext = React.createContext<PropertyFilterBuilderRuleRenderingContextProps>({});

/**
 * Data structure that describes value of [[ActiveRuleGroupContext]].
 * @beta
 */
export interface ActiveRuleGroupContextProps {
  /** Element of currently active rule group. */
  activeElement: HTMLElement | undefined;
  /** Callback to handle rule group element 'onFocus; event */
  onFocus: React.FocusEventHandler<HTMLElement>;
  /** Callback to handle rule group element 'onBlur; event */
  onBlur: React.FocusEventHandler<HTMLElement>;
  /** Callback to handle rule group element 'onMouseOver; event */
  onMouseOver: React.MouseEventHandler<HTMLElement>;
  /** Callback to handle rule group element 'onMouseOut; event */
  onMouseOut: React.MouseEventHandler<HTMLElement>;
}

/**
 * Context for tracking and storing active rule group in [[PropertyFilterBuilder]].
 * Group is considered active if it is focused or hovered.
 * @beta
 */
export const ActiveRuleGroupContext = React.createContext<ActiveRuleGroupContextProps>(null!);

const ROOT_GROUP_PATH: string[] = [];

/**
 * Component for building complex filters. It allows to defines filter rules or rule groups based on provided list of properties.
 * @beta
 */
export function PropertyFilterBuilder(props: PropertyFilterBuilderProps) {
  const { properties, onFilterChanged, onRulePropertySelected, ruleOperatorRenderer, ruleValueRenderer, ruleGroupDepthLimit, propertyRenderer, isDisabled, initialFilter } = props;
  const { state, actions } = usePropertyFilterBuilderState(initialFilter);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const firstRender = React.useRef(true);
  const filter = React.useMemo(() => buildPropertyFilter(state.rootGroup), [state]);
  React.useEffect(() => {
    if (!firstRender.current)
      onFilterChanged(filter);
    firstRender.current = false;
  }, [filter, onFilterChanged]);

  const contextValue = React.useMemo<PropertyFilterBuilderContextProps>(
    () => ({ actions, properties, onRulePropertySelected, ruleGroupDepthLimit }),
    [actions, properties, onRulePropertySelected, ruleGroupDepthLimit]
  );
  const renderingContextValue = React.useMemo<PropertyFilterBuilderRuleRenderingContextProps>(
    () => ({ ruleOperatorRenderer, ruleValueRenderer, propertyRenderer, isDisabled }),
    [ruleOperatorRenderer, ruleValueRenderer, propertyRenderer, isDisabled]
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
