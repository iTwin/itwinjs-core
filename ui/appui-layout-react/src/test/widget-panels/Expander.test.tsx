/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import {
  createHorizontalPanelState, createNineZoneState, createPanelsState, createVerticalPanelState, NineZoneDispatch, WidgetPanelExpander, WidgetPanelExpanders,
} from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";

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
      <TestNineZoneProvider
        state={nineZone}
      >
        <WidgetPanelExpanders />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});

describe("WidgetPanelExpander", () => {
  it("should dispatch `PANEL_SET_COLLAPSED`", () => {
    const fakeTimers = sinon.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    const { container } = render(
      <TestNineZoneProvider
        dispatch={dispatch}
      >
        <WidgetPanelExpander side="left" />
      </TestNineZoneProvider>,
    );
    const expander = container.getElementsByClassName("nz-widgetPanels-expander")[0];
    fireEvent.mouseOver(expander);
    fakeTimers.tick(300);

    sinon.assert.calledOnceWithExactly(dispatch, {
      type: "PANEL_SET_COLLAPSED",
      side: "left",
      collapsed: false,
    });
  });

  it("should not dispatch `PANEL_SET_COLLAPSED` if mouse moves out", () => {
    const fakeTimers = sinon.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    const { container } = render(
      <TestNineZoneProvider
        dispatch={dispatch}
      >
        <WidgetPanelExpander side="left" />
      </TestNineZoneProvider>,
    );
    const expander = container.getElementsByClassName("nz-widgetPanels-expander")[0];
    fireEvent.mouseOver(expander);
    fireEvent.mouseOut(expander);
    fakeTimers.tick(300);

    sinon.assert.notCalled(dispatch);
  });

  it("should reset timer if mouse moves", () => {
    const fakeTimers = sinon.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    const { container } = render(
      <TestNineZoneProvider
        dispatch={dispatch}
      >
        <WidgetPanelExpander side="left" />
      </TestNineZoneProvider>,
    );
    const expander = container.getElementsByClassName("nz-widgetPanels-expander")[0];
    fireEvent.mouseOver(expander);
    fakeTimers.tick(150);

    fireEvent.mouseMove(expander, { clientX: 20 });

    fakeTimers.tick(150);
    sinon.assert.notCalled(dispatch);

    fakeTimers.tick(100);
    sinon.assert.calledOnceWithExactly(dispatch, {
      type: "PANEL_SET_COLLAPSED",
      side: "left",
      collapsed: false,
    });
  });

  it("should not reset timer if mouse move threshold is not exceeded", () => {
    const fakeTimers = sinon.useFakeTimers();
    const dispatch = sinon.stub<NineZoneDispatch>();
    const { container } = render(
      <TestNineZoneProvider
        dispatch={dispatch}
      >
        <WidgetPanelExpander side="left" />
      </TestNineZoneProvider>,
    );
    const expander = container.getElementsByClassName("nz-widgetPanels-expander")[0];
    fireEvent.mouseOver(expander);
    fakeTimers.tick(150);

    fireEvent.mouseMove(expander, { clientX: 4 });

    fakeTimers.tick(100);

    sinon.assert.calledOnceWithExactly(dispatch, {
      type: "PANEL_SET_COLLAPSED",
      side: "left",
      collapsed: false,
    });
  });
});
