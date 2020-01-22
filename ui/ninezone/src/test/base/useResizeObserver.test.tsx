/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { renderHook, act } from "@testing-library/react-hooks";
import { useResizeObserver } from "../../ui-ninezone";
import * as ResizeObserverModule from "resize-observer-polyfill";
import { createDOMRect } from "../Utils";

describe("useResizeObserver", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should observe instance", () => {
    const spy = sandbox.spy(ResizeObserverModule.default.prototype, "observe");
    const { result } = renderHook(() => useResizeObserver());
    const element = document.createElement("div");
    act(() => {
      result.current(element);
    });
    spy.calledOnceWithExactly(element).should.true;
  });

  it("should unobserve instance", () => {
    const spy = sandbox.spy(ResizeObserverModule.default.prototype, "unobserve");
    const { result } = renderHook(() => useResizeObserver());
    const element = document.createElement("div");
    act(() => {
      result.current(element);
    });
    act(() => {
      result.current(null);
    });
    spy.calledOnceWithExactly(element).should.true;
  });

  it("should call onResize", () => {
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "default");
    const spy = sandbox.spy();
    const { result } = renderHook(() => useResizeObserver(spy));
    const element = document.createElement("div");
    act(() => {
      result.current(element);
    });

    spy.resetHistory();
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: createDOMRect({ width: 100 }),
      target: element,
    }], resizeObserverSpy.firstCall.returnValue);

    spy.calledOnceWithExactly(100).should.true;
  });
});
