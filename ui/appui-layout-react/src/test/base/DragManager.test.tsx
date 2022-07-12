/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, renderHook } from "@testing-library/react-hooks";
import { DragManager, DragManagerContext, useIsDragged, useIsDraggedType, usePanelTarget, useTabTarget, useTarget, useTargeted } from "../../appui-layout-react";
import { createDragInfo, createDragStartArgs, setRefValue } from "../Providers";
import { expect } from "chai";

describe("DragManager", () => {
  describe("isDraggedType", () => {
    it("should return true", () => {
      const sut = new DragManager();
      sut.handleDragStart({
        info: createDragInfo(),
        item: {
          type: "tab",
          id: "",
        },
      });
      sut.isDraggedType("tab").should.true;
    });
  });

  describe("handleTargetChanged", () => {
    it("should not update target if not dragging", () => {
      const sut = new DragManager();
      sut.handleTargetChanged({
        type: "panel",
        side: "left",
        newWidgetId: "w1",
      });
      const spy = sinon.stub<Parameters<DragManager["onDragStart"]["add"]>[0]>();
      sut.onDragStart.add(spy);
      sut.handleDragStart(createDragStartArgs());
      sinon.assert.calledOnceWithExactly(spy, sinon.match.any, sinon.match.any, undefined);
    });
  });

});

describe("useTabTarget", () => {
  it("should clear target when target changes", () => {
    const dragManager = new DragManager();
    const spy = sinon.spy(dragManager, "handleTargetChanged");
    const { result } = renderHook(() => useTabTarget({
      tabIndex: 0,
      widgetId: "w1",
    }), {
      wrapper: (props) => <DragManagerContext.Provider value={dragManager} {...props} />, // eslint-disable-line react/display-name
    });

    const element = document.createElement("div");
    const elementFromPointStub = sinon.stub(document, "elementFromPoint").returns(element);
    setRefValue(result.current[0], element);

    dragManager.handleDragStart(createDragStartArgs());
    dragManager.handleDrag(10, 20);
    result.current[1].should.true;

    spy.resetHistory();
    elementFromPointStub.restore();
    sinon.stub(document, "elementFromPoint").returns(document.createElement("div"));
    dragManager.handleDrag(10, 20);

    spy.calledOnceWithExactly(undefined).should.true;
    result.current[1].should.false;
  });

  it("should clear target when drag interaction ends", () => {
    const dragManager = new DragManager();
    const stub = sinon.stub<Parameters<DragManager["onTargetChanged"]["add"]>[0]>();
    dragManager.onTargetChanged.add(stub);
    const { result } = renderHook(() => useTabTarget({
      tabIndex: 0,
      widgetId: "w1",
    }), {
      wrapper: (props) => <DragManagerContext.Provider value={dragManager} {...props} />, // eslint-disable-line react/display-name
    });

    const element = document.createElement("div");
    const elementFromPointStub = sinon.stub(document, "elementFromPoint").returns(element);
    setRefValue(result.current[0], element);

    dragManager.handleDragStart(createDragStartArgs());
    dragManager.handleDrag(10, 20);
    result.current[1].should.true;

    stub.resetHistory();
    elementFromPointStub.restore();
    dragManager.handleDragEnd();

    sinon.assert.calledOnceWithExactly(stub, undefined);
    result.current[1].should.false;
  });
});

describe("usePanelTarget", () => {
  it("should clear target", () => {
    const dragManager = new DragManager();
    const spy = sinon.spy(dragManager, "handleTargetChanged");
    const { result } = renderHook(() => usePanelTarget({
      side: "left",
      newWidgetId: "w1",
    }), {
      wrapper: (props) => <DragManagerContext.Provider value={dragManager} {...props} />, // eslint-disable-line react/display-name
    });

    const element = document.createElement("div");
    sinon.stub(document, "elementFromPoint").returns(element);
    setRefValue(result.current[0], element);

    dragManager.handleDragStart(createDragStartArgs());
    dragManager.handleDrag(10, 20);

    spy.resetHistory();

    setRefValue(result.current[0], document.createElement("div"));
    dragManager.handleDrag(10, 20);

    spy.calledOnceWithExactly(undefined).should.true;
  });
});

describe("useWidgetTarget", () => {
  it("should clear target", () => {
    const dragManager = new DragManager();
    const spy = sinon.spy(dragManager, "handleTargetChanged");
    const { result } = renderHook(() => useTarget({
      type: "widget",
      widgetId: "0",
    }), {
      wrapper: (props) => <DragManagerContext.Provider value={dragManager} {...props} />, // eslint-disable-line react/display-name
    });

    const element = document.createElement("div");
    sinon.stub(document, "elementFromPoint").returns(element);
    setRefValue(result.current[0], element);

    dragManager.handleDragStart(createDragStartArgs());
    dragManager.handleDrag(10, 20);

    spy.resetHistory();

    setRefValue(result.current[0], document.createElement("div"));
    dragManager.handleDrag(10, 20);

    spy.calledOnceWithExactly(undefined).should.true;
  });
});

describe("useIsDraggedType", () => {
  it("should return true", () => {
    const dragManager = new DragManager();
    const { result } = renderHook(() => useIsDraggedType("tab"), {
      wrapper: (props) => <DragManagerContext.Provider value={dragManager} {...props} />, // eslint-disable-line react/display-name
    });

    dragManager.handleDragStart({
      info: createDragInfo(),
      item: {
        type: "tab",
        id: "",
      },
    });
    result.current.should.true;
  });
});

describe("useIsDragged", () => {
  it("should invoke callback", () => {
    const dragManager = new DragManager();
    const stub = sinon.stub();
    stub.returns(false);
    const { result } = renderHook(() => useIsDragged(stub), {
      wrapper: (props) => <DragManagerContext.Provider value={dragManager} {...props} />, // eslint-disable-line react/display-name
    });
    sinon.assert.calledOnce(stub);
    expect(result.current).to.be.false;

    act(() => {
      stub.onCall(1).returns(true);
      dragManager.handleDragStart({
        info: createDragInfo(),
        item: {
          type: "tab",
          id: "",
        },
      });
    });
    sinon.assert.calledTwice(stub);
    expect(result.current).to.be.true;

    act(() => {
      stub.onCall(2).returns(true);
      dragManager.handleDragUpdate();
    });
    sinon.assert.calledThrice(stub);
    expect(result.current).to.be.true;

    act(() => {
      dragManager.handleDragEnd();
    });
    expect(result.current).to.be.false;
    sinon.assert.callCount(stub, 4);
  });
});

describe("useTargeted", () => {
  it("returns a targeted object", () => {
    const dragManager = new DragManager();
    const { result } = renderHook(() => useTargeted(), {
      wrapper: (props) => <DragManagerContext.Provider value={dragManager} {...props} />, // eslint-disable-line react/display-name
    });
    expect(result.current).to.be.undefined;

    act(() => {
      dragManager.handleDragStart({
        info: createDragInfo(),
        item: {
          type: "tab",
          id: "",
        },
      });
      dragManager.handleTargetChanged({
        type: "window",
      });
    });

    result.current!.should.eql({ type: "window" });
  });
});
