/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react-hooks";
import {
  WidgetPanelGrip, useResizeGrip, WidgetPanelContext, createNineZoneState, addPanelWidget, NineZoneContext,
  NineZoneDispatch, NineZoneDispatchContext, TOGGLE_PANEL_COLLAPSED,
} from "../../ui-ninezone";

describe("WidgetPanelGrip", () => {
  it("should dispatch TOGGLE_PANEL_COLLAPSED", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", {});
    render(
      <NineZoneDispatchContext.Provider value={dispatch}>
        <NineZoneContext.Provider value={nineZone}>
          <WidgetPanelContext.Provider value="left">
            <WidgetPanelGrip />
          </WidgetPanelContext.Provider>
        </NineZoneContext.Provider>
      </NineZoneDispatchContext.Provider>,
    );
    act(() => {
      const grip = document.getElementsByClassName("nz-widgetPanels-grip")[0];
      fireEvent.doubleClick(grip);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: TOGGLE_PANEL_COLLAPSED,
      side: "left",
    })).should.true;
  });
});

describe("useResizeGrip", () => {
  it("should invoke onResize for left grip", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof useResizeGrip>[1]>>();
    const { result } = renderHook(() => useResizeGrip("left", spy));
    const element = document.createElement("div");
    act(() => {
      result.current[0](element);
      StartResize(element);
      Resize(100, 0);
    });
    spy.calledOnceWithExactly(100).should.true;
  });

  it("should invoke onResize for top grip", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof useResizeGrip>[1]>>();
    const { result } = renderHook(() => useResizeGrip("top", spy));
    const element = document.createElement("div");
    act(() => {
      result.current[0](element);
      StartResize(element);
      Resize(100, 50);
    });
    spy.calledOnceWithExactly(50).should.true;
  });

  it("should invoke onResize for right grip", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof useResizeGrip>[1]>>();
    const { result } = renderHook(() => useResizeGrip("right", spy));
    const element = document.createElement("div");
    act(() => {
      result.current[0](element);
      StartResize(element);
      Resize(100, 50);
    });
    spy.calledOnceWithExactly(-100).should.true;
  });

  it("should not invoke onResize for right grip", () => {
    const onResize = sinon.stub<NonNullable<Parameters<typeof useResizeGrip>[1]>>();
    const onEnd = sinon.stub<NonNullable<Parameters<typeof useResizeGrip>[2]>>();
    const { result } = renderHook(() => useResizeGrip("right", onResize, onEnd));
    const element = document.createElement("div");
    act(() => {
      result.current[0](null);
      StartResize(element);
      Resize(10, 10);
      EndResize();
    });
    onResize.notCalled.should.true;
    onEnd.notCalled.should.true;
  });
});

/** @internal */
export function StartResize(element: Element) {
  const pointerDown = document.createEvent("HTMLEvents");
  pointerDown.initEvent("pointerdown");
  element.dispatchEvent(pointerDown);
}

/** @internal */
export function Resize(x: number, y: number) {
  const pointerDown = document.createEvent("MouseEvent");
  pointerDown.initEvent("pointermove");
  sinon.stub(pointerDown, "clientX").get(() => x);
  sinon.stub(pointerDown, "clientY").get(() => y);
  document.dispatchEvent(pointerDown);
}

/** @internal */
export function EndResize() {
  const pointerUp = document.createEvent("HTMLEvents");
  pointerUp.initEvent("pointerup");
  document.dispatchEvent(pointerUp);
}
