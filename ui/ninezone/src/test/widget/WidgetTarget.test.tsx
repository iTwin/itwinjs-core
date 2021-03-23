/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import tlr from "@testing-library/react"; const { act, fireEvent, render } = tlr;
import { addPanelWidget, createNineZoneState, CursorTypeContext, DragManager, PanelSideContext, WidgetTarget } from "../../ui-ninezone.js";
import { createDragStartArgs, NineZoneProvider } from "../Providers.js";

describe("WidgetTarget", () => {
  it("should render with cursor type", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    const { container } = render(
      <NineZoneProvider
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
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render targeted", () => {
    const dragManager = React.createRef<DragManager>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
        dragManagerRef={dragManager}
      >
        <PanelSideContext.Provider value="left">
          <WidgetTarget
            widgetIndex={0}
          />
        </PanelSideContext.Provider>
      </NineZoneProvider>,
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
