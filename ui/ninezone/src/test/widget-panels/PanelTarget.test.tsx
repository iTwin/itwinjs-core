/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, render, fireEvent } from "@testing-library/react";
import { PanelTarget } from "../../ui-ninezone";
import { NineZoneProvider, CursorTypeContext } from "../../ui-ninezone/base/NineZone";
import { createNineZoneState } from "../../ui-ninezone/base/NineZoneState";
import { PanelStateContext } from "../../ui-ninezone/widget-panels/Panel";

describe("PanelTarget", () => {
  it("should render targeted", () => {
    const nineZone = createNineZoneState();
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <PanelTarget />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const target = container.getElementsByClassName("nz-widgetPanels-panelTarget")[0];
    act(() => {
      fireEvent.pointerMove(target);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should render cursor type", () => {
    const nineZone = createNineZoneState();
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <CursorTypeContext.Provider value="grabbing">
            <PanelTarget />
          </CursorTypeContext.Provider>
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const target = container.getElementsByClassName("nz-widgetPanels-panelTarget")[0];
    act(() => {
      fireEvent.pointerMove(target);
    });
    container.firstChild!.should.matchSnapshot();
  });
});
