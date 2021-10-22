/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { fireEvent } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react-hooks";
import { useOnOutsideClick } from "../../../core-react";

/* eslint-disable @typescript-eslint/no-floating-promises */

function setRefValue<T>(ref: React.Ref<T>, value: T) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

describe("useOnOutsideClick", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe("PointerEvent", () => {
    let pointerEvent: typeof window.PointerEvent;

    before(() => {
      pointerEvent = window.PointerEvent;
      window.PointerEvent = {} as any;
    });

    after(() => {
      window.PointerEvent = pointerEvent;
    });

    it("should call onOutsideClick", () => {
      const spy = sinon.stub<[], void>();
      const { result } = renderHook(() => useOnOutsideClick(spy));
      const element = document.createElement("div");
      act(() => {
        setRefValue(result.current, element);
      });

      const pointerDown = new PointerEvent("pointerdown");
      document.dispatchEvent(pointerDown);

      const pointerUp = new PointerEvent("pointerup");
      document.dispatchEvent(pointerUp);

      spy.calledOnceWithExactly().should.true;
    });

    it("should respect outside event predicate", () => {
      const spy = sinon.stub<[], void>();
      const predicate = sinon.spy<NonNullable<Parameters<typeof useOnOutsideClick>[1]>>(() => {
        return false;
      });
      const { result } = renderHook(() => useOnOutsideClick(spy, predicate));
      const element = document.createElement("div");
      act(() => {
        setRefValue(result.current, element);
      });

      const pointerDown = new PointerEvent("pointerdown");
      document.dispatchEvent(pointerDown);

      const pointerUp = new PointerEvent("pointerup");
      document.dispatchEvent(pointerUp);

      predicate.calledOnceWithExactly(pointerDown).should.true;
      spy.notCalled.should.true;
    });

    it("should respect outside event predicate", () => {
      const spy = sinon.stub<[], void>();
      const predicate = sinon.spy<NonNullable<Parameters<typeof useOnOutsideClick>[1]>>((ev) => {
        if (ev.type === "pointerup")
          return false;
        return true;
      });
      const { result } = renderHook(() => useOnOutsideClick(spy, predicate));
      const element = document.createElement("div");
      act(() => {
        setRefValue(result.current, element);
      });

      const pointerDown = new PointerEvent("pointerdown");
      document.dispatchEvent(pointerDown);

      const pointerUp = new PointerEvent("pointerup");
      document.dispatchEvent(pointerUp);

      predicate.callCount.should.eq(2);
      predicate.firstCall.calledWithExactly(pointerDown).should.true;
      predicate.secondCall.calledWithExactly(pointerUp).should.true;
      spy.notCalled.should.true;
    });
  });

  it("should call onOutsideClick for touch", () => {
    const spy = sinon.stub<[], void>();
    const { result } = renderHook(() => useOnOutsideClick(spy));
    const element = document.createElement("div");
    act(() => {
      setRefValue(result.current, element);
    });

    fireEvent.touchStart(document);
    fireEvent.touchEnd(document);

    spy.calledOnceWithExactly().should.true;
  });

  it("should remove touch and mouse event listeners", () => {
    const { unmount } = renderHook(() => useOnOutsideClick());

    const spy = sandbox.spy(document, "removeEventListener");
    unmount();

    spy.callCount.should.eq(4);
  });

  it("should not handle mouse event after touch event", () => {
    const spy = sinon.stub<[], void>();
    const { result } = renderHook(() => useOnOutsideClick(spy));
    const element = document.createElement("div");
    act(() => {
      setRefValue(result.current, element);
    });

    fireEvent.touchStart(document);
    fireEvent.touchEnd(document);
    fireEvent.mouseDown(document);
    fireEvent.mouseUp(document);

    spy.callCount.should.eq(1);
  });

  it("should continue handling mouse events after timeout", () => {
    const fakeTimers = sandbox.useFakeTimers();
    const spy = sinon.stub<[], void>();
    const { result } = renderHook(() => useOnOutsideClick(spy));
    const element = document.createElement("div");
    act(() => {
      setRefValue(result.current, element);
    });

    fireEvent.touchStart(document);
    fireEvent.touchEnd(document);

    fakeTimers.tick(1000);

    fireEvent.mouseDown(document);
    fireEvent.mouseUp(document);

    spy.callCount.should.eq(2);
  });
});
