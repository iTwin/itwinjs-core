/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import produce from "immer";
import * as React from "react";
import * as sinon from "sinon";
import { Point } from "@itwin/core-react";
import { act, fireEvent, render } from "@testing-library/react";
import {
  addPanelWidget, addTab, createDraggedTabState, createNineZoneState, DragManager, FloatingTab, NineZoneDispatch,
} from "../../appui-layout-react";
import { createDragItemInfo, TestNineZoneProvider } from "../Providers";

describe("FloatingTab", () => {
  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch WIDGET_TAB_DRAG", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragItemInfo(),
        item: {
          type: "tab",
          id: "t1",
        },
      });
      fireEvent.mouseMove(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_TAB_DRAG",
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DRAG_END with tab target", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragItemInfo(),
        item: {
          type: "tab",
          id: "t1",
        },
      });
      fireEvent.mouseUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_TAB_DRAG_END",
      id: "t1",
      target: {
        type: "floatingWidget",
      },
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DRAG_END with floatingWidget target", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragItemInfo(),
        item: {
          type: "tab",
          id: "t1",
        },
      });
      dragManager.current!.handleTargetChanged({
        type: "tab",
        tabIndex: 0,
        widgetId: "w1",
      });
      fireEvent.mouseUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_TAB_DRAG_END",
      id: "t1",
      target: {
        type: "tab",
      },
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DRAG_END with panel target", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragItemInfo(),
        item: {
          type: "tab",
          id: "t1",
        },
      });
      dragManager.current!.handleTargetChanged({
        type: "panel",
        side: "left",
      });
      fireEvent.mouseUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_TAB_DRAG_END",
      id: "t1",
      target: {
        type: "panel",
      },
    })).should.true;
  });
});
