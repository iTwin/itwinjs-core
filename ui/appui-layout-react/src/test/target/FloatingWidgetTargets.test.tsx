/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { addFloatingWidget, createNineZoneState, NineZoneState, TargetOptionsContext, WidgetIdContext, WidgetState } from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";
import { FloatingWidgetTargets } from "../../appui-layout-react/target/FloatingWidgetTargets";

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

describe("FloatingWidgetTargets", () => {
  it("should render a panel target", () => {
    let state = createNineZoneState();
    state = addFloatingWidget(state, "fw1", ["ft1"]);
    const { container } = render(
      <FloatingWidgetTargets />,
      {
        wrapper: (props) => <Wrapper state={state} widgetId="fw1" {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-target-widgetTarget").length.should.eq(1);
  });
});
