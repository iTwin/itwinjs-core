/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render } from "@testing-library/react";
import { addPanelWidget, createNineZoneState, CursorTypeContext, DragManager, PanelSideContext, WidgetTarget } from "../../ui-ninezone";
import { createDragStartArgs, NineZoneProvider } from "../Providers";

describe("WidgetTarget", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

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
    sandbox.stub(document, "elementFromPoint").returns(target);
    act(() => {
      dragManager.current!.handleDragStart(createDragStartArgs());
      fireEvent.mouseMove(target);
    });
    container.firstChild!.should.matchSnapshot();
  });
});
