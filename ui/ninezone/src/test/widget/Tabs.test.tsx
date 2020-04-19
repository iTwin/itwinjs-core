/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import produce from "immer";
import { render } from "@testing-library/react";
import { WidgetTabs, PanelSideContext, WidgetIdContext, createNineZoneState, addPanelWidget, addTab, NineZoneProvider, WidgetStateContext } from "../../ui-ninezone";
import { createDOMRect } from "../Utils";

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
        dispatch={sinon.spy()}
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
        dispatch={sinon.spy()}
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
        dispatch={sinon.spy()}
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
        dispatch={sinon.spy()}
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
