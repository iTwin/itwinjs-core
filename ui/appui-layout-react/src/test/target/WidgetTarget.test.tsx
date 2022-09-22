/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { addFloatingWidget, addTab, createNineZoneState, NineZoneState, WidgetIdContext, WidgetState } from "../../appui-layout-react";
import { TargetOptionsContext } from "../../appui-layout-react/target/TargetOptions";
import { WidgetTarget } from "../../appui-layout-react/target/WidgetTarget";
import { TestNineZoneProvider } from "../Providers";

interface WrapperProps {
  state: NineZoneState;
  widgetId: WidgetState["id"];
}

function Wrapper({ children, state, widgetId }: React.PropsWithChildren<WrapperProps>) {
  return (
    <TargetOptionsContext.Provider value={{
      version: "2",
    }}>
      <TestNineZoneProvider state={state}>
        <WidgetIdContext.Provider value={widgetId}>
          {children}
        </WidgetIdContext.Provider>
      </TestNineZoneProvider>
    </TargetOptionsContext.Provider>
  );
}

describe("WidgetTarget", () => {
  it("should render a merge target", () => {
    let state = createNineZoneState();
    state = addTab(state, "ft1");
    state = addFloatingWidget(state, "fw1", ["ft1"]);
    const { container } = render(
      <WidgetTarget />,
      {
        wrapper: (props) => <Wrapper state={state} widgetId="fw1" {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-target-mergeTarget").length.should.eq(1);
  });
});
