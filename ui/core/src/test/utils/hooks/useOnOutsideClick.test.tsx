/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { renderHook, act } from "@testing-library/react-hooks";
import { useOnOutsideClick } from "../../../ui-core/utils/hooks/useOnOutsideClick";

describe("useOnOutsideClick", () => {
  it("should call onOutsideClick", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof useOnOutsideClick>[0]>>();
    const { result } = renderHook(() => useOnOutsideClick(spy));
    const element = document.createElement("div");
    act(() => {
      result.current.current = element;
    });

    const pointerDown = document.createEvent("HTMLEvents");
    pointerDown.initEvent("pointerdown");
    document.dispatchEvent(pointerDown);

    const pointerUp = document.createEvent("HTMLEvents");
    pointerUp.initEvent("pointerup");
    document.dispatchEvent(pointerUp);

    spy.calledOnceWithExactly().should.true;
  });

  it("should respect outside event predicate", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof useOnOutsideClick>[0]>>();
    const predicate = sinon.spy<NonNullable<Parameters<typeof useOnOutsideClick>[1]>>(() => {
      return false;
    });
    const { result } = renderHook(() => useOnOutsideClick(spy, predicate));
    const element = document.createElement("div");
    act(() => {
      result.current.current = element;
    });

    const pointerDown = document.createEvent("HTMLEvents") as PointerEvent;
    pointerDown.initEvent("pointerdown");
    document.dispatchEvent(pointerDown);

    const pointerUp = document.createEvent("HTMLEvents");
    pointerUp.initEvent("pointerup");
    document.dispatchEvent(pointerUp);

    predicate.calledOnceWithExactly(pointerDown).should.true;
    spy.notCalled.should.true;
  });

  it("should respect outside event predicate", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof useOnOutsideClick>[0]>>();
    const predicate = sinon.spy<NonNullable<Parameters<typeof useOnOutsideClick>[1]>>((ev) => {
      if (ev.type === "pointerup")
        return false;
      return true;
    });
    const { result } = renderHook(() => useOnOutsideClick(spy, predicate));
    const element = document.createElement("div");
    act(() => {
      result.current.current = element;
    });

    const pointerDown = document.createEvent("HTMLEvents") as PointerEvent;
    pointerDown.initEvent("pointerdown");
    document.dispatchEvent(pointerDown);

    const pointerUp = document.createEvent("HTMLEvents") as PointerEvent;
    pointerUp.initEvent("pointerup");
    document.dispatchEvent(pointerUp);

    predicate.callCount.should.eq(2);
    predicate.firstCall.calledWithExactly(pointerDown).should.true;
    predicate.secondCall.calledWithExactly(pointerUp).should.true;
    spy.notCalled.should.true;
  });
});
