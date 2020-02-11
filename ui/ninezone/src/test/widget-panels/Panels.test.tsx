/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, render } from "@testing-library/react";
import { WidgetPanels, NineZoneContext, createNineZoneState, addPanelWidget } from "../../ui-ninezone";
import { StartResize, Resize, EndResize } from "./Grip.test";
import { NineZoneDispatchContext, NineZoneDispatch } from "../../ui-ninezone/base/NineZone";

describe("WidgetPanels", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const nineZone = createNineZoneState();
    const { container } = render(
      <NineZoneContext.Provider value={nineZone}>
        <WidgetPanels />
      </NineZoneContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render grip overlay", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    render(
      <NineZoneDispatchContext.Provider value={sinon.stub<NineZoneDispatch>()}>
        <NineZoneContext.Provider value={nineZone}>
          <WidgetPanels />
        </NineZoneContext.Provider>
      </NineZoneDispatchContext.Provider>,
    );
    document.getElementsByClassName("nz-widgetPanels-gripOverlay").length.should.eq(0);

    const grip = document.getElementsByClassName("nz-widgetPanels-grip nz-left")[0];
    act(() => {
      StartResize(grip);
      Resize(1, 1);
    });
    document.getElementsByClassName("nz-widgetPanels-gripOverlay").length.should.eq(1);

    act(() => {
      EndResize();
    });
    document.getElementsByClassName("nz-widgetPanels-gripOverlay").length.should.eq(0);
  });
});
