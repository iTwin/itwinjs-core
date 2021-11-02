/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { renderHook } from "@testing-library/react-hooks";
import { DragManager, DragManagerContext, useIsDraggedType, usePanelTarget, useTabTarget, useWidgetTarget } from "../../appui-layout-react";
import { createDragItemInfo, createDragStartArgs, setRefValue } from "../Providers";

describe("DragManager", () => {
  describe("isDraggedType", () => {
    it("should return true", () => {
      const sut = new DragManager();
      sut.handleDragStart({
        info: createDragItemInfo(),
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
      });
      const spy = sinon.stub<Parameters<DragManager["onDragStart"]["add"]>[0]>();
      sut.onDragStart.add(spy);
      sut.handleDragStart(createDragStartArgs());
      spy.calledOnceWithExactly(sinon.match.any, sinon.match.any, undefined).should.true;
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
    dragManager.handleDragEnd();

    spy.calledOnceWithExactly(undefined).should.true;
    result.current[1].should.false;
  });
});

describe("usePanelTarget", () => {
  it("should clear target", () => {
    const dragManager = new DragManager();
    const spy = sinon.spy(dragManager, "handleTargetChanged");
    const { result } = renderHook(() => usePanelTarget({
      side: "left",
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
    const { result } = renderHook(() => useWidgetTarget({
      side: "left",
      widgetIndex: 0,
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
      info: createDragItemInfo(),
      item: {
        type: "tab",
        id: "",
      },
    });
    result.current.should.true;
  });
});
