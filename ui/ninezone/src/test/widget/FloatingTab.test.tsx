/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import produce from "immer";
import { act, render, fireEvent } from "@testing-library/react";
import { Point } from "@bentley/ui-core";
import {
  createNineZoneState, addTab, NineZoneProvider, FloatingTab, addPanelWidget, WIDGET_TAB_DRAG, TabState, WIDGET_TAB_DRAG_END, DragManagerContext,
  DragTarget, NineZoneDispatch,
} from "../../ui-ninezone";

interface DragStarterProps {
  tabId: TabState["id"];
  target?: DragTarget;
}

function DragStarter(props: DragStarterProps) {
  const dragManager = React.useContext(DragManagerContext);
  React.useEffect(() => {
    dragManager.handleDragStart({
      info: {
        initialPointerPosition: new Point(),
        lastPointerPosition: new Point(),
        pointerPosition: new Point(),
        widgetSize: {
          height: 0,
          width: 0,
        },
      },
      item: {
        type: "tab",
        id: props.tabId,
      },
    });
  }, [dragManager, props.tabId]);
  React.useEffect(() => {
    dragManager.handleTargetChanged(props.target);
  }, [dragManager, props.tabId, props.target]);
  return null;
}

describe("FloatingTab", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = {
        position: new Point(10, 20).toProps(),
        tabId: "t1",
      };
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <FloatingTab />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch WIDGET_TAB_DRAG", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = {
        position: new Point(10, 20).toProps(),
        tabId: "t1",
      };
    });
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <DragStarter tabId="t1" />
        <FloatingTab />
      </NineZoneProvider>,
    );
    act(() => {
      fireEvent.pointerMove(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: WIDGET_TAB_DRAG,
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DRAG_END with tab target", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = {
        position: new Point(10, 20).toProps(),
        tabId: "t1",
      };
    });
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <DragStarter tabId="t1" />
        <FloatingTab />
      </NineZoneProvider>,
    );
    act(() => {
      fireEvent.pointerUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: WIDGET_TAB_DRAG_END,
      id: "t1",
      target: {
        type: "floatingWidget",
      },
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DRAG_END with floatingWidget target", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = {
        position: new Point(10, 20).toProps(),
        tabId: "t1",
      };
    });
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <DragStarter tabId="t1" target={{
          type: "tab",
          tabIndex: 0,
          widgetId: "w1",
        }} />
        <FloatingTab />
      </NineZoneProvider>,
    );
    act(() => {
      fireEvent.pointerUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: WIDGET_TAB_DRAG_END,
      id: "t1",
      target: {
        type: "tab",
      },
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DRAG_END with panel target", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = {
        position: new Point(10, 20).toProps(),
        tabId: "t1",
      };
    });
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <DragStarter tabId="t1" target={{
          type: "panel",
          side: "left",
        }} />
        <FloatingTab />
      </NineZoneProvider>,
    );
    act(() => {
      fireEvent.pointerUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: WIDGET_TAB_DRAG_END,
      id: "t1",
      target: {
        type: "panel",
      },
    })).should.true;
  });
});
