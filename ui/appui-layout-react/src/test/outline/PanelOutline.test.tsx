/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { createNineZoneState, DragManager, NineZoneState, PanelSide, PanelSideContext, PanelStateContext } from "../../appui-layout-react";
import { PanelOutline, useHidden } from "../../appui-layout-react/outline/PanelOutline";
import { TargetOptionsContext } from "../../appui-layout-react/target/TargetOptions";
import { createDragStartArgs, TestNineZoneProvider } from "../Providers";
import { renderHook } from "@testing-library/react-hooks";
import { act } from "react-dom/test-utils";
import { updatePanelState } from "../../appui-layout-react/state/internal/PanelStateHelpers";

describe("PanelOutline", () => {
  interface WrapperProps {
    state?: NineZoneState;
    side?: PanelSide;
  }

  function Wrapper({ children, state, side }: React.PropsWithChildren<WrapperProps>) {
    state = state ?? createNineZoneState();
    side = side ?? "left";
    return (
      <TargetOptionsContext.Provider value={{
        version: "2",
      }}>
        <TestNineZoneProvider state={state}>
          <PanelStateContext.Provider value={state.panels[side]}>
            {children}
          </PanelStateContext.Provider>
        </TestNineZoneProvider>
      </TargetOptionsContext.Provider>
    );
  }

  it("should render", () => {
    const { container } = render(
      <PanelOutline />,
      {
        wrapper: (props) => <Wrapper {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-outline-panelOutline").length.should.eq(1);
  });

  it("should render spanned horizontal outline", () => {
    let state = createNineZoneState();
    state = updatePanelState(state, "bottom", { span: true });
    const { container } = render(
      <PanelOutline />,
      {
        wrapper: (props) => <Wrapper state={state} side="bottom" {...props} />, // eslint-disable-line react/display-name
      }
    );
    container.getElementsByClassName("nz-outline-panelOutline nz-span").length.should.eq(1);
  });
});

describe("useHidden", () => {
  interface WrapperProps {
    side?: PanelSide;
    dragManagerRef?: React.Ref<DragManager>;
  }

  function Wrapper({ children, dragManagerRef, side }: React.PropsWithChildren<WrapperProps>) {
    side = side ?? "left";
    return (
      <TestNineZoneProvider
        dragManagerRef={dragManagerRef}
      >
        <PanelSideContext.Provider value={side}>
          {children}
        </PanelSideContext.Provider>
      </TestNineZoneProvider>
    );
  }

  it("should return `true` if target is not a panel", () => {
    const dragManagerRef = React.createRef<DragManager>();
    const { result } = renderHook(() => useHidden(), {
      wrapper: (props) => <Wrapper dragManagerRef={dragManagerRef} {...props} />, // eslint-disable-line react/display-name
    });
    act(() => {
      dragManagerRef.current?.handleDragStart(createDragStartArgs());
      dragManagerRef.current?.handleTargetChanged({
        type: "window",
      });
    });
    result.current.should.true;
  });

  it("should return `true` if target is not a current panel", () => {
    const dragManagerRef = React.createRef<DragManager>();
    const { result } = renderHook(() => useHidden(), {
      wrapper: (props) => <Wrapper dragManagerRef={dragManagerRef} {...props} />, // eslint-disable-line react/display-name
    });
    act(() => {
      dragManagerRef.current?.handleDragStart(createDragStartArgs());
      dragManagerRef.current?.handleTargetChanged({
        type: "panel",
        side: "right",
        newWidgetId: "",
      });
    });
    result.current.should.true;
  });

  it("should return `false`", () => {
    const dragManagerRef = React.createRef<DragManager>();
    const { result } = renderHook(() => useHidden(), {
      wrapper: (props) => <Wrapper dragManagerRef={dragManagerRef} {...props} />, // eslint-disable-line react/display-name
    });
    act(() => {
      dragManagerRef.current?.handleDragStart(createDragStartArgs());
      dragManagerRef.current?.handleTargetChanged({
        type: "panel",
        side: "left",
        newWidgetId: "",
      });
    });
    result.current.should.false;
  });
});
