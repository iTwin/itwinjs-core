/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import {
  createHorizontalPanelState, createNineZoneState, createPanelsState, createVerticalPanelState, NineZoneDispatch, WidgetPanelExpander, WidgetPanelExpanders,
} from "../../ui-ninezone";
import { NineZoneProvider } from "../Providers";


describe("WidgetPanelExpanders", () => {
  it("should render", () => {
    const nineZone = createNineZoneState({
      panels: createPanelsState({
        left: createVerticalPanelState("left", {
          pinned: false,
          collapsed: true,
        }),
        bottom: createHorizontalPanelState("bottom", {
          pinned: false,
          collapsed: true,
        }),
      }),
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <WidgetPanelExpanders />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});

describe("WidgetPanelExpander", () => {
  it("should dispatch `PANEL_SET_COLLAPSED`", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    const { container } = render(
      <NineZoneProvider
        dispatch={dispatch}
      >
        <WidgetPanelExpander side="left" />
      </NineZoneProvider>,
    );
    const expander = container.getElementsByClassName("nz-widgetPanels-expander")[0];
    fireEvent.mouseOver(expander);

    sinon.assert.calledOnceWithExactly(dispatch, {
      type: "PANEL_SET_COLLAPSED",
      side: "left",
      collapsed: false,
    });
  });
});
