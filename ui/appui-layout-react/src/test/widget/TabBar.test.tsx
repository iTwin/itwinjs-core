/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import {
  addFloatingWidget, addPanelWidget, addTab, createNineZoneState, FloatingWidgetProvider, NineZoneDispatch, PanelStateContext,
  PanelTarget, useDrag, WidgetIdContext, WidgetTabTarget,
} from "../../appui-layout-react";
import * as NineZoneModule from "../../appui-layout-react/base/NineZone";
import { TestNineZoneProvider } from "../Providers";
import { addTabs } from "../Utils";

describe("WidgetTitleBar", () => {
  it("should dispatch WIDGET_DRAG_END", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addFloatingWidget(state, "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <FloatingWidgetProvider
          floatingWidget={state.floatingWidgets.byId.w1}
          widget={state.widgets.w1}
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
    sinon.assert.calledOnceWithExactly(dispatch, sinon.match({
      type: "WIDGET_DRAG_END",
      floatingWidgetId: "w1",
      target: {
        type: "window",
      },
    }));
  });

  it("should dispatch FLOATING_WIDGET_CLEAR_USER_SIZED", () => {
    const fakeTimers = sinon.useFakeTimers();

    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addFloatingWidget(state, "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <FloatingWidgetProvider
          floatingWidget={state.floatingWidgets.byId.w1}
          widget={state.widgets.w1}
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
    sinon.assert.calledOnceWithExactly(dispatch, {
      type: "FLOATING_WIDGET_CLEAR_USER_SIZED",
      id: "w1",
    });
  });

  it("should dispatch WIDGET_DRAG_END with tab target", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addFloatingWidget(state, "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <WidgetIdContext.Provider value="w2">
          <WidgetTabTarget tabIndex={0} first />
        </WidgetIdContext.Provider>
        <FloatingWidgetProvider
          floatingWidget={state.floatingWidgets.byId.w1}
          widget={state.widgets.w1}
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
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addFloatingWidget(state, "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <FloatingWidgetProvider
          floatingWidget={state.floatingWidgets.byId.w1}
          widget={state.widgets.w1}
        />
        <PanelStateContext.Provider value={state.panels.right}>
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
    sinon.assert.calledOnceWithExactly(dispatch, {
      type: "WIDGET_DRAG_END",
      floatingWidgetId: "w1",
      target: {
        newWidgetId: "newId",
        side: "right",
        type: "panel",
      },
    });
  });

  it("should dispatch FLOATING_WIDGET_BRING_TO_FRONT", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addFloatingWidget(state, "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <FloatingWidgetProvider
          floatingWidget={state.floatingWidgets.byId.w1}
          widget={state.widgets.w1}
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
    sinon.assert.calledWithExactly(dispatch, {
      type: "FLOATING_WIDGET_BRING_TO_FRONT",
      id: "w1",
    });
  });
});

describe("useDrag", () => {
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
