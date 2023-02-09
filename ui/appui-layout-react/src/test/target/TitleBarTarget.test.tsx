/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { addPanelWidget, addTab, createNineZoneState, NineZoneState, WidgetIdContext, WidgetState, WidgetStateContext } from "../../appui-layout-react";
import { TargetOptionsContext } from "../../appui-layout-react/target/TargetOptions";
import { TitleBarTarget } from "../../appui-layout-react/target/TitleBarTarget";
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
          <WidgetStateContext.Provider value={state.widgets[widgetId]}>
            {children}
          </WidgetStateContext.Provider>
        </WidgetIdContext.Provider>
      </TestNineZoneProvider>
    </TargetOptionsContext.Provider>
  );
}

describe("TitleBarTarget", () => {
  it("should render", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TitleBarTarget />,
      {
        wrapper: (props) => <Wrapper state={state} widgetId="w1" {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-target-titleBarTarget").length.should.eq(1);
  });
});
