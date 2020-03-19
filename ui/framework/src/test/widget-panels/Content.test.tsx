/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { NineZoneProvider, NineZoneDispatch, createNineZoneState, addPanelWidget, WidgetStateContext } from "@bentley/ui-ninezone";
import { render } from "@testing-library/react";
import { WidgetContent, FrontstageManager, FrontstageDef } from "../../ui-framework";
import { WidgetDef } from "../../ui-framework/widgets/WidgetDef";

describe("WidgetContent", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "leftStart", { activeTabId: "w1" });
    const frontstage = new FrontstageDef();
    const widget = new WidgetDef({
      id: "w1",
    });
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstage);
    sandbox.stub(frontstage, "findWidgetDef").returns(widget);
    sandbox.stub(widget, "reactNode").get(() => <>Content</>);
    const { container } = render(
      <NineZoneProvider
        dispatch={sinon.stub<NineZoneDispatch>()}
        state={nineZone}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.leftStart}>
          <WidgetContent />
        </WidgetStateContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
