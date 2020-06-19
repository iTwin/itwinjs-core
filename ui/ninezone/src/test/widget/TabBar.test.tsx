/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import produce from "immer";
import * as React from "react";
import * as sinon from "sinon";
import { Rectangle } from "@bentley/ui-core";
import { act, fireEvent, render } from "@testing-library/react";
import {
  addPanelWidget, createNineZoneState, FloatingWidget, NineZoneDispatch, PanelStateContext, PanelTarget, useDrag, WidgetIdContext,
  WidgetTabTarget,
} from "../../ui-ninezone";
import * as NineZoneModule from "../../ui-ninezone/base/NineZone";
import { NineZoneProvider } from "../Providers";
import { renderHook } from "@testing-library/react-hooks";

describe("WidgetTitleBar", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should dispatch WIDGET_DRAG_END", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.widgets = [];
      stateDraft.floatingWidgets.byId.w1 = {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
        id: "w1",
      };
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
      </NineZoneProvider>,
    );
    const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
    const handle = titleBar.getElementsByClassName("nz-handle")[0];
    act(() => {
      fireEvent.pointerDown(handle);
      fireEvent.pointerMove(document);
      dispatch.reset();
      fireEvent.pointerUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_DRAG_END",
      floatingWidgetId: "w1",
      target: {
        type: "floatingWidget",
      },
    })).should.true;
  });

  it("should dispatch WIDGET_DRAG_END with tab target", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addPanelWidget(nineZone, "left", "w2");
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.widgets = [];
      stateDraft.floatingWidgets.byId.w1 = {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
        id: "w1",
      };
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
        <WidgetIdContext.Provider value="w2">
          <WidgetTabTarget tabIndex={0} first />
        </WidgetIdContext.Provider>
      </NineZoneProvider>,
    );
    const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
    const handle = titleBar.getElementsByClassName("nz-handle")[0];
    const target = container.getElementsByClassName("nz-widget-tabTarget")[0];
    sandbox.stub(document, "elementFromPoint").returns(target);
    act(() => {
      fireEvent.pointerDown(handle);
      fireEvent.pointerMove(target);
      dispatch.reset();
      fireEvent.pointerUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_DRAG_END",
      floatingWidgetId: "w1",
      target: {
        tabIndex: 0,
        type: "tab",
        widgetId: "w2",
      },
    })).should.true;
  });

  it("should dispatch WIDGET_DRAG_END with panel target", () => {
    sandbox.stub(NineZoneModule, "getUniqueId").returns("newId");
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = produce(nineZone, (stateDraft) => {
      stateDraft.panels.left.widgets = [];
      stateDraft.floatingWidgets.byId.w1 = {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
        id: "w1",
      };
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
      >
        <FloatingWidget
          floatingWidget={nineZone.floatingWidgets.byId.w1!}
          widget={nineZone.widgets.w1}
        />
        <PanelStateContext.Provider value={nineZone.panels.right}>
          <PanelTarget />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const titleBar = container.getElementsByClassName("nz-widget-tabBar")[0];
    const handle = titleBar.getElementsByClassName("nz-handle")[0];
    const target = container.getElementsByClassName("nz-widgetPanels-panelTarget")[0];
    sandbox.stub(document, "elementFromPoint").returns(target);
    act(() => {
      fireEvent.pointerDown(handle);
      fireEvent.pointerMove(target);
      dispatch.reset();
      fireEvent.pointerUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_DRAG_END",
      floatingWidgetId: "w1",
      target: {
        newWidgetId: "newId",
        side: "right",
        type: "panel",
      },
    })).should.true;
  });
});

describe("useDrag", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should start drag action after timeout", () => {
    const fakeTimers = sandbox.useFakeTimers();
    const spy = sinon.stub<Parameters<typeof useDrag>[0]>();
    const { result } = renderHook(() => useDrag(spy));
    act(() => {
      const instance = document.createElement("div");
      result.current(instance);
      fireEvent.pointerDown(instance);
      fakeTimers.tick(300);
    });
    spy.calledOnce.should.true;
  });
});
