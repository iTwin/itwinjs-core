/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { Rectangle } from "@bentley/ui-core";
import * as ResizeObserverModule from "@bentley/ui-core/lib/ui-core/utils/hooks/ResizeObserverPolyfill";
import { createNineZoneState, handleToCursorType, MeasureContext, NineZone, NineZoneDispatch, NineZoneLabels, NineZoneLabelsContext, sideToCursorType, useLabel } from "../../ui-ninezone";
import { NineZoneProvider } from "../Providers";
import { createBoundingClientRect, createDOMRect, flushAsyncOperations, ResizeObserverMock } from "../Utils";

describe("<NineZone />", () => {
  it("renders correctly", () => {
    const { container } = render(<NineZone
      dispatch={sinon.stub()}
      state={createNineZoneState()}
    >
      9-Zone
    </NineZone>);
    container.firstChild!.should.matchSnapshot();
  });

  it("should measure NineZone bounds", () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention, react/display-name
    const Measurer = React.forwardRef<{ measure: () => Rectangle }>((_, ref) => {
      const measure = React.useContext(MeasureContext);
      React.useImperativeHandle(ref, () => ({
        measure,
      }));
      return <></>;
    });
    const measurerRef = React.createRef<{ measure: () => Rectangle }>();
    const { container } = render(<NineZone
      dispatch={sinon.stub()}
      state={createNineZoneState()}
    >
      <Measurer ref={measurerRef} />
    </NineZone>);
    sinon.stub(container.firstChild! as HTMLElement, "getBoundingClientRect").returns(createDOMRect({
      width: 200,
    }));
    measurerRef.current!.measure().toProps().should.eql({
      left: 0,
      right: 200,
      top: 0,
      bottom: 0,
    });
  });

  it("should dispatch RESIZE", async () => {
    let resizeObserver: ResizeObserverMock | undefined;
    let measurer: Element | undefined;
    sinon.stub(ResizeObserverModule, "ResizeObserver").callsFake((callback) => new ResizeObserverMock(callback));
    sinon.stub(ResizeObserverMock.prototype, "observe").callsFake(function (this: ResizeObserverMock, element: Element) {
      resizeObserver = this;
      measurer = element;
    });

    const spy = sinon.stub<NineZoneDispatch>();
    render(<NineZone
      dispatch={spy}
      state={createNineZoneState()}
    />);

    spy.reset();

    sinon.stub(measurer!, "getBoundingClientRect").returns(createBoundingClientRect(0, 0, 10, 20));
    resizeObserver!.callback([{
      contentRect: createDOMRect(),
      target: measurer!,
    } as any], resizeObserver!);
    await flushAsyncOperations();
    spy.calledOnceWithExactly(sinon.match({
      type: "RESIZE",
      size: {
        width: 10,
        height: 20,
      },
    })).should.true;
  });

  it("should not dispatch RESIZE if size did not change", async () => {
    let resizeObserver: ResizeObserverMock | undefined;
    let measurer: Element | undefined;
    sinon.stub(ResizeObserverModule, "ResizeObserver").callsFake((callback) => new ResizeObserverMock(callback));
    sinon.stub(ResizeObserverMock.prototype, "observe").callsFake(function (this: ResizeObserverMock, element: Element) {
      resizeObserver = this;
      measurer = element;
    });

    sinon.stub(HTMLElement.prototype, "getBoundingClientRect").returns(createBoundingClientRect(0, 0, 10, 20));

    const spy = sinon.stub<NineZoneDispatch>();
    render(<NineZone
      dispatch={spy}
      state={createNineZoneState()}
    />);

    spy.reset();

    await flushAsyncOperations();

    resizeObserver!.callback([{
      contentRect: createDOMRect(),
      target: measurer!,
    } as any], resizeObserver!);

    spy.notCalled.should.true;
  });
});

describe("<NineZoneProvider />", () => {
  it("renders correctly", () => {
    const { container } = render(<NineZoneProvider>
      9-Zone
    </NineZoneProvider>);
    container.firstChild!.should.matchSnapshot();
  });
});

describe("useLabel", () => {
  it("should return label", () => {
    const labels: NineZoneLabels = {
      dockToolSettingsTitle: "test",
    };
    // eslint-disable-next-line react/display-name
    const { result } = renderHook(() => useLabel("dockToolSettingsTitle"), { wrapper: (props: {}) => <NineZoneLabelsContext.Provider value={labels} {...props} /> });
    result.current!.should.eq("test");
  });
});

describe("handleToCursorType", () => {
  it("bottom", () => {
    handleToCursorType("bottom").should.eq("ns-resize");
  });

  it("top", () => {
    handleToCursorType("top").should.eq("ns-resize");
  });

  it("left", () => {
    handleToCursorType("left").should.eq("ew-resize");
  });

  it("right", () => {
    handleToCursorType("right").should.eq("ew-resize");
  });

  it("topLeft", () => {
    handleToCursorType("topLeft").should.eq("nwse-resize");
  });

  it("bottomRight", () => {
    handleToCursorType("bottomRight").should.eq("nwse-resize");
  });

  it("topRight", () => {
    handleToCursorType("topRight").should.eq("nesw-resize");
  });

  it("bottomLeft", () => {
    handleToCursorType("bottomLeft").should.eq("nesw-resize");
  });
});

describe("sideToCursorType", () => {
  it("bottom", () => {
    sideToCursorType("bottom").should.eq("ns-resize");
  });

  it("top", () => {
    sideToCursorType("top").should.eq("ns-resize");
  });

  it("left", () => {
    sideToCursorType("left").should.eq("ew-resize");
  });

  it("right", () => {
    sideToCursorType("right").should.eq("ew-resize");
  });
});
