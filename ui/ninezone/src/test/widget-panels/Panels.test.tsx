/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
    nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
    nineZone = addTab(nineZone, "t1");
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
