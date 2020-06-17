/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { addPanelWidget, createNineZoneState, PanelWidget } from "../../ui-ninezone";
import { NineZoneProvider } from "../Providers";

describe("PanelWidget", () => {
  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <PanelWidget widgetId="w1" />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render minimized", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { minimized: true });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <PanelWidget widgetId="w1" />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
