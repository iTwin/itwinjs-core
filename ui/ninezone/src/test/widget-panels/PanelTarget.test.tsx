/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, render, fireEvent } from "@testing-library/react";
import { PanelSideContext, PanelTarget } from "../../ui-ninezone";
import { NineZoneProvider, CursorTypeContext } from "../../ui-ninezone/base/NineZone";
import { createNineZoneState } from "../../ui-ninezone/base/NineZoneState";

describe("PanelTarget", () => {
  it("should render targeted", () => {
    const { container } = render(
      <NineZoneProvider
        state={createNineZoneState()}
        dispatch={sinon.spy()}
      >
        <PanelSideContext.Provider value="left">
          <PanelTarget />
        </PanelSideContext.Provider>
      </NineZoneProvider>,
    );
    const target = container.getElementsByClassName("nz-widgetPanels-panelTarget")[0];
    act(() => {
      fireEvent.pointerMove(target);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should render cursor type", () => {
    const { container } = render(
      <NineZoneProvider
        state={createNineZoneState()}
        dispatch={sinon.spy()}
      >
        <PanelSideContext.Provider value="left">
          <CursorTypeContext.Provider value="grabbing">
            <PanelTarget />
          </CursorTypeContext.Provider>
        </PanelSideContext.Provider>
      </NineZoneProvider>,
    );
    const target = container.getElementsByClassName("nz-widgetPanels-panelTarget")[0];
    act(() => {
      fireEvent.pointerMove(target);
    });
    container.firstChild!.should.matchSnapshot();
  });
});
