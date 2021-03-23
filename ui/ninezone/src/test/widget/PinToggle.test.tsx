/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import tlr from "@testing-library/react"; const { fireEvent, render } = tlr;
import { createNineZoneState, createPanelsState, createVerticalPanelState, NineZoneDispatch, PanelStateContext, PinToggle } from "../../ui-ninezone.js";
import { NineZoneProvider } from "../Providers.js";

describe("PinToggle", () => {
  it("should render", () => {
    const nineZone = createNineZoneState();
    const { container } = render(
      <NineZoneProvider>
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <PinToggle />
        </PanelStateContext.Provider>
      </NineZoneProvider>
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with `pin panel` title", () => {
    const nineZone = createNineZoneState({
      panels: createPanelsState({
        left: createVerticalPanelState("left", {
          pinned: false,
        }),
      }),
    });
    const { container } = render(
      <NineZoneProvider
        labels={{
          pinPanelTitle: "Pin panel",
        }}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <PinToggle />
        </PanelStateContext.Provider>
      </NineZoneProvider>
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render `icon-chevron-down` for bottom pinned panel", () => {
    const nineZone = createNineZoneState();
    const { container } = render(
      <NineZoneProvider>
        <PanelStateContext.Provider value={nineZone.panels.bottom}>
          <PinToggle />
        </PanelStateContext.Provider>
      </NineZoneProvider>
    );
    const toggle = container.getElementsByClassName("nz-widget-pinToggle")[0];
    const icon = toggle.firstElementChild!;
    Array.from(icon.classList.values()).should.contain("icon-chevron-down");
  });

  it("should dispatch PANEL_TOGGLE_PINNED", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    const nineZone = createNineZoneState();
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <PinToggle />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const button = container.getElementsByClassName("nz-widget-pinToggle")[0];
    fireEvent.click(button);

    sinon.assert.calledOnceWithExactly(dispatch, {
      type: "PANEL_TOGGLE_PINNED",
      side: "left",
    });
  });
});
