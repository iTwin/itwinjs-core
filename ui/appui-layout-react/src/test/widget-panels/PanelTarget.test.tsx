/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { act, fireEvent, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import produce from "immer";
import * as React from "react";
import * as sinon from "sinon";
import type { DragManager} from "../../appui-layout-react";
import {
  addPanelWidget, addTab, createDraggedTabState, createNineZoneState, CursorTypeContext, PanelStateContext,
  PanelTarget, useAllowedPanelTarget,
} from "../../appui-layout-react";
import { createDragItemInfo, createDragStartArgs, TestNineZoneProvider } from "../Providers";

describe("PanelTarget", () => {
  it("should render targeted", () => {
    const dragManager = React.createRef<DragManager>();
    const nineZone = createNineZoneState();
    const { container } = render(
      <TestNineZoneProvider
        dragManagerRef={dragManager}
        state={nineZone}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <PanelTarget />
        </PanelStateContext.Provider>
      </TestNineZoneProvider>,
    );
    const target = container.getElementsByClassName("nz-widgetPanels-panelTarget")[0];
    sinon.stub(document, "elementFromPoint").returns(target);
    act(() => {
      dragManager.current!.handleDragStart(createDragStartArgs());
      fireEvent.mouseMove(target);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should render cursor type", () => {
    const dragManager = React.createRef<DragManager>();
    const nineZone = createNineZoneState();
    const { container } = render(
      <TestNineZoneProvider
        dragManagerRef={dragManager}
        state={nineZone}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <CursorTypeContext.Provider value="grabbing">
            <PanelTarget />
          </CursorTypeContext.Provider>
        </PanelStateContext.Provider>
      </TestNineZoneProvider>,
    );
    const target = container.getElementsByClassName("nz-widgetPanels-panelTarget")[0];
    sinon.stub(document, "elementFromPoint").returns(target);
    act(() => {
      dragManager.current!.handleDragStart(createDragStartArgs());
      fireEvent.mouseMove(target);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should render hidden when dragged tab doesn't allow panel target", () => {
    const dragManager = React.createRef<DragManager>();
    let nineZone = createNineZoneState();
    nineZone = addTab(nineZone, "t1", {
      allowedPanelTargets: ["top", "right", "bottom"],
    });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = createDraggedTabState("t1");
    });
    const { container } = render(
      <TestNineZoneProvider
        dragManagerRef={dragManager}
        state={nineZone}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <PanelTarget />
        </PanelStateContext.Provider>
      </TestNineZoneProvider>,
    );
    const target = container.getElementsByClassName("nz-widgetPanels-panelTarget")[0];
    sinon.stub(document, "elementFromPoint").returns(target);
    act(() => {
      dragManager.current!.handleDragStart(createDragStartArgs());
      fireEvent.mouseMove(target);
    });

    target.classList.contains("nz-hidden").should.true;
  });
});

describe("useAllowedPanelTarget", () => {
  describe("dragged tab", () => {
    it("should return true when allowedPanelTargets is undefined", () => {
      let nineZone = createNineZoneState();
      nineZone = addTab(nineZone, "t1");
      nineZone = produce(nineZone, (draft) => {
        draft.draggedTab = createDraggedTabState("t1");
      });
      const { result } = renderHook(() => useAllowedPanelTarget(), {
        wrapper: (props) => <TestNineZoneProvider // eslint-disable-line react/display-name
          state={nineZone}
        >
          <PanelStateContext.Provider value={nineZone.panels.left} {...props} />
        </TestNineZoneProvider>,
      });
      result.current.should.true;
    });
  });

  describe("dragged widget", () => {
    it("should return true when allowedPanelTargets of active tab is undefined", () => {
      const dragManager = React.createRef<DragManager>();
      let nineZone = createNineZoneState();
      nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
      nineZone = addTab(nineZone, "t1");
      const { result } = renderHook(() => useAllowedPanelTarget(), {
        wrapper: (props) => <TestNineZoneProvider // eslint-disable-line react/display-name
          dragManagerRef={dragManager}
          state={nineZone}
        >
          <PanelStateContext.Provider value={nineZone.panels.left} {...props} />
        </TestNineZoneProvider>,
      });

      dragManager.current!.handleDragStart({
        info: createDragItemInfo(),
        item: {
          type: "widget",
          id: "w1",
        },
      });
      result.current.should.true;
    });

    it("should return false when allowedPanelTargets of active tab has no panel side", () => {
      const dragManager = React.createRef<DragManager>();
      let nineZone = createNineZoneState();
      nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
      nineZone = addTab(nineZone, "t1", { allowedPanelTargets: ["top", "right", "bottom"] });
      const { result } = renderHook(() => useAllowedPanelTarget(), {
        wrapper: (props) => <TestNineZoneProvider // eslint-disable-line react/display-name
          dragManagerRef={dragManager}
          state={nineZone}
        >
          <PanelStateContext.Provider value={nineZone.panels.left} {...props} />
        </TestNineZoneProvider>,
      });

      dragManager.current!.handleDragStart({
        info: createDragItemInfo(),
        item: {
          type: "widget",
          id: "w1",
        },
      });
      result.current.should.false;
    });
  });
});
