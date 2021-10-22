/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render } from "@testing-library/react";
import {
  addPanelWidget, addTab, createNineZoneState, FloatingWidgetIdContext, NineZoneDispatch, PanelSideContext, WidgetContext, WidgetOverflowContext, WidgetStateContext,
  WidgetTab, WidgetTabProvider, WidgetTabsEntryContext,
} from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";

describe("WidgetTab", () => {
  it("should render active", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTabProvider
              tab={nineZone.tabs.t1}
            />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render overflown", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTabProvider tab={nineZone.tabs.t1} />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render minimized", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"], { minimized: true });
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTabProvider tab={nineZone.tabs.t1} />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render first inactive", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTabProvider tab={nineZone.tabs.t1} firstInactive />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render last not overflown", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: true,
          }}>
            <WidgetTabProvider tab={nineZone.tabs.t1} />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render badge", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        tab={<WidgetTab badge="Badge" />}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTabProvider
              tab={nineZone.tabs.t1}
            />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch WIDGET_TAB_CLICK", () => {
    const fakeTimers = sinon.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const close = sinon.spy();
    render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <PanelSideContext.Provider value="left">
          <WidgetStateContext.Provider value={nineZone.widgets.w1}>
            <WidgetTabsEntryContext.Provider value={{
              lastNotOverflown: false,
            }}>
              <WidgetOverflowContext.Provider value={{ close }}>
                <WidgetTabProvider tab={nineZone.tabs.t1} />
              </WidgetOverflowContext.Provider>
            </WidgetTabsEntryContext.Provider>
          </WidgetStateContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.mouseDown(tab);
      fireEvent.mouseUp(tab);
      fakeTimers.tick(300);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_TAB_CLICK",
      side: "left",
      widgetId: "w1",
      id: "t1",
    })).should.true;
    close.calledOnceWithExactly().should.true;
  });

  it("should dispatch WIDGET_TAB_DOUBLE_CLICK", () => {
    const fakeTimers = sinon.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const close = sinon.spy();
    render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <PanelSideContext.Provider value="left">
          <WidgetStateContext.Provider value={nineZone.widgets.w1}>
            <WidgetTabsEntryContext.Provider value={{
              lastNotOverflown: false,
            }}>
              <WidgetOverflowContext.Provider value={{ close }}>
                <WidgetTabProvider tab={nineZone.tabs.t1} />
              </WidgetOverflowContext.Provider>
            </WidgetTabsEntryContext.Provider>
          </WidgetStateContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.mouseDown(tab);
      fireEvent.mouseUp(tab);
      fireEvent.mouseDown(tab);
      fireEvent.mouseUp(tab);
      fakeTimers.tick(300);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_TAB_DOUBLE_CLICK",
      side: "left",
      widgetId: "w1",
      id: "t1",
    })).should.true;
    close.calledOnceWithExactly().should.true;
  });

  it("should dispatch WIDGET_TAB_DRAG_START on pointer move", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const close = sinon.spy();
    render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <WidgetContext.Provider value={{ measure: () => ({ height: 0, width: 0 }) }}>
          <WidgetStateContext.Provider value={nineZone.widgets.w1}>
            <WidgetOverflowContext.Provider value={{ close }}>
              <WidgetTabProvider tab={nineZone.tabs.t1} />
            </WidgetOverflowContext.Provider>
          </WidgetStateContext.Provider>
        </WidgetContext.Provider>
      </TestNineZoneProvider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.mouseDown(tab);
      fireEvent.mouseMove(document, { clientX: 10, clientY: 10 });
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_TAB_DRAG_START",
      widgetId: "w1",
      id: "t1",
    })).should.true;
    close.calledOnceWithExactly().should.true;
  });

  it("should not dispatch WIDGET_TAB_DRAG_START on pointer move if pointer moved less than 10px", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabProvider tab={nineZone.tabs.t1} />
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.mouseDown(tab);
      fireEvent.mouseMove(document, { clientX: 5, clientY: 0 });
    });
    dispatch.notCalled.should.true;
  });

  it("should not dispatch WIDGET_TAB_DRAG_START w/o initial pointer position", () => {
    const fakeTimers = sinon.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <WidgetContext.Provider value={{ measure: () => ({ height: 0, width: 0 }) }}>
          <WidgetStateContext.Provider value={nineZone.widgets.w1}>
            <WidgetTabProvider tab={nineZone.tabs.t1} />
          </WidgetStateContext.Provider>
        </WidgetContext.Provider>
      </TestNineZoneProvider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.mouseDown(tab);
      fakeTimers.tick(300);
      dispatch.resetHistory();
      fireEvent.mouseMove(document, { clientX: 20 });
    });
    dispatch.notCalled.should.true;
  });

  it("should dispatch FLOATING_WIDGET_BRING_TO_FRONT", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <FloatingWidgetIdContext.Provider value="fw1">
          <WidgetStateContext.Provider value={nineZone.widgets.w1}>
            <WidgetTabProvider tab={nineZone.tabs.t1} />
          </WidgetStateContext.Provider>
        </FloatingWidgetIdContext.Provider>
      </TestNineZoneProvider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.touchStart(tab, {
        touches: [{}],
      });
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "FLOATING_WIDGET_BRING_TO_FRONT",
      id: "fw1",
    })).should.true;
  });
});
