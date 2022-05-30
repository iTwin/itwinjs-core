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

/** @internal */
export function renderWithContext(
  component: JSX.Element,
  builderContextProps: Partial<PropertyFilterBuilderContextProps> = {},
  rendererContextProps: Partial<PropertyFilterBuilderRuleRenderingContextProps> = {}
): ReturnType<typeof render> {
  const builderContextValue: PropertyFilterBuilderContextProps = {
    actions: builderContextProps.actions ?? new PropertyFilterBuilderActions(sinon.spy()),
    properties: builderContextProps.properties ?? [],
    onRulePropertySelected: builderContextProps.onRulePropertySelected,
  };

  const rendererContextValue: PropertyFilterBuilderRuleRenderingContextProps = {
    ruleOperatorRenderer: rendererContextProps.ruleOperatorRenderer,
    ruleValueRenderer: rendererContextProps.ruleValueRenderer,
  };

  return render(<PropertyFilterBuilderContext.Provider value={builderContextValue}>
    <PropertyFilterBuilderRuleRenderingContext.Provider value={rendererContextValue}>
      {component}
    </PropertyFilterBuilderRuleRenderingContext.Provider>
  </PropertyFilterBuilderContext.Provider>);
}
