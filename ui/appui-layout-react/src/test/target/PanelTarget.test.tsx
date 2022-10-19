/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { addPanelWidget, addTab, createNineZoneState, DraggedTabStateContext, DraggedWidgetIdContext, PanelSideContext } from "../../appui-layout-react";
import { renderHook } from "@testing-library/react-hooks";
import { TestNineZoneProvider } from "../Providers";
import { createDraggedTabState } from "../../appui-layout-react/state/internal/TabStateHelpers";
import { useAllowedPanelTarget } from "../../appui-layout-react/target/useAllowedPanelTarget";

describe("useAllowedPanelTarget", () => {
  it("should return `true`", () => {
    const { result } = renderHook(() => useAllowedPanelTarget(), {
      wrapper: (props) => (  // eslint-disable-line react/display-name
        <PanelSideContext.Provider value="left">
          {props.children}
        </PanelSideContext.Provider>
      ),
    });
    result.current.should.true;
  });

  it("should return `false` if dragged tab doesn't allow a panel target", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { allowedPanelTargets: ["right"] });
    const { result } = renderHook(() => useAllowedPanelTarget(), {
      wrapper: (props) => ( // eslint-disable-line react/display-name
        <TestNineZoneProvider state={state}>
          <PanelSideContext.Provider value="left">
            <DraggedTabStateContext.Provider value={createDraggedTabState("t1")}>
              {props.children}
            </DraggedTabStateContext.Provider>
          </PanelSideContext.Provider>
        </TestNineZoneProvider>
      ),
    });
    result.current.should.false;
  });

  it("should return `false` if active tab of a dragged widget doesn't allow a panel target", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { allowedPanelTargets: ["right"] });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { result } = renderHook(() => useAllowedPanelTarget(), {
      wrapper: (props) => ( // eslint-disable-line react/display-name
        <TestNineZoneProvider state={state}>
          <PanelSideContext.Provider value="left">
            <DraggedWidgetIdContext.Provider value="w1">
              {props.children}
            </DraggedWidgetIdContext.Provider>
          </PanelSideContext.Provider>
        </TestNineZoneProvider>
      ),
    });
    result.current.should.false;
  });

  it("should return `false` if any tab of a dragged widget doesn't allow a panel target", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addTab(state, "t2", { allowedPanelTargets: ["right"] });
    state = addPanelWidget(state, "left", "w1", ["t1", "t2"]);
    const { result } = renderHook(() => useAllowedPanelTarget(), {
      wrapper: (props) => ( // eslint-disable-line react/display-name
        <TestNineZoneProvider state={state}>
          <PanelSideContext.Provider value="left">
            <DraggedWidgetIdContext.Provider value="w1">
              {props.children}
            </DraggedWidgetIdContext.Provider>
          </PanelSideContext.Provider>
        </TestNineZoneProvider>
      ),
    });
    result.current.should.false;
  });
});
