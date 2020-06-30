/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { addPanelWidget, createNineZoneState, CursorTypeContext, DraggedWidgetIdContext, WidgetIdContext, WidgetTabTarget } from "../../ui-ninezone";
import { NineZoneProvider } from "../Providers";

describe("WidgetTabTarget ", () => {
  it("should render with cursor type", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <WidgetIdContext.Provider value="w1">
          <CursorTypeContext.Provider value="grabbing">
            <WidgetTabTarget tabIndex={0} />
          </CursorTypeContext.Provider>
        </WidgetIdContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render hidden in dragged widget", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <DraggedWidgetIdContext.Provider value="w1">
          <WidgetIdContext.Provider value="w1">
            <WidgetTabTarget tabIndex={0} />
          </WidgetIdContext.Provider>
        </DraggedWidgetIdContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
