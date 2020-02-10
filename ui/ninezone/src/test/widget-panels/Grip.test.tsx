/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react-hooks";
import { WidgetPanelGrip, useResizeGrip } from "../../ui-ninezone";

describe("WidgetPanelGrip", () => {
  it("should render", () => {
    const { container } = render(
      <WidgetPanelGrip side="left" />,
    );
    container.firstChild!.should.matchSnapshot();
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
