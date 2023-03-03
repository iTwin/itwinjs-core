/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyFilterBuilder
 */

import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import {
  ActiveRuleGroupContext, PropertyFilterBuilderContext, PropertyFilterBuilderContextProps, PropertyFilterBuilderRuleRenderingContext,
  PropertyFilterBuilderRuleRenderingContextProps, useActiveRuleGroupContextProps,
} from "./FilterBuilderContext";
import { PropertyFilterBuilderRuleGroupRenderer } from "./FilterBuilderRuleGroup";
import { PropertyFilterBuilderRuleOperatorProps } from "./FilterBuilderRuleOperator";
import { PropertyFilterBuilderRuleValueProps } from "./FilterBuilderRuleValue";
import { buildPropertyFilter, usePropertyFilterBuilderState } from "./FilterBuilderState";
import { PropertyFilter } from "./Types";

/**
 * Props for [[PropertyFilterBuilder]] component.
 * @beta
 */
export interface PropertyFilterBuilderProps {
  /** List of properties available to be used in filter rules. */
  properties: PropertyDescription[];
  /** Callback that is invoked when filter changes. */
  onFilterChanged: (filter?: PropertyFilter) => void;
  /** Callback that is invoked when property is selected in any rule. */
  onRulePropertySelected?: (property: PropertyDescription) => void;
  /** Custom renderer for rule operator selector. */
  ruleOperatorRenderer?: (props: PropertyFilterBuilderRuleOperatorProps) => React.ReactNode;
  /** Custom renderer for rule value input. */
  ruleValueRenderer?: (props: PropertyFilterBuilderRuleValueProps) => React.ReactNode;
  /** Custom renderer for property selector in rule. */
  propertyRenderer?: (name: string) => React.ReactNode;
  /** Specifies how deep rule groups can be nested. */
  ruleGroupDepthLimit?: number;
  /** Specifies whether component is disabled or not. */
  isDisabled?: boolean;
  /** Initial filter that should be shown when component is mounted. */
  initialFilter?: PropertyFilter;
}

const ROOT_GROUP_PATH: string[] = [];

/**
 * Component for building complex filters. It allows to create filter rules or rule groups based on provided list of properties.
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
