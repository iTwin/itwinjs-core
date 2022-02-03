/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render } from "@testing-library/react";
import type { NineZoneDispatch } from "../../appui-layout-react";
import { addFloatingWidget, addTab, createNineZoneState, FloatingWidget, getResizeBy } from "../../appui-layout-react";
import { TestNineZoneProvider } from "../Providers";

describe("FloatingWidget", () => {
  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render minimized", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", ["t1"], undefined, { minimized: true });
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render dragged", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", ["t1"], undefined, { minimized: true });
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </TestNineZoneProvider>,
    );
    const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
    const handle = titleBar.getElementsByClassName("nz-handle")[0];
    act(() => {
      fireEvent.mouseDown(handle);
      fireEvent.mouseMove(handle);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch FLOATING_WIDGET_RESIZE", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", ["t1"], undefined, { minimized: true, isFloatingStateWindowResizable: true });
    nineZone = addTab(nineZone, "t1");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </TestNineZoneProvider>,
    );
    const handle = container.getElementsByClassName("nz-widget-floatingWidget_handle")[0];
    act(() => {
      fireEvent.mouseDown(handle);
      dispatch.reset();
      fireEvent.mouseMove(handle);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "FLOATING_WIDGET_RESIZE",
      id: "w1",
    })).should.true;
  });

  it("tool settings should NOT have resize handles", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "toolSettings", ["nz-tool-settings-tab"], undefined, { minimized: true, isFloatingStateWindowResizable: false });
    nineZone = addTab(nineZone, "nz-tool-settings-tab");
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.toolSettings!}
          widget={nineZone.widgets.toolSettings}
        />
      </TestNineZoneProvider>,
    );
    const handleList = container.getElementsByClassName("nz-widget-floatingWidget_handle");
    handleList.length.should.eq(0);
  });
});

describe("getResizeBy", () => {
  it("top", () => {
    getResizeBy("top", { x: 10, y: 20 }).should.eql({
      left: 0,
      top: -20,
      right: 0,
      bottom: 0,
    });
  });

  it("right", () => {
    getResizeBy("right", { x: 10, y: 20 }).should.eql({
      left: 0,
      top: 0,
      right: 10,
      bottom: 0,
    });
  });

  it("bottom", () => {
    getResizeBy("bottom", { x: 10, y: 20 }).should.eql({
      left: 0,
      top: 0,
      right: 0,
      bottom: 20,
    });
  });

  it("left", () => {
    getResizeBy("left", { x: 10, y: 20 }).should.eql({
      left: -10,
      top: 0,
      right: 0,
      bottom: 0,
    });
  });

  it("topLeft", () => {
    getResizeBy("topLeft", { x: 10, y: 20 }).should.eql({
      left: -10,
      top: -20,
      right: 0,
      bottom: 0,
    });
  });

  it("topRight", () => {
    getResizeBy("topRight", { x: 10, y: 20 }).should.eql({
      left: 0,
      top: -20,
      right: 10,
      bottom: 0,
    });
  });

  it("bottomLeft", () => {
    getResizeBy("bottomLeft", { x: 10, y: 20 }).should.eql({
      left: -10,
      top: 0,
      right: 0,
      bottom: 20,
    });
  });

  it("bottomRight", () => {
    getResizeBy("bottomRight", { x: 10, y: 20 }).should.eql({
      left: 0,
      top: 0,
      right: 10,
      bottom: 20,
    });
  });
});
