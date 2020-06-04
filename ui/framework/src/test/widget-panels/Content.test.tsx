/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { addPanelWidget, createNineZoneState, NineZoneProvider, WidgetStateContext } from "@bentley/ui-ninezone";
import { render } from "@testing-library/react";
import { FrontstageDef, FrontstageManager, WidgetContent } from "../../ui-framework";
import { WidgetDef } from "../../ui-framework/widgets/WidgetDef";
import { Rectangle } from "@bentley/ui-core";

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
        dispatch={sinon.stub()}
        state={nineZone}
        measure={() => new Rectangle()}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.leftStart}>
          <WidgetContent />
        </WidgetStateContext.Provider>
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render w/o frontstage", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "leftStart", { activeTabId: "w1" });
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const { container } = render(
      <NineZoneProvider
        dispatch={sinon.stub()}
        state={nineZone}
        measure={() => new Rectangle()}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.leftStart}>
          <WidgetContent />
        </WidgetStateContext.Provider>
      </NineZoneProvider>,
    );
    (container.firstChild === null)!.should.true;
  });

  it("should render w/o widgetDef", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "leftStart", { activeTabId: "w1" });
    const frontstage = new FrontstageDef();
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstage);
    sandbox.stub(frontstage, "findWidgetDef").returns(undefined);
    const { container } = render(
      <NineZoneProvider
        dispatch={sinon.stub()}
        state={nineZone}
        measure={() => new Rectangle()}
      >
        <WidgetStateContext.Provider value={nineZone.widgets.leftStart}>
          <WidgetContent />
        </WidgetStateContext.Provider>
      </NineZoneProvider>,
    );
    (container.firstChild === null).should.true;
  });
});
