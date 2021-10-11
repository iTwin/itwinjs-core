/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { ActiveTabIdContext, createNineZoneState, NineZoneDispatch, PanelStateContext, PopoutToggle } from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";

describe("PopoutToggle", () => {
  it("should render", () => {
    const nineZone = createNineZoneState();
    const { container } = render(
      <TestNineZoneProvider>
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <ActiveTabIdContext.Provider value={"t1"}>
            <PopoutToggle />
          </ActiveTabIdContext.Provider>
        </PanelStateContext.Provider>
      </TestNineZoneProvider>
    );
    container.firstChild!.should.matchSnapshot();
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
          <ActiveTabIdContext.Provider value={"t1"}>
            <PopoutToggle />
          </ActiveTabIdContext.Provider>
        </PanelStateContext.Provider>
      </TestNineZoneProvider>,
    );
    const button = container.getElementsByClassName("nz-widget-popoutToggle")[0];
    fireEvent.click(button);

    sinon.assert.calledOnceWithExactly(dispatch, {
      type: "WIDGET_TAB_POPOUT",
      id: "t1",
    });
  });
});
