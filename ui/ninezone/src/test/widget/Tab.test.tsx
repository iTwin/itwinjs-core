/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, render, fireEvent } from "@testing-library/react";
import {
  WidgetTab, createNineZoneState, addPanelWidget, addTab, NineZoneProvider, WidgetStateContext, NineZoneDispatch, WIDGET_TAB_CLICK, WIDGET_TAB_DOUBLE_CLICK, WIDGET_TAB_DRAG_START,
} from "../../ui-ninezone";
import { PanelSideContext } from "../../ui-ninezone/widget-panels/Panel";
import { WidgetTabsEntryContext } from "../../ui-ninezone/widget/Tabs";

describe("WidgetTab", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render active", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
    nineZone = addTab(nineZone, "w1", "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTab tab={nineZone.tabs.t1} />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render overflown", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTab tab={nineZone.tabs.t1} />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render minimized", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { minimized: true });
    nineZone = addTab(nineZone, "w1", "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTab tab={nineZone.tabs.t1} />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render first inactive", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
    nineZone = addTab(nineZone, "w1", "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: false,
          }}>
            <WidgetTab tab={nineZone.tabs.t1} firstInactive />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render last not overflown", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
    nineZone = addTab(nineZone, "w1", "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTabsEntryContext.Provider value={{
            lastNotOverflown: true,
          }}>
            <WidgetTab tab={nineZone.tabs.t1} />
          </WidgetTabsEntryContext.Provider>
        </WidgetStateContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch WIDGET_TAB_CLICK", () => {
    const fakeTimers = sandbox.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1");
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <PanelSideContext.Provider value="left">
          <WidgetStateContext.Provider value={nineZone.widgets.w1}>
            <WidgetTabsEntryContext.Provider value={{
              lastNotOverflown: false,
            }}>
              <WidgetTab tab={nineZone.tabs.t1} />
            </WidgetTabsEntryContext.Provider>
          </WidgetStateContext.Provider>
        </PanelSideContext.Provider>
      </NineZoneProvider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.pointerDown(tab);
      fireEvent.pointerUp(tab);
      fakeTimers.tick(300);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: WIDGET_TAB_CLICK,
      side: "left",
      widgetId: "w1",
      id: "t1",
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DOUBLE_CLICK", () => {
    const fakeTimers = sandbox.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1");
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <PanelSideContext.Provider value="left">
          <WidgetStateContext.Provider value={nineZone.widgets.w1}>
            <WidgetTabsEntryContext.Provider value={{
              lastNotOverflown: false,
            }}>
              <WidgetTab tab={nineZone.tabs.t1} />
            </WidgetTabsEntryContext.Provider>
          </WidgetStateContext.Provider>
        </PanelSideContext.Provider>
      </NineZoneProvider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.pointerDown(tab);
      fireEvent.pointerUp(tab);
      fireEvent.pointerDown(tab);
      fireEvent.pointerUp(tab);
      fakeTimers.tick(300);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: WIDGET_TAB_DOUBLE_CLICK,
      side: "left",
      widgetId: "w1",
      id: "t1",
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DRAG_START on pointer move", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1");
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetTab tab={nineZone.tabs.t1} />
        </WidgetStateContext.Provider>
      </NineZoneProvider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.pointerDown(tab);
      fireEvent.pointerMove(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: WIDGET_TAB_DRAG_START,
      widgetId: "w1",
      id: "t1",
    })).should.true;
  });
});
