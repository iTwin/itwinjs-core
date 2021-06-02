/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { render } from "@testing-library/react";
import { ActiveTabIdContext, addPanelWidget, addTab, createFloatingWidgetState, createNineZoneState, FloatingWidgetContext, FloatingWidgetIdContext, PanelSideContext, PanelStateContext, TabBarButtons, TabsStateContext, WidgetIdContext, WidgetStateContext } from "../../ui-ninezone";
import { addFloatingWidget, toolSettingsTabId } from "../../ui-ninezone/base/NineZoneState";

describe("TabBarButtons", () => {
  it("Floating widget should render Sendback button", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "fw1", ["t1"]);
    nineZone = addTab(nineZone, "t1", { label: "t1-label" });
    const wrapper = render(
      <PanelStateContext.Provider value={nineZone.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={nineZone.tabs}>
            <WidgetStateContext.Provider value={nineZone.widgets.fw1}>
              <FloatingWidgetIdContext.Provider value="fw1">
                <FloatingWidgetContext.Provider value={createFloatingWidgetState("fw1")}>
                  <TabBarButtons />
                </FloatingWidgetContext.Provider>
              </FloatingWidgetIdContext.Provider>,
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-sendBack")).to.not.be.null;
    wrapper.unmount();
  });

  it("Floating widget that canPopout should render Popout button", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "fw1", ["t1"]);
    nineZone = addTab(nineZone, "t1", { label: "t1-label", canPopout: true });
    const wrapper = render(
      <PanelStateContext.Provider value={nineZone.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={nineZone.tabs}>
            <WidgetStateContext.Provider value={nineZone.widgets.fw1}>
              <FloatingWidgetIdContext.Provider value="fw1">
                <FloatingWidgetContext.Provider value={createFloatingWidgetState("fw1")}>
                  <TabBarButtons />
                </FloatingWidgetContext.Provider>
              </FloatingWidgetIdContext.Provider>,
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-sendBack")).to.not.be.null;
    expect(wrapper.container.querySelector("button.nz-widget-popoutToggle")).to.not.be.null;

    wrapper.unmount();
  });

  it("Floating ToolSettings should not render Popout if no active tab set", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "tsw", [toolSettingsTabId]);
    nineZone = addTab(nineZone, toolSettingsTabId, { label: "tool-label" });
    const wrapper = render(
      <PanelStateContext.Provider value={nineZone.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={nineZone.tabs}>
            <WidgetStateContext.Provider value={nineZone.widgets.tsw}>
              <FloatingWidgetIdContext.Provider value="tsw">
                <FloatingWidgetContext.Provider value={createFloatingWidgetState("tsw")}>
                  <TabBarButtons />
                </FloatingWidgetContext.Provider>
              </FloatingWidgetIdContext.Provider>,
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-dock")).to.be.null;
    wrapper.unmount();
  });

  it("Floating ToolSettings should render Dock button", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "tsw", [toolSettingsTabId]);
    nineZone = addTab(nineZone, toolSettingsTabId, { label: "tool-label" });
    const wrapper = render(
      <PanelStateContext.Provider value={nineZone.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={nineZone.tabs}>
            <WidgetStateContext.Provider value={nineZone.widgets.tsw}>
              <FloatingWidgetIdContext.Provider value="tsw">
                <FloatingWidgetContext.Provider value={createFloatingWidgetState("tsw")}>
                  <ActiveTabIdContext.Provider value={toolSettingsTabId}>
                    <TabBarButtons />
                  </ActiveTabIdContext.Provider>
                </FloatingWidgetContext.Provider>
              </FloatingWidgetIdContext.Provider>,
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-dock")).to.not.be.null;
    wrapper.unmount();
  });

  it("Main Panel widget should not render Pin buttons", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"], { activeTabId: "t1" });
    nineZone = addTab(nineZone, "t1", { label: "t1-label", canPopout: false });
    const wrapper = render(
      <PanelStateContext.Provider value={nineZone.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={nineZone.tabs}>
            <WidgetStateContext.Provider value={nineZone.widgets.w1}>
              <WidgetIdContext.Provider value="w1">
                <TabBarButtons />
              </WidgetIdContext.Provider>
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-pinToggle")).to.not.be.null;
    wrapper.unmount();
  });

  it("Main Panel widget that canPopout should render Popout and Pin buttons", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"], { activeTabId: "t1" });
    nineZone = addTab(nineZone, "t1", { label: "t1-label", canPopout: true });
    const wrapper = render(
      <PanelStateContext.Provider value={nineZone.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={nineZone.tabs}>
            <WidgetStateContext.Provider value={nineZone.widgets.w1}>
              <WidgetIdContext.Provider value="w1">
                <TabBarButtons />
              </WidgetIdContext.Provider>
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-popoutToggle")).to.not.be.null;
    expect(wrapper.container.querySelector("button.nz-widget-pinToggle")).to.not.be.null;
    wrapper.unmount();
  });

  it("Secondary Panel widget should render Popout buttons", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"], { activeTabId: "t1" });
    nineZone = addTab(nineZone, "t1", { label: "t1-label", canPopout: true });
    const wrapper = render(
      <PanelStateContext.Provider value={nineZone.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={nineZone.tabs}>
            <WidgetStateContext.Provider value={nineZone.widgets.w1}>
              <WidgetIdContext.Provider value="main">
                <TabBarButtons />
              </WidgetIdContext.Provider>
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-popoutToggle")).to.not.be.null;
    wrapper.unmount();
  });

  it("Floating ToolSettings should render Dock button", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"], { activeTabId: "t1" });
    nineZone = addTab(nineZone, "t1", { label: "t1-label", canPopout: true });
    const wrapper = render(
      <PanelStateContext.Provider value={nineZone.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={nineZone.tabs}>
            <WidgetStateContext.Provider value={nineZone.widgets.w1}>
              <TabBarButtons />
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-popoutToggle")).to.not.be.null;
    wrapper.unmount();
  });
});
