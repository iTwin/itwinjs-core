/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { addPanelWidget, createNineZoneState, NineZoneProvider, WidgetStateContext } from "@bentley/ui-ninezone";
import { Rectangle } from "@bentley/ui-core";
import { FrontstageDef, FrontstageManager, WidgetContent, WidgetDef } from "../../ui-framework";

describe("WidgetContent", () => {
  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "leftStart", ["w1"]);
    const frontstage = new FrontstageDef();
    const widget = new WidgetDef({
      id: "w1",
    });
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstage);
    sinon.stub(frontstage, "findWidgetDef").returns(widget);
    sinon.stub(widget, "reactNode").get(() => <>Content</>);
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
    nineZone = addPanelWidget(nineZone, "left", "leftStart", ["w1"]);
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
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

  it("should render w/o widgetDef", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "leftStart", ["w1"]);
    const frontstage = new FrontstageDef();
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstage);
    sinon.stub(frontstage, "findWidgetDef").returns(undefined);
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
});
