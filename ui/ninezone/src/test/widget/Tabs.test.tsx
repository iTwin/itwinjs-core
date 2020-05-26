/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import produce from "immer";
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import {
  addPanelWidget, addTab, createNineZoneState, PanelSideContext, WidgetIdContext, WidgetStateContext, WidgetTabs,
} from "../../ui-ninezone";
import { createDOMRect } from "../Utils";
import { NineZoneProvider } from "../Providers";

describe("WidgetTabs", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1");
    nineZone = produce(nineZone, (draft) => {
      draft.widgets.w1.activeTabId = undefined;
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <PanelSideContext.Provider value="left">
          <WidgetIdContext.Provider value="w1">
            <WidgetStateContext.Provider value={nineZone.widgets.w1}>
              <WidgetTabs />
            </WidgetStateContext.Provider>
          </WidgetIdContext.Provider>
        </PanelSideContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with active tab", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
    nineZone = addTab(nineZone, "w1", "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <PanelSideContext.Provider value="left">
          <WidgetIdContext.Provider value="w1">
            <WidgetStateContext.Provider value={nineZone.widgets.w1}>
              <WidgetTabs />
            </WidgetStateContext.Provider>
          </WidgetIdContext.Provider>
        </PanelSideContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render overflow panel", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1");
    nineZone = addTab(nineZone, "w1", "t2");
    nineZone = addTab(nineZone, "w1", "t3");
    sandbox.stub(Element.prototype, "getBoundingClientRect").returns(createDOMRect({ width: 100 }));
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <PanelSideContext.Provider value="left">
          <WidgetIdContext.Provider value="w1">
            <WidgetStateContext.Provider value={nineZone.widgets.w1}>
              <WidgetTabs />
            </WidgetStateContext.Provider>
          </WidgetIdContext.Provider>
        </PanelSideContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should overflow all tabs in horizontal minimized widget", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "top", "w1", { minimized: true });
    nineZone = addTab(nineZone, "w1", "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <PanelSideContext.Provider value="top">
          <WidgetIdContext.Provider value="w1">
            <WidgetStateContext.Provider value={nineZone.widgets.w1}>
              <WidgetTabs />
            </WidgetStateContext.Provider>
          </WidgetIdContext.Provider>
        </PanelSideContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
