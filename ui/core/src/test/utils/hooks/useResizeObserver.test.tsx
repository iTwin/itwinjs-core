/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, renderHook } from "@testing-library/react-hooks";
import * as ResizeObserverModule from "../../../ui-core/utils/hooks/ResizeObserverPolyfill";
import { ElementResizeObserver, ResizableContainerObserver, useLayoutResizeObserver, useResizeObserver } from "../../../ui-core/utils/hooks/useResizeObserver";
import { createDOMRect } from "../../Utils";
import TestUtils from "../../TestUtils";
import { render } from "@testing-library/react";
import { expect } from "chai";

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

  it("should observe instance", async () => {
    const spy = sandbox.spy(ResizeObserverModule.ResizeObserver.prototype, "observe");
    const { result } = renderHook(() => useResizeObserver());
    const element = document.createElement("div");
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current(element);
    });
    await TestUtils.flushAsyncOperations();
    spy.calledOnceWithExactly(element).should.true;
  });

  it("should unobserve instance", async () => {
    const spy = sandbox.spy(ResizeObserverModule.ResizeObserver.prototype, "unobserve");
    const { result } = renderHook(() => useResizeObserver());
    const element = document.createElement("div");
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current(element);
    });
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current(null);
    });
    await TestUtils.flushAsyncOperations();
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
    await TestUtils.flushAsyncOperations();
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
    await TestUtils.flushAsyncOperations();

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

  it("should call onResize (width and height)", async () => {
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "ResizeObserver");
    const spy = sandbox.spy();
    const { result } = renderHook(() => useResizeObserver(spy));
    const element = document.createElement("div");
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current(element);
    });

    await TestUtils.flushAsyncOperations();
    spy.resetHistory();
    sinon.stub(element, "getBoundingClientRect").returns(createDOMRect({ width: 100, height: 100 }));
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: createDOMRect({ width: 100, height: 100 }),
      target: element,
    }], resizeObserverSpy.firstCall.returnValue);
    await TestUtils.flushAsyncOperations();
    spy.calledOnce.should.true;
  });

});

describe("useLayoutResizeObserver", () => {
  const Tester = () => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [width, height] = useLayoutResizeObserver(containerRef);
    return (
      <div data-testid="sizer" ref={containerRef} className="sizer">
        <span data-testid="width">{width ?? 0}</span>
        <span data-testid="height">{height ?? 0}</span>
      </div>
    );
  };

  stubRaf();
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should call onResize (width and height)", async () => {
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "ResizeObserver");
    const wrapper = render(<Tester />);
    expect(wrapper.getByTestId("width").textContent).to.eql("0");
    expect(wrapper.getByTestId("height").textContent).to.eql("0");
    const container = wrapper.getByTestId("sizer");
    sinon.stub(container, "getBoundingClientRect").returns(createDOMRect({ width: 300, height: 100 }));
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: createDOMRect({ width: 300, height: 100 }), // not used - we call getBoundingClientRect in resize function
      target: container,
    }], resizeObserverSpy.firstCall.returnValue);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.getByTestId("width").textContent).to.eql("300");
    expect(wrapper.getByTestId("height").textContent).to.eql("100");
    wrapper.unmount();
  });
});

describe("ElementResizeObserver", () => {
  stubRaf();
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  const ElementResizeObserverTester = () => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    return (
      <div data-testid="sizer" ref={containerRef} className="sizer">
        <ElementResizeObserver watchedElement={containerRef} render=
          {({ width, height }) => (
            <>
              <span data-testid="width">{width ?? 0}</span>
              <span data-testid="height">{height ?? 0}</span>
            </>
          )}
        />
      </div>
    );
  };

  it("should call onResize (width and height)", async () => {
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "ResizeObserver");
    let isFirstCall = true;
    sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
      if (this.classList.contains("sizer")) {
        if (isFirstCall) {
          isFirstCall = false;
          return createDOMRect({ width: 100, height: 50 });
        }
        return createDOMRect({ width: 300, height: 100 });
      }
      return createDOMRect();
    });

    const wrapper = render(<ElementResizeObserverTester />);
    expect(wrapper.getByTestId("width").textContent).to.eql("100");
    expect(wrapper.getByTestId("height").textContent).to.eql("50");
    const container = wrapper.getByTestId("sizer");
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: createDOMRect({ width: 300, height: 100 }), // not used - we call getBoundingClientRect in resize function
      target: container,
    }], resizeObserverSpy.firstCall.returnValue);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.getByTestId("width").textContent).to.eql("300");
    expect(wrapper.getByTestId("height").textContent).to.eql("100");
    wrapper.unmount();
  });
});

describe("ResizableContainerObserver", () => {
  stubRaf();
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  const ResizableContainerObserverTester = () => {
    // initial values are not used since size is faked below and value should come from initial layout in 'sizer' container
    const [observedBounds, setObservedBounds] = React.useState({ width: 0, height: 0 });
    const onResize = React.useCallback((width: number, height: number) => {
      setObservedBounds({ width, height });
    }, []);

    return (
      <div data-testid="sizer" className="sizer">
        <ResizableContainerObserver onResize={onResize} >
          <span data-testid="width">{observedBounds.width}</span>
          <span data-testid="height">{observedBounds.height}</span>
        </ResizableContainerObserver>
      </div>
    );
  };

  it("should call onResize (width and height)", async () => {
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "ResizeObserver");
    let useFirstSize = true;
    sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
      if (this.classList.contains("sizer") || this.classList.contains("uicore-resizable-container")) {
        if (useFirstSize) {
          return createDOMRect({ width: 100, height: 50 });
        }
        return createDOMRect({ width: 100, height: 200 });
      }
      return createDOMRect();
    });

    const wrapper = render(<ResizableContainerObserverTester />);
    await TestUtils.flushAsyncOperations();

    expect(wrapper.getByTestId("width").textContent).to.eql("100");
    expect(wrapper.getByTestId("height").textContent).to.eql("50");
    const container = wrapper.container.querySelector("div.uicore-resizable-container");
    expect(container).to.not.be.null;
    await TestUtils.flushAsyncOperations();

    resizeObserverSpy.firstCall.args[0]([{
      contentRect: createDOMRect({ width: 100, height: 50 }), // not used - we call getBoundingClientRect in resize function
      target: container,
    }], resizeObserverSpy.firstCall.returnValue);

    await TestUtils.flushAsyncOperations();
    expect(wrapper.getByTestId("width").textContent).to.eql("100");
    expect(wrapper.getByTestId("height").textContent).to.eql("50");

    await TestUtils.flushAsyncOperations();
    useFirstSize = false;
    resizeObserverSpy.secondCall.args[0]([{
      contentRect: createDOMRect({ width: 100, height: 200 }), // not used - we call getBoundingClientRect in resize function
      target: container,
    }], resizeObserverSpy.secondCall.returnValue);
    await TestUtils.flushAsyncOperations();

    expect(wrapper.getByTestId("width").textContent).to.eql("100");
    expect(wrapper.getByTestId("height").textContent).to.eql("200");

    wrapper.unmount();
  });
});

