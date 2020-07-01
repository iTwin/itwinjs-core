/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render } from "@testing-library/react";
import { createNineZoneState, CursorTypeContext, DragManager, PanelStateContext, PanelTarget } from "../../ui-ninezone";
import { createDragStartArgs, NineZoneProvider } from "../Providers";

describe("PanelTarget", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render targeted", () => {
    const dragManager = React.createRef<DragManager>();
    const nineZone = createNineZoneState();
    const { container } = render(
      <NineZoneProvider
        dragManagerRef={dragManager}
        state={nineZone}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <PanelTarget />
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const target = container.getElementsByClassName("nz-widgetPanels-panelTarget")[0];
    sandbox.stub(document, "elementFromPoint").returns(target);
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
      <NineZoneProvider
        dragManagerRef={dragManager}
        state={nineZone}
      >
        <PanelStateContext.Provider value={nineZone.panels.left}>
          <CursorTypeContext.Provider value="grabbing">
            <PanelTarget />
          </CursorTypeContext.Provider>
        </PanelStateContext.Provider>
      </NineZoneProvider>,
    );
    const target = container.getElementsByClassName("nz-widgetPanels-panelTarget")[0];
    sandbox.stub(document, "elementFromPoint").returns(target);
    act(() => {
      dragManager.current!.handleDragStart(createDragStartArgs());
      fireEvent.mouseMove(target);
    });
    container.firstChild!.should.matchSnapshot();
  });
});
