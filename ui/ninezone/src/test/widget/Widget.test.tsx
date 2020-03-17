/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, render, fireEvent } from "@testing-library/react";
import { createNineZoneState, NineZoneProvider, addPanelWidget, NineZoneDispatch, PanelWidget, PANEL_WIDGET_DRAG_START, PanelSideContext } from "../../ui-ninezone";
import * as NineZoneModule from "../../ui-ninezone/base/NineZone";

describe("PanelWidget", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should dispatch PANEL_WIDGET_DRAG_START", () => {
    sandbox.stub(NineZoneModule, "getUniqueId").returns("newId");
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <PanelSideContext.Provider value="left">
          <PanelWidget widgetId="w1" />
        </PanelSideContext.Provider>
      </NineZoneProvider>,
    );

    const titleBar = container.getElementsByClassName("nz-widget-titleBar")[0];
    const handle = titleBar.getElementsByClassName("nz-handle")[0];
    act(() => {
      fireEvent.pointerDown(handle);
      fireEvent.pointerMove(handle);
    });

    dispatch.calledOnceWithExactly(sinon.match({
      type: PANEL_WIDGET_DRAG_START,
      id: "w1",
      newFloatingWidgetId: "newId",
    })).should.true;
  });
});
