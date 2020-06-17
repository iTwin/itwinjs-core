/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { addPanelWidget, addTab, createNineZoneState, WidgetPanels } from "../../ui-ninezone";
import { NineZoneProvider } from "../Providers";

describe("WidgetPanels", () => {
  it("should render", () => {
    const { container } = render(
      <NineZoneProvider>
        <WidgetPanels />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render widget content", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
    nineZone = addTab(nineZone, "w1", "t1");
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        widgetContent={<div>Hello World!</div>}
      >
        <WidgetPanels />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
