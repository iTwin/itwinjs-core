/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render } from "@testing-library/react";
import type { DragManager} from "../../appui-layout-react";
import { addPanelWidget, createNineZoneState, CursorTypeContext, PanelSideContext, WidgetTarget } from "../../appui-layout-react";
import { createDragStartArgs, TestNineZoneProvider } from "../Providers";

describe("WidgetTarget", () => {
  it("should render with cursor type", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
        <PanelSideContext.Provider value="left">
          <CursorTypeContext.Provider value="grabbing">
            <WidgetTarget
              widgetIndex={0}
            />
          </CursorTypeContext.Provider>
        </PanelSideContext.Provider>
      </TestNineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render targeted", () => {
    const dragManager = React.createRef<DragManager>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    const { container } = render(
      <TestNineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
        dragManagerRef={dragManager}
      >
        <PanelSideContext.Provider value="left">
          <WidgetTarget
            widgetIndex={0}
          />
        </PanelSideContext.Provider>
      </TestNineZoneProvider>,
    );
    const target = container.getElementsByClassName("nz-widget-widgetTarget")[0];
    sinon.stub(document, "elementFromPoint").returns(target);
    act(() => {
      dragManager.current!.handleDragStart(createDragStartArgs());
      fireEvent.mouseMove(target);
    });
    container.firstChild!.should.matchSnapshot();
  });
});
