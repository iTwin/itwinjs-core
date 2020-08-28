/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import {
  addPanelWidget, createNineZoneState, DragManager, NineZoneDispatch, PanelStateContext, useResizeGrip, WidgetPanelGrip,
} from "../../ui-ninezone";
import { createDragItemInfo, NineZoneProvider } from "../Providers";

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
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <WidgetPanelGrip />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const grip = container.getElementsByClassName("nz-widgetPanels-grip")[0];
    const handle = grip.getElementsByClassName("nz-handle")[0];
    act(() => {
      fireEvent.mouseDown(handle);
      fireEvent.mouseMove(handle);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch PANEL_TOGGLE_COLLAPSED", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
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
    const handle = grip.getElementsByClassName("nz-handle")[0];
    act(() => {
      fireEvent.mouseDown(handle);
      fireEvent.mouseUp(handle);
      fireEvent.mouseDown(handle);
      fireEvent.mouseUp(handle);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "PANEL_TOGGLE_COLLAPSED",
      side: "left",
    })).should.true;
  });

  it("should start resize via timer and dispatch PANEL_RESIZE", () => {
    const fakeTimers = sandbox.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
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
    const handle = grip.getElementsByClassName("nz-handle")[0];
    act(() => {
      fireEvent.mouseDown(handle);
    });
    act(() => {
      fakeTimers.tick(300);
    });
    act(() => {
      const event = document.createEvent("MouseEvent");
      event.initEvent("mousemove");
      sinon.stub(event, "clientX").get(() => 10);
      fireEvent(document, event);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "PANEL_RESIZE",
      side: "left",
      resizeBy: 10,
    })).should.true;
  });

  it("should not start resize w/o pointer down", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <WidgetPanelGrip />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const grip = document.getElementsByClassName("nz-widgetPanels-grip")[0];
    const handle = grip.getElementsByClassName("nz-handle")[0];
    act(() => {
      fireEvent.pointerMove(handle);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should reset initial position on pointer up", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <WidgetPanelGrip />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const grip = document.getElementsByClassName("nz-widgetPanels-grip")[0];
    const handle = grip.getElementsByClassName("nz-handle")[0];
    act(() => {
      fireEvent.pointerDown(handle);
      fireEvent.pointerMove(handle);
      fireEvent.pointerUp(handle);
    });
    container.firstChild!.should.matchSnapshot();
  });
});

describe("useResizeGrip", () => {
  const wrapper = NineZoneProvider;

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should invoke onResize for top grip", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof useResizeGrip>[1]>>();
    const { result } = renderHook(() => useResizeGrip("top", spy), {
      wrapper,
    });
    const element = document.createElement("div");
    act(() => {
      result.current[0](element);
      fireEvent.mouseDown(element);
      fireEvent.mouseMove(document, { clientY: 10 });
    });
    spy.calledOnceWithExactly(10).should.true;
  });

  it("should invoke onResize for bottom grip", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof useResizeGrip>[1]>>();
    const { result } = renderHook(() => useResizeGrip("bottom", spy), {
      wrapper,
    });
    const element = document.createElement("div");
    act(() => {
      result.current[0](element);
      fireEvent.mouseDown(element);
      fireEvent.mouseMove(document, { clientY: 10 });
    });
    spy.calledOnceWithExactly(-10).should.true;
  });

  it("should not invoke onResize if ref is unset", () => {
    const dragManager = React.createRef<DragManager>();
    const spy = sinon.stub<NonNullable<Parameters<typeof useResizeGrip>[1]>>();
    renderHook(() => useResizeGrip("bottom", spy), {
      wrapper: (props) => (<NineZoneProvider // eslint-disable-line react/display-name
        dragManagerRef={dragManager}
        {...props}
      />),
    });
    act(() => {
      dragManager.current?.handleDragStart({
        info: createDragItemInfo(),
        item: {
          type: "panelGrip",
          id: "bottom",
        },
      });
      dragManager.current?.handleDrag(10, 20);
    });
    spy.notCalled.should.true;
  });

  it("should set resizing to true when drag starts", () => {
    const { result } = renderHook(() => useResizeGrip("bottom"), { wrapper });
    const element = document.createElement("div");
    act(() => {
      result.current[0](element);
      fireEvent.mouseDown(element);
      fireEvent.mouseMove(document);
    });
    result.current[1].should.true;
  });

  it("should set resizing to false when drag ends", () => {
    const { result } = renderHook(() => useResizeGrip("bottom"), { wrapper });
    const element = document.createElement("div");
    act(() => {
      result.current[0](element);
      fireEvent.mouseDown(element);
      fireEvent.mouseMove(document);
      fireEvent.mouseUp(document);
    });
    result.current[1].should.false;
  });

  it("should not start drag in timeout w/o required args", () => {
    const fakeTimers = sandbox.useFakeTimers();
    const { result } = renderHook(() => useResizeGrip("bottom"), { wrapper });
    const element = document.createElement("div");
    act(() => {
      result.current[0](element);
      fireEvent.mouseDown(element);
      result.current[0](null);
      fakeTimers.tick(300);
    });
    result.current[1].should.false;
  });
});
