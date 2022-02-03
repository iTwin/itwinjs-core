/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import type { NineZoneDispatch} from "../../appui-layout-react";
import { createNineZoneState, createPanelsState, createVerticalPanelState, PanelStateContext, PinToggle } from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";

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
    const nineZone = createNineZoneState({
      panels: createPanelsState({
        left: createVerticalPanelState("left", {
          pinned: false,
        }),
      }),
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
    const icon = toggle.firstElementChild!;
    Array.from(icon.classList.values()).should.contain("icon-chevron-down");
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
