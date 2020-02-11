/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, render } from "@testing-library/react";
import {
  WidgetTab, createNineZoneState, addPanelWidget, addTab, NineZoneContext, WidgetPanelContext,
  WidgetIdContext, WidgetTabContext,
} from "../../ui-ninezone";
import { NineZoneDispatchContext, NineZoneDispatch, WIDGET_TAB_CLICK, WIDGET_TAB_DOUBLE_CLICK } from "../../ui-ninezone/base/NineZone";
import { fireDoubleClick, fireClick } from "../base/useSingleDoubleClick.test";

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
      <NineZoneContext.Provider value={nineZone}>
        <WidgetPanelContext.Provider value="left">
          <WidgetIdContext.Provider value="w1">
            <WidgetTabContext.Provider value={{
              isOverflown: false,
            }}>
              <WidgetTab id="t1" />
            </WidgetTabContext.Provider>
          </WidgetIdContext.Provider>
        </WidgetPanelContext.Provider>
      </NineZoneContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render overflown", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1");
    const { container } = render(
      <NineZoneContext.Provider value={nineZone}>
        <WidgetPanelContext.Provider value="left">
          <WidgetIdContext.Provider value="w1">
            <WidgetTabContext.Provider value={{
              isOverflown: true,
            }}>
              <WidgetTab id="t1" />
            </WidgetTabContext.Provider>
          </WidgetIdContext.Provider>
        </WidgetPanelContext.Provider>
      </NineZoneContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render minimized", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { minimized: true });
    nineZone = addTab(nineZone, "w1", "t1");
    const { container } = render(
      <NineZoneContext.Provider value={nineZone}>
        <WidgetPanelContext.Provider value="left">
          <WidgetIdContext.Provider value="w1">
            <WidgetTabContext.Provider value={{
              isOverflown: false,
            }}>
              <WidgetTab id="t1" />
            </WidgetTabContext.Provider>
          </WidgetIdContext.Provider>
        </WidgetPanelContext.Provider>
      </NineZoneContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch WIDGET_TAB_CLICK", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1");
    render(
      <NineZoneDispatchContext.Provider value={dispatch}>
        <NineZoneContext.Provider value={nineZone}>
          <WidgetPanelContext.Provider value="left">
            <WidgetIdContext.Provider value="w1">
              <WidgetTabContext.Provider value={{
                isOverflown: false,
              }}>
                <WidgetTab id="t1" />
              </WidgetTabContext.Provider>
            </WidgetIdContext.Provider>
          </WidgetPanelContext.Provider>
        </NineZoneContext.Provider>
      </NineZoneDispatchContext.Provider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireClick(tab, sandbox.useFakeTimers());
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: WIDGET_TAB_CLICK,
      side: "left",
      widgetId: "w1",
      id: "t1",
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DOUBLE_CLICK", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1");
    render(
      <NineZoneDispatchContext.Provider value={dispatch}>
        <NineZoneContext.Provider value={nineZone}>
          <WidgetPanelContext.Provider value="left">
            <WidgetIdContext.Provider value="w1">
              <WidgetTabContext.Provider value={{
                isOverflown: false,
              }}>
                <WidgetTab id="t1" />
              </WidgetTabContext.Provider>
            </WidgetIdContext.Provider>
          </WidgetPanelContext.Provider>
        </NineZoneContext.Provider>
      </NineZoneDispatchContext.Provider>,
    );
    const tab = document.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireDoubleClick(tab, sandbox.useFakeTimers());
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: WIDGET_TAB_DOUBLE_CLICK,
      side: "left",
      widgetId: "w1",
      id: "t1",
    })).should.true;
  });
});
