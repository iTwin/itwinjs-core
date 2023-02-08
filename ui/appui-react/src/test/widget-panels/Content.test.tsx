/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { addPanelWidget, addTab, createNineZoneState, NineZoneProvider, WidgetStateContext } from "@itwin/appui-layout-react";
import { Rectangle } from "@itwin/core-react";
import { FrontstageDef, UiFramework, WidgetContent, WidgetDef } from "../../appui-react";
import TestUtils from "../TestUtils";

describe("WidgetContent", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addTab(nineZone, "w1");
    nineZone = addPanelWidget(nineZone, "left", "leftStart", ["w1"]);
    const frontstage = new FrontstageDef();
    const widget = new WidgetDef({ // eslint-disable-line deprecation/deprecation
      id: "w1",
    });
    sinon.stub(UiFramework.frontstages, "activeFrontstageDef").get(() => frontstage);
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
    nineZone = addTab(nineZone, "w1");
    nineZone = addPanelWidget(nineZone, "left", "leftStart", ["w1"]);
    sinon.stub(UiFramework.frontstages, "activeFrontstageDef").get(() => undefined);
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
    nineZone = addTab(nineZone, "w1");
    nineZone = addPanelWidget(nineZone, "left", "leftStart", ["w1"]);
    const frontstage = new FrontstageDef();
    sinon.stub(UiFramework.frontstages, "activeFrontstageDef").get(() => frontstage);
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
