/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { renderHook, act } from "@testing-library/react-hooks";
import { useResizeObserver } from "../../../ui-core/utils/hooks/useResizeObserver";
import * as ResizeObserverModule from "../../../ui-core/utils/hooks/ResizeObserverPolyfill";
import { createDOMRect } from "../../Utils";

describe("useResizeObserver", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should observe instance", () => {
    const spy = sandbox.spy(ResizeObserverModule.ResizeObserver.prototype, "observe");
    const { result } = renderHook(() => useResizeObserver());
    const element = document.createElement("div");
    act(() => {
      result.current(element);
    });
    spy.calledOnceWithExactly(element).should.true;
  });

  it("should unobserve instance", () => {
    const spy = sandbox.spy(ResizeObserverModule.ResizeObserver.prototype, "unobserve");
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
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "ResizeObserver");
    const spy = sandbox.spy();
    const { result } = renderHook(() => useResizeObserver(spy));
    const element = document.createElement("div");
    act(() => {
      result.current(element);
    });

    spy.resetHistory();
    sinon.stub(element, "getBoundingClientRect").returns(createDOMRect({ width: 100 }));
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: createDOMRect({ width: 100 }),
      target: element,
    }], resizeObserverSpy.firstCall.returnValue);

    spy.calledOnceWithExactly(100).should.true;
  });

  it("should call onResize (height)", () => {
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "ResizeObserver");
    const spy = sandbox.spy();
    const { result } = renderHook(() => useResizeObserver(spy, true));
    const element = document.createElement("div");
    act(() => {
      result.current(element);
    });

    spy.resetHistory();
    sinon.stub(element, "getBoundingClientRect").returns(createDOMRect({ height: 100 }));
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: createDOMRect({ height: 100 }),
      target: element,
    }], resizeObserverSpy.firstCall.returnValue);

    spy.calledOnceWithExactly(100).should.true;
  });
});
