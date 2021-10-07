/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { act, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import * as sinon from "sinon";
import {
  addPanelWidget, addTab, createNineZoneState, FloatingWidgetIdContext, NineZoneDispatch, PanelSideContext,
  PanelStateContext, PanelWidget, PanelWidgetDragStartAction, Widget, WidgetIdContext, WidgetStateContext,
} from "../../appui-layout-react";
import * as NineZoneModule from "../../appui-layout-react/base/NineZone";
import { TestNineZoneProvider } from "../Providers";
import { defaultProps } from "./PanelWidget.test";

describe("PanelWidget", () => {
  describe("PANEL_WIDGET_DRAG_START", () => {
    it("should dispatch", () => {
      sinon.stub(NineZoneModule, "getUniqueId").returns("newId");
      const dispatch = sinon.stub<NineZoneDispatch>();
      let nineZone = createNineZoneState();
      nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
      nineZone = addTab(nineZone, "t1");
      const { container } = render(
        <TestNineZoneProvider
          state={nineZone}
          dispatch={dispatch}
        >
          <PanelStateContext.Provider value={nineZone.panels.left}>
            <PanelSideContext.Provider value="left">
              <PanelWidget widgetId="w1" {...defaultProps} />
            </PanelSideContext.Provider>
          </PanelStateContext.Provider>
        </TestNineZoneProvider>,
      );

      const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
      const handle = titleBar.getElementsByClassName("nz-handle")[0];
      act(() => {
        fireEvent.mouseDown(handle);
        fireEvent.mouseMove(handle);
      });

      dispatch.calledOnceWithExactly(sinon.match({
        type: "PANEL_WIDGET_DRAG_START",
        id: "w1",
        newFloatingWidgetId: "newId",
      })).should.true;
    });

    it("should adjust bounds to keep widget under pointer", () => {
      const dispatch = sinon.stub<NineZoneDispatch>();
      let nineZone = createNineZoneState();
      nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
      nineZone = addTab(nineZone, "t1");
      const { container } = render(
        <TestNineZoneProvider
          state={nineZone}
          dispatch={dispatch}
        >
          <PanelStateContext.Provider value={nineZone.panels.left}>
            <PanelSideContext.Provider value="left">
              <PanelWidget widgetId="w1" {...defaultProps} />
            </PanelSideContext.Provider>
          </PanelStateContext.Provider>
        </TestNineZoneProvider>,
      );

      const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
      const handle = titleBar.getElementsByClassName("nz-handle")[0];
      act(() => {
        fireEvent.mouseDown(handle, { clientX: 230 });
        fireEvent.mouseMove(handle);
      });

      dispatch.calledOnce.should.true;
      dispatch.firstCall.args[0].type.should.eq("PANEL_WIDGET_DRAG_START");
      const action = dispatch.firstCall.args[0] as PanelWidgetDragStartAction;
      action.bounds.should.eql({
        top: 0,
        bottom: 200,
        left: 50,
        right: 250,
      });
    });

    it("should use preferredFloatingWidgetSize of active tab", () => {
      const dispatch = sinon.stub<NineZoneDispatch>();
      let nineZone = createNineZoneState();
      nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
      nineZone = addTab(nineZone, "t1", {
        preferredFloatingWidgetSize: {
          height: 400,
          width: 500,
        },
      });
      const { container } = render(
        <TestNineZoneProvider
          state={nineZone}
          dispatch={dispatch}
        >
          <PanelStateContext.Provider value={nineZone.panels.left}>
            <PanelSideContext.Provider value="left">
              <PanelWidget widgetId="w1" {...defaultProps} />
            </PanelSideContext.Provider>
          </PanelStateContext.Provider>
        </TestNineZoneProvider>,
      );

      const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
      const handle = titleBar.getElementsByClassName("nz-handle")[0];
      act(() => {
        fireEvent.mouseDown(handle);
        fireEvent.mouseMove(handle);
      });

      const action = dispatch.firstCall.args[0] as PanelWidgetDragStartAction;
      action.bounds.should.eql({
        top: 0,
        bottom: 400,
        left: 0,
        right: 500,
      });
    });
  });

  it("should measure widget bounds", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <PanelSideContext.Provider value="left">
            <PanelWidget widgetId="w1" {...defaultProps} />
          </PanelSideContext.Provider>
        </PanelStateContext.Provider>
      </TestNineZoneProvider>,
    );

    const widget = container.getElementsByClassName("nz-widget-panelWidget")[0];
    const spy = sinon.spy(widget, "getBoundingClientRect");

    const tab = container.getElementsByClassName("nz-widget-tab")[0];
    act(() => {
      fireEvent.mouseDown(tab);
      fireEvent.mouseMove(document, { clientX: 10, clientY: 10 });
    });

    spy.calledOnce.should.true;
  });

  it("should dispatch FLOATING_WIDGET_BRING_TO_FRONT", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.w1}>
          <WidgetIdContext.Provider value="w1">
            <FloatingWidgetIdContext.Provider value="fw1">
              <Widget />
            </FloatingWidgetIdContext.Provider>
          </WidgetIdContext.Provider>
        </WidgetStateContext.Provider>
      </TestNineZoneProvider>,
    );

    const widgetElement = container.getElementsByClassName("nz-widget-widget")[0];
    fireEvent.click(widgetElement);

    dispatch.calledOnceWithExactly({
      type: "FLOATING_WIDGET_BRING_TO_FRONT",
      id: "fw1",
    }).should.true;
  });
});
