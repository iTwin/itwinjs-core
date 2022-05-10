/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import sinon from "sinon";
import { FilterBuilderContext, FilterBuilderRuleRenderingContext } from "../../components-react/instanceFilter/FilterBuilder";

/** @internal */
export function renderWithContext(
  component: JSX.Element,
  builderContext: Partial<FilterBuilderContext> = {},
  rendererContext: Partial<FilterBuilderRuleRenderingContext> = {}
): ReturnType<typeof render> {
  const builderContextValue: FilterBuilderContext = {
    dispatch: builderContext.dispatch ?? sinon.spy(),
    properties: builderContext.properties ?? [],
    onRulePropertySelected: builderContext.onRulePropertySelected,
  };

  const rendererContextValue: FilterBuilderRuleRenderingContext = {
    ruleOperatorRenderer: rendererContext.ruleOperatorRenderer,
    ruleValueRenderer: rendererContext.ruleValueRenderer,
  };

  return render(<FilterBuilderContext.Provider value={builderContextValue}>
    <FilterBuilderRuleRenderingContext.Provider value={rendererContextValue}>
      {component}
    </FilterBuilderRuleRenderingContext.Provider>
  </FilterBuilderContext.Provider>);
}
