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
  addPanelWidget, addTab, createNineZoneState, DragManager, FloatingTab, NineZoneDispatch, ShowWidgetIconContext,
} from "../../appui-layout-react";
import { createDragInfo, TestNineZoneProvider } from "../Providers";
import { createDraggedTabState } from "../../appui-layout-react/state/internal/TabStateHelpers";

describe("FloatingTab", () => {
  it("should render", async () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "tab 1" });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    const { findByText } = render(
      <TestNineZoneProvider
        state={state}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    await findByText("tab 1");
  });

  it("should render with icon", async () => {
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "tab 1", iconSpec: <div>icon</div> });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    const { findByText } = render(
      <TestNineZoneProvider
        state={state}
      >
        <ShowWidgetIconContext.Provider value={true}>
          <FloatingTab />
        </ShowWidgetIconContext.Provider>
      </TestNineZoneProvider>,
    );
    await findByText("icon");
  });

  it("should dispatch WIDGET_TAB_DRAG", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "tab 1" });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragInfo(),
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

  it("should dispatch WIDGET_TAB_DRAG_END with tab start target", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "tab 1", preferredFloatingWidgetSize: { width: 33, height: 33 } });
    state = addPanelWidget(state, "left", "leftStart", ["t1"]);
    state = produce(state, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragInfo(),
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

  it("should dispatch WIDGET_TAB_DRAG_END with tab end target", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "tab 1", preferredFloatingWidgetSize: { width: 33, height: 33 } });
    state = addPanelWidget(state, "left", "leftEnd", ["t1"]);
    state = produce(state, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragInfo(),
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
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "tab 1", isFloatingStateWindowResizable: true, preferredFloatingWidgetSize: { width: 50, height: 50 } });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragInfo(),
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
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "tab 1" });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragInfo(),
        item: {
          type: "tab",
          id: "t1",
        },
      });
      dragManager.current!.handleTargetChanged({
        type: "panel",
        side: "left",
        newWidgetId: "",
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

  it("should dispatch WIDGET_TAB_DRAG_END with widget target", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let state = createNineZoneState();
    state = addTab(state, "t1", { label: "tab 1" });
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = produce(state, (draft) => {
      draft.draggedTab = createDraggedTabState("t1", {
        position: new Point(10, 20).toProps(),
      });
    });
    render(
      <TestNineZoneProvider
        state={state}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </TestNineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragInfo(),
        item: {
          type: "tab",
          id: "t1",
        },
      });
      dragManager.current!.handleTargetChanged({
        type: "section",
        side: "right",
        sectionIndex: 0,
        newWidgetId: "nw1",
      });
      fireEvent.mouseUp(document);
    });
    sinon.assert.calledOnceWithExactly(dispatch, sinon.match({
      type: "WIDGET_TAB_DRAG_END",
      id: "t1",
      target: {
        type: "section",
        side: "right",
        sectionIndex: 0,
      },
    }));
  });

});
