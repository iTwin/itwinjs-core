/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { Rectangle } from "@itwin/core-react";
import { act, fireEvent, render } from "@testing-library/react";
import {
  ActiveTabIdContext, addPanelWidget, addTab, createNineZoneState, FloatingWidgetIdContext, NineZoneDispatch, PanelSideContext, ShowWidgetIconContext,
  WidgetContext, WidgetOverflowContext, WidgetStateContext, WidgetTab, WidgetTabProvider, WidgetTabsEntryContext,
} from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";

describe("WidgetTab", () => {
  it("should render active", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { hideWithUiWhenFloating: true });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetStateContext.Provider value={state.widgets.w1}>
          <ActiveTabIdContext.Provider value="t1">
            <WidgetTabsEntryContext.Provider value={{
              lastNotOverflown: false,
            }}>
              <WidgetTabProvider
                tab={state.tabs.t1}
              />
            </WidgetTabsEntryContext.Provider>
          </ActiveTabIdContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render a menu tab", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetStateContext.Provider value={state.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetOverflowContext.Provider value={{ close: sinon.spy() }}>
              <WidgetTabProvider tab={state.tabs.t1} />
            </WidgetOverflowContext.Provider>
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    container.getElementsByClassName("nz-widget-menuTab").length.should.eq(1);
  });

  it("should render minimized", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"], { minimized: true });
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetStateContext.Provider value={state.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTabProvider tab={state.tabs.t1} />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render first inactive", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetStateContext.Provider value={state.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTabProvider tab={state.tabs.t1} firstInactive />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render last not overflown", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetStateContext.Provider value={state.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: true,
          }}>
            <WidgetTabProvider tab={state.tabs.t1} />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render tab with icon only", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { iconSpec: "icon-placeholder" });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <ShowWidgetIconContext.Provider value={true} >
          <WidgetStateContext.Provider value={state.widgets.w1}>
            <WidgetTabsEntryContext.Provider value={{
              lastNotOverflown: true,
            }}>
              <WidgetTabProvider tab={state.tabs.t1} showOnlyTabIcon={true} />
            </WidgetTabsEntryContext.Provider>
          </WidgetStateContext.Provider>
        </ShowWidgetIconContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render tab with text and icon", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { iconSpec: "icon-placeholder" });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <ShowWidgetIconContext.Provider value={true} >
          <WidgetStateContext.Provider value={state.widgets.w1}>
            <WidgetTabsEntryContext.Provider value={{
              lastNotOverflown: true,
            }}>
              <WidgetTabProvider tab={state.tabs.t1} showOnlyTabIcon={false} />
            </WidgetTabsEntryContext.Provider>
          </WidgetStateContext.Provider>
        </ShowWidgetIconContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render badge", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
        tab={<WidgetTab badge="Badge" />}
      >
        <WidgetStateContext.Provider value={state.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTabProvider
              tab={state.tabs.t1}
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
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <PanelSideContext.Provider value="left">
          <WidgetStateContext.Provider value={state.widgets.w1}>
            <WidgetTabsEntryContext.Provider value={{
              lastNotOverflown: false,
            }}>
              <WidgetTabProvider tab={state.tabs.t1} />
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
    sinon.assert.calledOnceWithExactly(dispatch, sinon.match({
      type: "WIDGET_TAB_CLICK",
      side: "left",
      widgetId: "w1",
      id: "t1",
    }));
  });

  it("should dispatch WIDGET_TAB_DOUBLE_CLICK", () => {
    const fakeTimers = sinon.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <PanelSideContext.Provider value="left">
          <WidgetStateContext.Provider value={state.widgets.w1}>
            <WidgetTabsEntryContext.Provider value={{
              lastNotOverflown: false,
            }}>
              <WidgetTabProvider tab={state.tabs.t1} />
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
    sinon.assert.calledOnceWithExactly(dispatch, sinon.match({
      type: "WIDGET_TAB_DOUBLE_CLICK",
      side: "left",
      widgetId: "w1",
      id: "t1",
    }));
  });

  it("should dispatch WIDGET_TAB_DRAG_START on pointer move", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1", { hideWithUiWhenFloating: true });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <WidgetContext.Provider value={{ measure: () => new Rectangle() }}>
          <WidgetStateContext.Provider value={state.widgets.w1}>
            <WidgetTabProvider tab={state.tabs.t1} />
          </WidgetStateContext.Provider>
        </WidgetContext.Provider>
      </TestNineZoneProvider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.mouseDown(tab);
      fireEvent.mouseMove(document, { clientX: 10, clientY: 10 });
    });
    sinon.assert.calledOnceWithExactly(dispatch, sinon.match({
      type: "WIDGET_TAB_DRAG_START",
      widgetId: "w1",
      id: "t1",
    }));
  });

  it("should not dispatch WIDGET_TAB_DRAG_START on pointer move if pointer moved less than 10px", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <WidgetStateContext.Provider value={state.widgets.w1}>
          <WidgetTabProvider tab={state.tabs.t1} />
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.mouseDown(tab);
      fireEvent.mouseMove(document, { clientX: 5, clientY: 0 });
    });
    sinon.assert.notCalled(dispatch);
  });

  it("should dispatch FLOATING_WIDGET_BRING_TO_FRONT", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <FloatingWidgetIdContext.Provider value="fw1">
          <WidgetStateContext.Provider value={state.widgets.w1}>
            <WidgetTabProvider tab={state.tabs.t1} />
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
    sinon.assert.calledOnceWithExactly(dispatch, sinon.match({
      type: "FLOATING_WIDGET_BRING_TO_FRONT",
      id: "fw1",
    }));
  });
});
