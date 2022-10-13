/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { render } from "@testing-library/react";
import {
  ActiveTabIdContext, addFloatingWidget, addPanelWidget, addTab, createNineZoneState, FloatingWidgetContext, FloatingWidgetIdContext, PanelSideContext,
  PanelStateContext, TabBarButtons, TabsStateContext, toolSettingsTabId, WidgetIdContext, WidgetStateContext,
} from "../../appui-layout-react";

describe("TabBarButtons", () => {
  it("Floating widget should render Sendback button", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "t1-label" });
    state = addFloatingWidget(state, "fw1", ["t1"]);
    const wrapper = render(
      <PanelStateContext.Provider value={state.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={state.tabs}>
            <WidgetStateContext.Provider value={state.widgets.fw1}>
              <FloatingWidgetIdContext.Provider value="fw1">
                <FloatingWidgetContext.Provider value={state.floatingWidgets.byId.fw1}>
                  <TabBarButtons />
                </FloatingWidgetContext.Provider>
              </FloatingWidgetIdContext.Provider>,
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-sendBack")).to.not.be.null;
  });

  it("Floating widget that canPopout should render Popout button", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "t1-label", canPopout: true });
    state = addFloatingWidget(state, "fw1", ["t1"]);
    const wrapper = render(
      <PanelStateContext.Provider value={state.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={state.tabs}>
            <WidgetStateContext.Provider value={state.widgets.fw1}>
              <FloatingWidgetIdContext.Provider value="fw1">
                <FloatingWidgetContext.Provider value={state.floatingWidgets.byId.fw1}>
                  <ActiveTabIdContext.Provider value="t1">
                    <TabBarButtons />
                  </ActiveTabIdContext.Provider>
                </FloatingWidgetContext.Provider>
              </FloatingWidgetIdContext.Provider>,
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-sendBack")).to.not.be.null;
    expect(wrapper.container.querySelector("button.nz-widget-popoutToggle")).to.not.be.null;
  });

  it("Floating ToolSettings should not render Popout if no active tab set", () => {
    let state = createNineZoneState();
    state = addFloatingWidget(state, "fw1", [toolSettingsTabId]);
    const wrapper = render(
      <PanelStateContext.Provider value={state.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={state.tabs}>
            <WidgetStateContext.Provider value={state.widgets.fw1}>
              <FloatingWidgetIdContext.Provider value="fw1">
                <FloatingWidgetContext.Provider value={state.floatingWidgets.byId.fw1}>
                  <TabBarButtons />
                </FloatingWidgetContext.Provider>
              </FloatingWidgetIdContext.Provider>,
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-dock")).to.be.null;
  });

  it("Floating ToolSettings should render Dock button", () => {
    let state = createNineZoneState();
    state = addFloatingWidget(state, "fw1", [toolSettingsTabId]);
    const wrapper = render(
      <PanelStateContext.Provider value={state.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={state.tabs}>
            <WidgetStateContext.Provider value={state.widgets.fw1}>
              <FloatingWidgetIdContext.Provider value="fw1">
                <FloatingWidgetContext.Provider value={state.floatingWidgets.byId.fw1}>
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
  });

  it("Main Panel widget should not render Pin buttons", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "t1-label", canPopout: false });
    state = addPanelWidget(state, "left", "w1", ["t1"], { activeTabId: "t1" });
    const wrapper = render(
      <PanelStateContext.Provider value={state.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={state.tabs}>
            <WidgetStateContext.Provider value={state.widgets.w1}>
              <WidgetIdContext.Provider value="w1">
                <ActiveTabIdContext.Provider value="t1">
                  <TabBarButtons />
                </ActiveTabIdContext.Provider>
              </WidgetIdContext.Provider>
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-pinToggle")).to.not.be.null;
  });

  it("Main Panel widget that canPopout should render Popout and Pin buttons", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "t1-label", canPopout: true });
    state = addPanelWidget(state, "left", "w1", ["t1"], { activeTabId: "t1" });
    const wrapper = render(
      <PanelStateContext.Provider value={state.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={state.tabs}>
            <WidgetStateContext.Provider value={state.widgets.w1}>
              <WidgetIdContext.Provider value="w1">
                <ActiveTabIdContext.Provider value="t1">
                  <TabBarButtons />
                </ActiveTabIdContext.Provider>
              </WidgetIdContext.Provider>
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-popoutToggle")).to.not.be.null;
    expect(wrapper.container.querySelector("button.nz-widget-pinToggle")).to.not.be.null;
  });

  it("Secondary Panel widget should render Popout buttons", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "t1-label", canPopout: true });
    state = addPanelWidget(state, "left", "w1", ["t1"], { activeTabId: "t1" });
    const wrapper = render(
      <PanelStateContext.Provider value={state.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={state.tabs}>
            <WidgetStateContext.Provider value={state.widgets.w1}>
              <WidgetIdContext.Provider value="main">
                <ActiveTabIdContext.Provider value="t1">
                  <TabBarButtons />
                </ActiveTabIdContext.Provider>
              </WidgetIdContext.Provider>
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-popoutToggle")).to.not.be.null;
  });

  it("should render popout button", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "t1-label", canPopout: true });
    state = addPanelWidget(state, "left", "w1", ["t1"], { activeTabId: "t1" });
    const wrapper = render(
      <PanelStateContext.Provider value={state.panels.left}>
        <PanelSideContext.Provider value="left">
          <TabsStateContext.Provider value={state.tabs}>
            <WidgetStateContext.Provider value={state.widgets.w1}>
              <ActiveTabIdContext.Provider value="t1">
                <TabBarButtons />
              </ActiveTabIdContext.Provider>
            </WidgetStateContext.Provider>
          </TabsStateContext.Provider>
        </PanelSideContext.Provider>
      </PanelStateContext.Provider>
    );
    expect(wrapper.container.querySelector("button.nz-widget-popoutToggle")).to.not.be.null;
  });
});
