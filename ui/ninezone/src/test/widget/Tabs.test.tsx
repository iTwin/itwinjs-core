/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render } from "@testing-library/react";
import * as React from "react";
import * as sinon from "sinon";
import {
  addPanelWidget, addTab, createNineZoneState, PanelSideContext, WidgetIdContext, WidgetStateContext, WidgetTabs,
} from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";

describe("WidgetTabs", () => {
  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <PanelSideContext.Provider value="left">
          <WidgetIdContext.Provider value="w1">
            <WidgetStateContext.Provider value={nineZone.widgets.w1}>
              <WidgetTabs />
            </WidgetStateContext.Provider>
          </WidgetIdContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render overflow panel", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1", "t2", "t3"]);
    nineZone = addTab(nineZone, "t1");
    nineZone = addTab(nineZone, "t2");
    nineZone = addTab(nineZone, "t3");
    sinon.stub(Element.prototype, "getBoundingClientRect").returns(DOMRect.fromRect({ width: 100 }));
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <PanelSideContext.Provider value="left">
          <WidgetIdContext.Provider value="w1">
            <WidgetStateContext.Provider value={nineZone.widgets.w1}>
              <WidgetTabs />
            </WidgetStateContext.Provider>
          </WidgetIdContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should overflow all tabs in horizontal minimized widget", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", ["t1"], { minimized: true });
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <PanelSideContext.Provider value="top">
          <WidgetIdContext.Provider value="w1">
            <WidgetStateContext.Provider value={nineZone.widgets.w1}>
              <WidgetTabs />
            </WidgetStateContext.Provider>
          </WidgetIdContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
