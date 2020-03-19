/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { WidgetPanels, createNineZoneState, NineZoneProvider } from "../../ui-ninezone";
import { addPanelWidget, addTab } from "../../ui-ninezone/base/NineZoneState";

describe("WidgetPanels", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const nineZone = createNineZoneState();
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
        dispatch={sinon.spy()}
      >
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
        dispatch={sinon.spy()}
      >
        <WidgetPanels widgetContent={<div>Hello World!</div>} />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
