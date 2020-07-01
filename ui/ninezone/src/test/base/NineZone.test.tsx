/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { NineZone } from "../../ui-ninezone";
import { NineZoneProvider } from "../Providers";
import { createNineZoneState } from "../../ui-ninezone/base/NineZoneState";
import { MeasureContext, NineZoneDispatch } from "../../ui-ninezone/base/NineZone";
import { Rectangle } from "@bentley/ui-core";
import * as ResizeObserverModule from "@bentley/ui-core/lib/ui-core/utils/hooks/ResizeObserverPolyfill"; // tslint:disable-line: no-direct-imports
import { createBoundingClientRect, createDOMRect, ResizeObserverMock } from "../Utils";

describe("<NineZone />", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

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
    // tslint:disable-next-line: variable-name
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

  it("should dispatch RESIZE", () => {
    let resizeObserver: ResizeObserverMock | undefined;
    let measurer: Element | undefined;
    sandbox.stub(ResizeObserverModule, "ResizeObserver").callsFake((callback) => new ResizeObserverMock(callback));
    sandbox.stub(ResizeObserverMock.prototype, "observe").callsFake(function (this: ResizeObserverMock, element: Element) {
      resizeObserver = this;
      measurer = element;
    });

    const spy = sinon.stub<NineZoneDispatch>();
    render(<NineZone
      dispatch={spy}
      state={createNineZoneState()}
    />);

    spy.reset();

    sandbox.stub(measurer!, "getBoundingClientRect").returns(createBoundingClientRect(0, 0, 10, 20));
    resizeObserver!.callback([{
      contentRect: createDOMRect(),
      target: measurer!,
    }], resizeObserver!);

    spy.calledOnceWithExactly(sinon.match({
      type: "RESIZE",
      size: {
        width: 10,
        height: 20,
      },
    })).should.true;
  });

  it("should not dispatch RESIZE if size did not change", () => {
    let resizeObserver: ResizeObserverMock | undefined;
    let measurer: Element | undefined;
    sandbox.stub(ResizeObserverModule, "ResizeObserver").callsFake((callback) => new ResizeObserverMock(callback));
    sandbox.stub(ResizeObserverMock.prototype, "observe").callsFake(function (this: ResizeObserverMock, element: Element) {
      resizeObserver = this;
      measurer = element;
    });

    sandbox.stub(HTMLElement.prototype, "getBoundingClientRect").returns(createBoundingClientRect(0, 0, 10, 20));

    const spy = sinon.stub<NineZoneDispatch>();
    render(<NineZone
      dispatch={spy}
      state={createNineZoneState()}
    />);

    spy.reset();

    resizeObserver!.callback([{
      contentRect: createDOMRect(),
      target: measurer!,
    }], resizeObserver!);

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
