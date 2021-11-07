/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, renderHook } from "@testing-library/react-hooks";
import * as ResizeObserverModule from "../../../core-react/utils/hooks/ResizeObserverPolyfill";
import { ElementResizeObserver, ResizableContainerObserver, useResizeObserver } from "../../../core-react/utils/hooks/useResizeObserver";
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
    sinon.stub(element, "getBoundingClientRect").returns(DOMRect.fromRect({ width: 100 }));
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: DOMRect.fromRect({ width: 100 }),
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
    sinon.stub(element, "getBoundingClientRect").returns(DOMRect.fromRect({ height: 100 }));
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: DOMRect.fromRect({ height: 100 }),
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
    sinon.stub(element, "getBoundingClientRect").returns(DOMRect.fromRect({ width: 100, height: 100 }));
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: DOMRect.fromRect({ width: 100, height: 100 }),
      target: element,
    }], resizeObserverSpy.firstCall.returnValue);
    await TestUtils.flushAsyncOperations();
    spy.calledOnce.should.true;
  });

});

describe("useLayoutResizeObserver", () => {
  const size_0_0 = DOMRect.fromRect({ width: 0, height: 0 });
  const size_100_50 = DOMRect.fromRect({ width: 100, height: 50 });
  const size_300_100 = DOMRect.fromRect({ width: 300, height: 100 });
  let boundingClientRect = size_0_0;
  stubRaf();
  const sandbox = sinon.createSandbox();

  const ResizableContainerObserverTester = () => {
    // initial values are not used since size is faked below and value should come from initial layout in 'sizer' container
    const [observedBounds, setObservedBounds] = React.useState({ width: 0, height: 0 });
    const onResize = React.useCallback((width: number, height: number) => {
      setObservedBounds({ width, height });
    }, []);

    return (
      <div data-testid="sizer" className="sizer">
        <ResizableContainerObserver onResize={onResize}>
          <span data-testid="width">{observedBounds.width}</span>
          <span data-testid="height">{observedBounds.height}</span>
        </ResizableContainerObserver>
      </div>
    );
  };

  const ResizableContainerObserverNoChildren = ({ onResize }: { onResize: (width: number, height: number) => void }) => {
    return (
      <div data-testid="sizer" className="sizer">
        <ResizableContainerObserver onResize={onResize}>
        </ResizableContainerObserver>
      </div>
    );
  };

  const ElementResizeObserverTester = () => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerElement, setContainerElement] = React.useState<HTMLDivElement | null>(null);
    const isMountedRef = React.useRef(false);

    React.useEffect(() => {
      if (!isMountedRef.current && containerRef.current) {
        isMountedRef.current = true;
        setContainerElement(containerRef.current);
      }
    }, []);

    return (
      <div data-testid="sizer" ref={containerRef} className="sizer">
        <ElementResizeObserver watchedElement={containerElement} render=
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

  beforeEach(() => {
    boundingClientRect = size_0_0;

    sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
      if (this.classList.contains("sizer") || this.classList.contains("uicore-resizable-container")) {
        return boundingClientRect;
      }
      return new DOMRect();
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("ElementResizeObserver - should call onResize (width and height)", async () => {
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "ResizeObserver");
    boundingClientRect = size_100_50;

    const wrapper = render(<ElementResizeObserverTester />);
    await TestUtils.flushAsyncOperations();

    expect(wrapper.getByTestId("width").textContent).to.eql("100");
    expect(wrapper.getByTestId("height").textContent).to.eql("50");
    const container = wrapper.getByTestId("sizer");

    boundingClientRect = size_300_100;
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: DOMRect.fromRect({ width: 300, height: 100 }), // we ignore this in hook and just get size from getBoundingClientRect method.
      target: container,
    }], resizeObserverSpy.firstCall.returnValue);
    await TestUtils.flushAsyncOperations();

    expect(wrapper.getByTestId("width").textContent).to.eql("300");
    expect(wrapper.getByTestId("height").textContent).to.eql("100");
    wrapper.unmount();
  });

  it("ResizableContainerObserver - should call onResize (width and height)", async () => {
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "ResizeObserver");
    boundingClientRect = size_100_50;

    const wrapper = render(<ResizableContainerObserverTester />);
    await TestUtils.flushAsyncOperations();

    expect(wrapper.getByTestId("width").textContent).to.eql("100");
    expect(wrapper.getByTestId("height").textContent).to.eql("50");
    const container = wrapper.container.querySelector("div.uicore-resizable-container");
    expect(container).to.not.be.null;
    await TestUtils.flushAsyncOperations();

    boundingClientRect = size_300_100;
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: DOMRect.fromRect({ width: 300, height: 100 }), // we ignore this in hook and just get size from getBoundingClientRect method.
      target: container,
    }], resizeObserverSpy.firstCall.returnValue);
    await TestUtils.flushAsyncOperations();

    await TestUtils.flushAsyncOperations();
    expect(wrapper.getByTestId("width").textContent).to.eql("300");
    expect(wrapper.getByTestId("height").textContent).to.eql("100");

    wrapper.unmount();
  });

  it("ResizableContainerObserver - should call onResize (width and height)", async () => {
    const resizeObserverSpy = sandbox.spy(ResizeObserverModule, "ResizeObserver");
    boundingClientRect = size_100_50;
    let currentWidth = 0;
    let currentHeight = 0;
    const onResize = (width: number, height: number) => {
      currentWidth = width;
      currentHeight = height;
    };

    const wrapper = render(<ResizableContainerObserverNoChildren onResize={onResize} />);
    await TestUtils.flushAsyncOperations();

    const container = wrapper.container.querySelector("div.uicore-resizable-container") as HTMLDivElement;
    expect(container.style.display).to.be.eql("none");
    expect(currentWidth).to.eql(100);
    expect(currentHeight).to.eql(50);

    boundingClientRect = size_300_100;
    // Call the ResizeObserver callback.
    resizeObserverSpy.firstCall.args[0]([{
      contentRect: DOMRect.fromRect({ width: 300, height: 100 }), // we ignore this in hook and just get size from getBoundingClientRect method.
      target: container.parentElement,
    }], resizeObserverSpy.firstCall.returnValue);
    await TestUtils.flushAsyncOperations();

    expect(currentWidth).to.eql(300);
    expect(currentHeight).to.eql(100);

    wrapper.unmount();
  });
});
