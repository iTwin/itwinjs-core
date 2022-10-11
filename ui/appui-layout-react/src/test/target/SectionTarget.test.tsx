/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { addPanelWidget, addTab, createNineZoneState, DraggedTabStateContext, DraggedWidgetIdContext, NineZoneState, PanelSideContext } from "../../appui-layout-react";
import { renderHook } from "@testing-library/react-hooks";
import { useTargetDirection } from "../../appui-layout-react/target/SectionTarget";
import { TestNineZoneProvider } from "../Providers";
import { SectionTargets } from "../../appui-layout-react/target/SectionTargets";
import { TargetOptionsContext } from "../../appui-layout-react/target/TargetOptions";
import { createDraggedTabState } from "../../appui-layout-react/state/internal/TabStateHelpers";

describe("useTargetDirection", () => {
  it("should return `horizontal`", () => {
    const { result } = renderHook(() => useTargetDirection(), {
      wrapper: (props) => (  // eslint-disable-line react/display-name
        <PanelSideContext.Provider value="bottom">
          {props.children}
        </PanelSideContext.Provider>
      ),
    });
    result.current.should.eq("horizontal");
  });

  it("should return `vertical`", () => {
    const { result } = renderHook(() => useTargetDirection(), {
      wrapper: (props) => (  // eslint-disable-line react/display-name
        <PanelSideContext.Provider value="left">
          {props.children}
        </PanelSideContext.Provider>
      ),
    });
    result.current.should.eq("vertical");
  });
});

interface WrapperProps {
  state: NineZoneState;
}

function DragWidgetWrapper({ children, state }: React.PropsWithChildren<WrapperProps>) {
  return (
    <TargetOptionsContext.Provider value={{
      version: "2",
    }}>
      <TestNineZoneProvider state={state}>
        <PanelSideContext.Provider value="left">
          <DraggedWidgetIdContext.Provider value="w1">
            {children}
          </DraggedWidgetIdContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>
    </TargetOptionsContext.Provider>
  );
}

function DragTabWrapper({ children, state }: React.PropsWithChildren<WrapperProps>) {
  return (
    <TargetOptionsContext.Provider value={{
      version: "2",
    }}>
      <TestNineZoneProvider state={state}>
        <PanelSideContext.Provider value="left">
          <DraggedTabStateContext.Provider value={createDraggedTabState("t1")}>
            {children}
          </DraggedTabStateContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>
    </TargetOptionsContext.Provider>
  );
}

describe("useAllowedPanelTarget", () => {
  it("should render hidden if any tab of a dragged widget doesn't allow a panel target", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addTab(state, "t2", { allowedPanelTargets: ["right"] });
    state = addPanelWidget(state, "right", "w1", ["t1", "t2"]);
    state = addTab(state, "tl1");
    state = addPanelWidget (state, "left", "wl1", ["tl1"]);
    const { container} = render(
      <SectionTargets widgetId="wl1" />,
      {
        wrapper: (props) => <DragWidgetWrapper state={state} {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-hidden").length.should.eq(3);
  });
  it("should render hidden if any tab of a dragged tab doesn't allow a panel target", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addTab(state, "t2", { allowedPanelTargets: ["right"] });
    state = addPanelWidget(state, "right", "w1", ["t1", "t2"]);
    state = addTab(state, "tl1");
    state = addPanelWidget (state, "left", "wl1", ["tl1"]);
    const { container} = render(
      <SectionTargets widgetId="wl1" />,
      {
        wrapper: (props) => <DragTabWrapper state={state} {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-hidden").length.should.eq(3);
  });
});
