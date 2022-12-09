/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render } from "@testing-library/react";
import * as React from "react";
import * as sinon from "sinon";
import {
  addPanelWidget, addTab, createNineZoneState, PanelSideContext, ShowWidgetIconContext, WidgetIdContext, WidgetStateContext, WidgetTabs,
} from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";
import { addTabs } from "../Utils";

describe("WidgetTabs", () => {
  it("should render", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <PanelSideContext.Provider value="left">
          <WidgetIdContext.Provider value="w1">
            <WidgetStateContext.Provider value={state.widgets.w1}>
              <WidgetTabs />
            </WidgetStateContext.Provider>
          </WidgetIdContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render overflow panel", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2", "t3"]);
    state = addPanelWidget(state, "left", "w1", ["t1", "t2", "t3"]);
    sinon.stub(Element.prototype, "getBoundingClientRect").returns(DOMRect.fromRect({ width: 100 }));
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <PanelSideContext.Provider value="left">
          <WidgetIdContext.Provider value="w1">
            <WidgetStateContext.Provider value={state.widgets.w1}>
              <WidgetTabs />
            </WidgetStateContext.Provider>
          </WidgetIdContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render tabs with icons", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2", "t3"]);
    state = addPanelWidget(state, "left", "w1", ["t1", "t2", "t3"]);
    sinon.stub(Element.prototype, "getBoundingClientRect").returns(DOMRect.fromRect({ width: 300 }));
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <ShowWidgetIconContext.Provider value={true}>
          <PanelSideContext.Provider value="left">
            <WidgetIdContext.Provider value="w1">
              <WidgetStateContext.Provider value={state.widgets.w1}>
                <WidgetTabs />
              </WidgetStateContext.Provider>
            </WidgetIdContext.Provider>
          </PanelSideContext.Provider>
        </ShowWidgetIconContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should overflow all tabs in horizontal minimized widget", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "top", "w1", ["t1"], { minimized: true });
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <PanelSideContext.Provider value="top">
          <WidgetIdContext.Provider value="w1">
            <WidgetStateContext.Provider value={state.widgets.w1}>
              <WidgetTabs />
            </WidgetStateContext.Provider>
          </WidgetIdContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
