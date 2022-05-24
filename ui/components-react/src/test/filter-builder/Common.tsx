/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import sinon from "sinon";
import { render } from "@testing-library/react";
import { FilterBuilderActions } from "../../components-react/filter-builder/FilterBuilderState";
import { FilterBuilderContext, FilterBuilderContextProps, FilterBuilderRuleRenderingContext, FilterBuilderRuleRenderingContextProps } from "../../components-react/filter-builder/FilterBuilder";

/** @internal */
export function renderWithContext(
  component: JSX.Element,
  builderContextProps: Partial<FilterBuilderContextProps> = {},
  rendererContextProps: Partial<FilterBuilderRuleRenderingContextProps> = {}
): ReturnType<typeof render> {
  const builderContextValue: FilterBuilderContextProps = {
    actions: builderContextProps.actions ?? new FilterBuilderActions(sinon.spy()),
    properties: builderContextProps.properties ?? [],
    onRulePropertySelected: builderContextProps.onRulePropertySelected,
  };

  const rendererContextValue: FilterBuilderRuleRenderingContextProps = {
    ruleOperatorRenderer: rendererContextProps.ruleOperatorRenderer,
    ruleValueRenderer: rendererContextProps.ruleValueRenderer,
  };

  return render(<FilterBuilderContext.Provider value={builderContextValue}>
    <FilterBuilderRuleRenderingContext.Provider value={rendererContextValue}>
      {component}
    </FilterBuilderRuleRenderingContext.Provider>
  </FilterBuilderContext.Provider>);
}
