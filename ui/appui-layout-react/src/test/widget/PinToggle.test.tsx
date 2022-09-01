/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { createNineZoneState, NineZoneDispatch, PanelStateContext, PinToggle } from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";
import { updatePanelState } from "../../appui-layout-react/state/internal/PanelStateHelpers";

describe("PinToggle", () => {
  it("should render", () => {
    const nineZone = createNineZoneState();
    const { container } = render(
      <TestNineZoneProvider>
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <PinToggle />
        </PanelStateContext.Provider>
      </TestNineZoneProvider>
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render with `pin panel` title", () => {
    let nineZone = createNineZoneState();
    nineZone = updatePanelState(nineZone, "left", {
      pinned: false,
    });
    const { container } = render(
      <TestNineZoneProvider
        labels={{
          pinPanelTitle: "Pin panel",
        }}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <PinToggle />
        </PanelStateContext.Provider>
      </TestNineZoneProvider>
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render `icon-chevron-down` for bottom pinned panel", () => {
    const nineZone = createNineZoneState();
    const { container } = render(
      <TestNineZoneProvider>
        <PanelStateContext.Provider value={nineZone.panels.bottom}>
          <PinToggle />
        </PanelStateContext.Provider>
      </TestNineZoneProvider>
    );
    const toggle = container.getElementsByClassName("nz-widget-pinToggle")[0];
    Array.from(toggle.classList.values()).should.contain("nz-is-pinned");
  });

  it("should dispatch PANEL_TOGGLE_PINNED", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    const nineZone = createNineZoneState();
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <PinToggle />
        </PanelStateContext.Provider>
      </TestNineZoneProvider>,
    );
    const button = container.getElementsByClassName("nz-widget-pinToggle")[0];
    fireEvent.click(button);

    sinon.assert.calledOnceWithExactly(dispatch, {
      type: "PANEL_TOGGLE_PINNED",
      side: "left",
    });
  });
});
