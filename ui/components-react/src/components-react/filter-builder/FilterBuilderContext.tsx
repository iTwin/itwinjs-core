/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyFilterBuilder
 */

import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import { PropertyFilterBuilderActions } from "./FilterBuilderState";
import { PropertyFilterBuilderRuleOperatorProps } from "./FilterBuilderRuleOperator";
import { PropertyFilterBuilderRuleValueProps } from "./FilterBuilderRuleValue";

/**
 * Data structure that describes [[PropertyFilterBuilderContext]] value.
 * @internal
 */
export interface PropertyFilterBuilderContextProps {
  /** Actions for modifying [[PropertyFilterBuilder]] state. */
  actions: PropertyFilterBuilderActions;
  /** List of available properties. */
  properties: PropertyDescription[];
  /** Callback to invoke when property is selected in any rule. */
  onRulePropertySelected?: (property: PropertyDescription) => void;
  /** Specifies how deep rule groups can be nested. */
  ruleGroupDepthLimit?: number;
}

/**
 * Context used to store data for rules and rule groups rendered inside [[PropertyFilterBuilder]] component.
 * @internal
 */
export const PropertyFilterBuilderContext = React.createContext<PropertyFilterBuilderContextProps>(null!);

/**
 * Data structure that describes [[PropertyFilterBuilderRuleRenderingContext]] value.
 * @internal
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
 * @internal
 */
export const PropertyFilterBuilderRuleRenderingContext = React.createContext<PropertyFilterBuilderRuleRenderingContextProps>({});

/**
 * Data structure that describes value of [[ActiveRuleGroupContext]].
 * @internal
 */
export interface ActiveRuleGroupContextProps {
  /** Element of currently active rule group. */
  activeElement: HTMLElement | undefined;
  /** Even handler for rule group element 'onFocus' event */
  onFocus: React.FocusEventHandler<HTMLElement>;
  /** Even handler for rule group element 'onBlur' event */
  onBlur: React.FocusEventHandler<HTMLElement>;
  /** Even handler for rule group element 'onMouseOver' event */
  onMouseOver: React.MouseEventHandler<HTMLElement>;
  /** Even handler for rule group element 'onMouseOut' event */
  onMouseOut: React.MouseEventHandler<HTMLElement>;
}

/**
 * Context for tracking and storing active rule group in [[PropertyFilterBuilder]].
 * Group is considered active if it is focused or hovered.
 * @internal
 */
export const ActiveRuleGroupContext = React.createContext<ActiveRuleGroupContextProps>(null!);

/**
 * Custom hook that created value for [[ActiveRuleGroupContext]].
 * @internal
 */
export function useActiveRuleGroupContextProps(rootElementRef: React.RefObject<HTMLElement>) {
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
