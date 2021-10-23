/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import produce from "immer";
import * as React from "react";
import * as sinon from "sinon";
import { Rectangle } from "@itwin/core-react";
import { act, fireEvent, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import {
  addFloatingWidget, addPanelWidget, addTab, createFloatingWidgetState, createNineZoneState, FloatingWidget, NineZoneDispatch, PanelStateContext,
  PanelTarget, useDrag, WidgetIdContext, WidgetTabTarget,
} from "../../appui-layout-react";
import * as NineZoneModule from "../../appui-layout-react/base/NineZone";
import { TestNineZoneProvider } from "../Providers";

describe("WidgetTitleBar", () => {
  it("should dispatch WIDGET_DRAG_END", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", ["t1"], {
      bounds: new Rectangle(0, 100, 200, 400).toProps(),
    });
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </TestNineZoneProvider>,
    );
    const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
    const handle = titleBar.getElementsByClassName("nz-handle")[0];
    act(() => {
      fireEvent.mouseDown(handle);
      fireEvent.mouseMove(document);
      dispatch.reset();
      fireEvent.mouseUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_DRAG_END",
      floatingWidgetId: "w1",
      target: {
        type: "floatingWidget",
      },
    })).should.true;
  });

  it("should dispatch FLOATING_WIDGET_CLEAR_USER_SIZED", () => {
    const fakeTimers = sinon.useFakeTimers();

    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.widgets = [];
      stateDraft.floatingWidgets.byId.w1 = createFloatingWidgetState("w1", {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
        userSized: true,
      });
    });
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </TestNineZoneProvider>,
    );
    const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
    const handle = titleBar.getElementsByClassName("nz-handle")[0];

    act(() => {
      fireEvent.mouseDown(handle);
      fireEvent.mouseUp(handle);
      fireEvent.mouseDown(handle);
      dispatch.reset();
      fireEvent.mouseUp(handle);
      fakeTimers.tick(300);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "FLOATING_WIDGET_CLEAR_USER_SIZED",
      id: "w1",
    })).should.true;
  });

  it("should dispatch WIDGET_DRAG_END with tab target", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", ["t1"], {
      bounds: new Rectangle(0, 100, 200, 400).toProps(),
    });
    nineZone = addPanelWidget(nineZone, "left", "w2", ["t2"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = addTab(nineZone, "t2");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <WidgetIdContext.Provider value="w2">
          <WidgetTabTarget tabIndex={0} first />
        </WidgetIdContext.Provider>
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </TestNineZoneProvider>,
    );
    const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
    const handle = titleBar.getElementsByClassName("nz-handle")[0];
    const target = container.getElementsByClassName("nz-widget-tabTarget")[0];

    sinon.stub(document, "elementFromPoint").returns(target);

    act(() => {
      fireEvent.mouseDown(handle);
      fireEvent.mouseMove(target);
      dispatch.reset();
      fireEvent.mouseUp(document);
    });
    sinon.assert.calledOnceWithExactly(dispatch, sinon.match({
      type: "WIDGET_DRAG_END",
      floatingWidgetId: "w1",
      target: sinon.match({
        tabIndex: 0,
        type: "tab",
        widgetId: "w2",
      }),
    }));
  });

  it("should dispatch WIDGET_DRAG_END with panel target", () => {
    sinon.stub(NineZoneModule, "getUniqueId").returns("newId");
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.widgets = [];
      stateDraft.floatingWidgets.byId.w1 = createFloatingWidgetState("w1", {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
      });
    });
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
        <PanelStateContext.Provider value={nineZone.panels.right}>
          <PanelTarget />
        </PanelStateContext.Provider>
      </TestNineZoneProvider>,
    );
    const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
    const handle = titleBar.getElementsByClassName("nz-handle")[0];
    const target = container.getElementsByClassName("nz-widgetPanels-panelTarget")[0];
    sinon.stub(document, "elementFromPoint").returns(target);
    act(() => {
      fireEvent.mouseDown(handle);
      fireEvent.mouseMove(target);
      dispatch.reset();
      fireEvent.mouseUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_DRAG_END",
      floatingWidgetId: "w1",
      target: {
        newWidgetId: "newId",
        side: "right",
        type: "panel",
      },
    })).should.true;
  });

  it("should dispatch FLOATING_WIDGET_BRING_TO_FRONT", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.widgets = [];
      stateDraft.floatingWidgets.byId.w1 = createFloatingWidgetState("w1", {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
      });
    });
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </TestNineZoneProvider>,
    );
    const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
    const handle = titleBar.getElementsByClassName("nz-handle")[0];
    act(() => {
      fireEvent.touchStart(handle, {
        touches: [{}],
      });
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "FLOATING_WIDGET_BRING_TO_FRONT",
      id: "w1",
    })).should.true;
  });
});

describe("useDrag", () => {
  it("should start drag action after timeout", () => {
    const fakeTimers = sinon.useFakeTimers();
    const spy = sinon.stub<Required<Parameters<typeof useDrag>>[0]>();
    const { result } = renderHook(() => useDrag(spy));
    act(() => {
      const instance = document.createElement("div");
      result.current(instance);
      fireEvent.mouseDown(instance);
      fakeTimers.tick(300);
    });
    spy.calledOnce.should.true;
  });

  it("should start drag on pointer move", () => {
    const spy = sinon.stub<Required<Parameters<typeof useDrag>>[0]>();
    const { result } = renderHook(() => useDrag(spy));
    act(() => {
      const instance = document.createElement("div");
      result.current(instance);
      fireEvent.mouseDown(instance);
      fireEvent.mouseMove(document);
    });
    spy.calledOnce.should.true;
  });

  it("should not start drag on subsequent pointer move", () => {
    const spy = sinon.stub<Required<Parameters<typeof useDrag>>[0]>();
    const { result } = renderHook(() => useDrag(spy));
    act(() => {
      const instance = document.createElement("div");
      result.current(instance);
      fireEvent.mouseDown(instance);
      fireEvent.mouseMove(document);
      spy.resetHistory();
      fireEvent.mouseMove(document);
    });
    spy.notCalled.should.true;
  });

  it("should report drag action", () => {
    const spy = sinon.stub<Required<Parameters<typeof useDrag>>[1]>();
    const { result } = renderHook(() => useDrag(undefined, spy));
    act(() => {
      const instance = document.createElement("div");
      result.current(instance);
      fireEvent.mouseDown(instance);
      fireEvent.mouseMove(document);
      fireEvent.mouseMove(document);
    });
    spy.calledOnce.should.true;
  });

  it("should report drag end action", () => {
    const spy = sinon.stub<Required<Parameters<typeof useDrag>>[2]>();
    const { result } = renderHook(() => useDrag(undefined, undefined, spy));
    act(() => {
      const instance = document.createElement("div");
      result.current(instance);
      fireEvent.mouseDown(instance);
      fireEvent.mouseUp(document);
    });
    spy.calledOnce.should.true;
  });
});
