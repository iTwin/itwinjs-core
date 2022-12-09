/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { addPanelWidget, addTab, createNineZoneState, DraggedTabStateContext, DraggedWidgetIdContext, NineZoneState, WidgetState, WidgetStateContext } from "../../appui-layout-react";
import { TargetOptionsContext } from "../../appui-layout-react/target/TargetOptions";
import { TestNineZoneProvider } from "../Providers";
import { TabTarget } from "../../appui-layout-react/target/TabTarget";
import { renderHook } from "@testing-library/react-hooks";
import { useAllowedWidgetTarget } from "../../appui-layout-react/target/useAllowedWidgetTarget";
import { createDraggedTabState } from "../../appui-layout-react/state/internal/TabStateHelpers";

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
        <WidgetStateContext.Provider value={state.widgets[widgetId]}>
          {children}
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>
    </TargetOptionsContext.Provider>
  );
}

describe("TabTarget", () => {
  it("should render", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TabTarget />,
      {
        wrapper: (props) => <Wrapper state={state} widgetId="w1" {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-target-tabTarget").length.should.eq(1);
  });

  it("should return `false` if any tab of a dragged widget doesn't allow the panel that houses the tab", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addTab(state, "t2");
    state = addTab(state, "t3", { allowedPanelTargets: ["right"] });
    state = addPanelWidget(state, "right", "w2", ["t2", "t3"]);
    const { result } = renderHook(() => useAllowedWidgetTarget("w1"), {
      wrapper: (props) => ( // eslint-disable-line react/display-name
        <TestNineZoneProvider state={state}>
          <DraggedWidgetIdContext.Provider value="w2">
            {props.children}
          </DraggedWidgetIdContext.Provider>
        </TestNineZoneProvider>
      ),
    });
    result.current.should.false;
  });

  it("should return `false` if dragged tab doesn't allow the tab's panel target", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addTab(state, "t2", { allowedPanelTargets: ["right"] });
    const { result } = renderHook(() => useAllowedWidgetTarget("w1"), {
      wrapper: (props) => ( // eslint-disable-line react/display-name
        <TestNineZoneProvider state={state}>
          <DraggedTabStateContext.Provider value={createDraggedTabState("t2")}>
            {props.children}
          </DraggedTabStateContext.Provider>
        </TestNineZoneProvider>
      ),
    });
    result.current.should.false;
  });
  it("should return `false` if any tab of a dragged widget doesn't allow the tab's panel target", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addTab(state, "t2");
    state = addTab(state, "t3", { allowedPanelTargets: ["left","right"] });
    state = addTab(state, "t4", { allowedPanelTargets: ["right"] });
    state = addPanelWidget(state, "left", "w2", ["t2", "t3", "t4"]);
    const { result } = renderHook(() => useAllowedWidgetTarget("w1"), {
      wrapper: (props) => ( // eslint-disable-line react/display-name
        <TestNineZoneProvider state={state}>
          <DraggedWidgetIdContext.Provider value="w2">
            {props.children}
          </DraggedWidgetIdContext.Provider>
        </TestNineZoneProvider>
      ),
    });
    result.current.should.false;
  });
});
