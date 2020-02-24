/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { WidgetComponent, WidgetPanelContext, NineZoneContext, createNineZoneState } from "../../ui-ninezone";
import { addPanelWidget } from "../../ui-ninezone/base/NineZone";

describe("WidgetComponent", () => {
  it("should render minimized", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { minimized: true });
    const { container } = render(
      <NineZoneContext.Provider
        value={nineZone}
      >
        <WidgetPanelContext.Provider
          value="left"
        >
          <WidgetComponent
            id="w1"
          />
        </WidgetPanelContext.Provider>
      </NineZoneContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
