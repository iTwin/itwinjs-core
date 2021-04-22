/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { act, renderHook } from "@testing-library/react-hooks";
import * as ResizeObserverModule from "../../../ui-core/utils/hooks/ResizeObserverPolyfill";
import { useResizeObserver } from "../../../ui-core/utils/hooks/useResizeObserver";
import { createDOMRect } from "../../Utils";
import TestUtils from "../../TestUtils";

/** Stubs requestAnimationFrame. */
function stubRaf() {
  const raf = window.requestAnimationFrame;
  const caf = window.cancelAnimationFrame;

  before(() => {
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      return window.setTimeout(cb, 0);
    };
    window.cancelAnimationFrame = (handle: number) => {
      window.clearTimeout(handle);
    };
  });

  after(() => {
    window.requestAnimationFrame = raf;
    window.cancelAnimationFrame = caf;
  });
}

describe("useResizeObserver", () => {
  stubRaf();
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should observe instance", () => {
    const spy = sandbox.spy(ResizeObserverModule.ResizeObserver.prototype, "observe");
    const { result } = renderHook(() => useResizeObserver());
    const element = document.createElement("div");
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current(element);
    });
    spy.calledOnceWithExactly(element).should.true;
  });

  it("should unobserve instance", () => {
    const spy = sandbox.spy(ResizeObserverModule.ResizeObserver.prototype, "unobserve");
    const { result } = renderHook(() => useResizeObserver());
    const element = document.createElement("div");
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current(element);
    });
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current(null);
    });
    spy.calledOnceWithExactly(element).should.true;
  });

  it("should call onResize", async () => {
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "ResizeObserver");
    const spy = sandbox.spy();
    const { result } = renderHook(() => useResizeObserver(spy));
    const element = document.createElement("div");
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current(element);
    });

    spy.resetHistory();
    sinon.stub(element, "getBoundingClientRect").returns(createDOMRect({ width: 100 }));
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: createDOMRect({ width: 100 }),
      target: element,
    }], resizeObserverSpy.firstCall.returnValue);
    await TestUtils.flushAsyncOperations();
    spy.calledOnceWithExactly(100, sinon.match.any).should.true;
  });

  it("should call onResize (height)", async () => {
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "ResizeObserver");
    const spy = sandbox.spy();
    const { result } = renderHook(() => useResizeObserver(spy));
    const element = document.createElement("div");
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current(element);
    });
    // await TestUtils.flushAsyncOperations();

    spy.resetHistory();
    sinon.stub(element, "getBoundingClientRect").returns(createDOMRect({ height: 100 }));
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: createDOMRect({ height: 100 }),
      target: element,
    }], resizeObserverSpy.firstCall.returnValue);
    await TestUtils.flushAsyncOperations();
    spy.calledOnceWithExactly(sinon.match.any, 100).should.true;
  });
});
