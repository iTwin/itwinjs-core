/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, render, fireEvent } from "@testing-library/react";
import { createNineZoneState, NineZoneProvider, NineZoneDispatch, FloatingWidget, FLOATING_WIDGET_RESIZE, getResizeBy } from "../../ui-ninezone";
import { addFloatingWidget } from "../base/NineZoneState.test";

describe("FloatingWidget", () => {
  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render minimized", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", undefined, { minimized: true });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render dragged", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", undefined, { minimized: true });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </NineZoneProvider>,
    );
    const titleBar = container.getElementsByClassName("nz-widget-titleBar")[0];
    const handle = titleBar.getElementsByClassName("nz-handle")[0];
    act(() => {
      fireEvent.pointerDown(handle);
      fireEvent.pointerMove(handle);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch FLOATING_WIDGET_RESIZE", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", undefined, { minimized: true });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </NineZoneProvider>,
    );
    const handle = container.getElementsByClassName("nz-widget-floatingWidget_handle")[0];
    act(() => {
      fireEvent.pointerDown(handle);
      dispatch.reset();
      fireEvent.pointerMove(handle);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: FLOATING_WIDGET_RESIZE,
      id: "w1",
    })).should.true;
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
});
