/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import {
  WidgetPanelGrip, createNineZoneState, addPanelWidget, NineZoneDispatch, PANEL_TOGGLE_COLLAPSED, NineZoneProvider, PanelStateContext, PANEL_RESIZE, useResizeGrip,
} from "../../ui-ninezone";
import { Point } from "@bentley/ui-core";

describe("WidgetPanelGrip", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render resizing", () => {
    const nineZone = createNineZoneState();
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <WidgetPanelGrip />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const grip = container.getElementsByClassName("nz-widgetPanels-grip")[0];
    act(() => {
      fireEvent.pointerDown(grip);
      fireEvent.pointerMove(grip);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch PANEL_TOGGLE_COLLAPSED", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <WidgetPanelGrip />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const grip = document.getElementsByClassName("nz-widgetPanels-grip")[0];
    act(() => {
      fireEvent.doubleClick(grip);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: PANEL_TOGGLE_COLLAPSED,
      side: "left",
    })).should.true;
  });

  it("should start resize via timer and dispatch PANEL_RESIZE", () => {
    const fakeTimers = sandbox.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <WidgetPanelGrip />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const grip = document.getElementsByClassName("nz-widgetPanels-grip")[0];
    act(() => {
      fireEvent.pointerDown(grip);
    });
    act(() => {
      fakeTimers.tick(300);
    });
    act(() => {
      const event = document.createEvent("MouseEvent");
      event.initEvent("pointermove");
      sinon.stub(event, "clientX").get(() => 10);
      fireEvent(document, event);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: PANEL_RESIZE,
      side: "left",
      resizeBy: 10,
    })).should.true;
  });

  it("should not start resize w/o pointer down", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <WidgetPanelGrip />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const grip = document.getElementsByClassName("nz-widgetPanels-grip")[0];
    act(() => {
      fireEvent.pointerMove(grip);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should reset initial position on pointer up", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <WidgetPanelGrip />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const grip = document.getElementsByClassName("nz-widgetPanels-grip")[0];
    act(() => {
      fireEvent.pointerDown(grip);
      fireEvent.pointerMove(grip);
      fireEvent.pointerUp(grip);
    });
    container.firstChild!.should.matchSnapshot();
  });
});

describe("useResizeGrip", () => {
  function Wrapper(props: { children?: React.ReactNode }) {
    const nineZone = createNineZoneState();
    return (
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        {props.children}
      </NineZoneProvider>
    );
  }

  it("should invoke onResize for top grip", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof useResizeGrip>[1]>>();
    const { result } = renderHook(() => useResizeGrip("top", spy), {
      wrapper: Wrapper,
    });
    const element = document.createElement("div");
    act(() => {
      (result.current[1] as React.MutableRefObject<HTMLDivElement>).current = element;
      result.current[0](new Point());
      const event = document.createEvent("MouseEvent");
      event.initEvent("pointermove");
      sinon.stub(event, "clientY").get(() => 10);
      fireEvent(document, event);
    });
    spy.calledOnceWithExactly(10).should.true;
  });

  it("should invoke onResize for bottom grip", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof useResizeGrip>[1]>>();
    const { result } = renderHook(() => useResizeGrip("bottom", spy), {
      wrapper: Wrapper,
    });
    const element = document.createElement("div");
    act(() => {
      (result.current[1] as React.MutableRefObject<HTMLDivElement>).current = element;
      result.current[0](new Point());
      const event = document.createEvent("MouseEvent");
      event.initEvent("pointermove");
      sinon.stub(event, "clientY").get(() => 10);
      fireEvent(document, event);
    });
    spy.calledOnceWithExactly(-10).should.true;
  });
});
