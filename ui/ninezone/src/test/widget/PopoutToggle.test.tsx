/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { ActiveTabIdContext, createNineZoneState, NineZoneDispatch, PanelStateContext, PopoutToggle } from "../../ui-ninezone";
import { NineZoneProvider } from "../Providers";

describe("PopoutToggle", () => {
  it("should render", () => {
    const nineZone = createNineZoneState();
    const { container } = render(
      <NineZoneProvider>
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <ActiveTabIdContext.Provider value={"t1"}>
            <PopoutToggle />
          </ActiveTabIdContext.Provider>
        </PanelStateContext.Provider>
      </NineZoneProvider>
    );
    container.firstChild!.should.matchSnapshot();
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
          <ActiveTabIdContext.Provider value={"t1"}>
            <PopoutToggle />
          </ActiveTabIdContext.Provider>
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const button = container.getElementsByClassName("nz-widget-popoutToggle")[0];
    fireEvent.click(button);

    sinon.assert.calledOnceWithExactly(dispatch, {
      type: "WIDGET_TAB_POPOUT",
      id: "t1",
    });
  });
});
