/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { addPanelWidget, addTab, createNineZoneState, CursorTypeContext, DraggedWidgetIdContext, DragManager, WidgetIdContext, WidgetTabTarget } from "../../appui-layout-react";
import { createDragStartArgs, TestNineZoneProvider } from "../Providers";

describe("WidgetTabTarget ", () => {
  it("should render with cursor type", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <WidgetIdContext.Provider value="w1">
          <CursorTypeContext.Provider value="grabbing">
            <WidgetTabTarget tabIndex={0} />
          </CursorTypeContext.Provider>
        </WidgetIdContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render hidden in dragged widget", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
      >
        <DraggedWidgetIdContext.Provider value="w1">
          <WidgetIdContext.Provider value="w1">
            <WidgetTabTarget tabIndex={0} />
          </WidgetIdContext.Provider>
        </DraggedWidgetIdContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render targeted", () => {
    const dragManager = React.createRef<DragManager>();
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={state}
        dragManagerRef={dragManager}
      >
        <WidgetIdContext.Provider value="w1">
          <WidgetTabTarget tabIndex={0} />
        </WidgetIdContext.Provider>
      </TestNineZoneProvider>,
    );

    const target = container.getElementsByClassName("nz-widget-tabTarget")[0];
    sinon.stub(document, "elementFromPoint").returns(target);
    dragManager.current!.handleDragStart(createDragStartArgs());
    fireEvent.mouseMove(target);

    Array.from(target.classList.values()).should.contain("nz-targeted");
  });
});
