/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import {
  createNineZoneState, addPanelWidget, NineZoneProvider, WidgetTabTarget, WidgetIdContext, CursorTypeContext,
} from "../../ui-ninezone";

describe("WidgetTabTarget ", () => {
  it("should render with cursor type", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
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
});
