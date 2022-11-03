/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import sinon from "sinon";
import { render } from "@testing-library/react";
import {
  PropertyFilterBuilderContext, PropertyFilterBuilderContextProps, PropertyFilterBuilderRuleRenderingContext,
  PropertyFilterBuilderRuleRenderingContextProps,
} from "../../components-react/filter-builder/FilterBuilder";
import { PropertyFilterBuilderActions } from "../../components-react/filter-builder/FilterBuilderState";
import { ActiveRuleGroupContext, ActiveRuleGroupContextProps } from "../../components-react/filter-builder/FilterBuilderRuleGroup";

/** @internal */
export function renderWithContext(
  component: JSX.Element,
  builderContextProps: Partial<PropertyFilterBuilderContextProps> = {},
  rendererContextProps: Partial<PropertyFilterBuilderRuleRenderingContextProps> = {},
  activeGroupContextProps: Partial<ActiveRuleGroupContextProps> = {},
): ReturnType<typeof render> {
  const builderContextValue: PropertyFilterBuilderContextProps = {
    actions: builderContextProps.actions ?? new PropertyFilterBuilderActions(sinon.fake()),
    properties: builderContextProps.properties ?? [],
    ruleGroupDepthLimit: builderContextProps.ruleGroupDepthLimit,
    onRulePropertySelected: builderContextProps.onRulePropertySelected,
  };

  const rendererContextValue: PropertyFilterBuilderRuleRenderingContextProps = {
    ruleOperatorRenderer: rendererContextProps.ruleOperatorRenderer,
    ruleValueRenderer: rendererContextProps.ruleValueRenderer,
    propertyRenderer: rendererContextProps.propertyRenderer,
  };

  const activeGroupContextValue: ActiveRuleGroupContextProps = {
    activeElement: activeGroupContextProps.activeElement,
    onMouseOver: activeGroupContextProps.onMouseOver ?? sinon.fake(),
    onMouseOut: activeGroupContextProps.onMouseOut ?? sinon.fake(),
    onBlur: activeGroupContextProps.onBlur ?? sinon.fake(),
    onFocus: activeGroupContextProps.onFocus ?? sinon.fake(),
  };

  return render(<PropertyFilterBuilderContext.Provider value={builderContextValue}>
    <PropertyFilterBuilderRuleRenderingContext.Provider value={rendererContextValue}>
      <ActiveRuleGroupContext.Provider value={activeGroupContextValue}>
        {component}
      </ActiveRuleGroupContext.Provider>
    </PropertyFilterBuilderRuleRenderingContext.Provider>
  </PropertyFilterBuilderContext.Provider>);
}
