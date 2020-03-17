/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, render, fireEvent } from "@testing-library/react";
import { CursorTypeContext, createNineZoneState, NineZoneProvider, addPanelWidget, WidgetTarget, PanelSideContext } from "../../ui-ninezone";

describe("WidgetTarget", () => {
  it("should render with cursor type", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <PanelSideContext.Provider value="left">
          <CursorTypeContext.Provider value="grabbing">
            <WidgetTarget
              widgetIndex={0}
            />
          </CursorTypeContext.Provider>
        </PanelSideContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render targeted", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <PanelSideContext.Provider value="left">
          <WidgetTarget
            widgetIndex={0}
          />
        </PanelSideContext.Provider>
      </NineZoneProvider>,
    );
    const target = container.getElementsByClassName("nz-widget-widgetTarget")[0];
    act(() => {
      fireEvent.pointerMove(target);
    });
    container.firstChild!.should.matchSnapshot();
  });
});
