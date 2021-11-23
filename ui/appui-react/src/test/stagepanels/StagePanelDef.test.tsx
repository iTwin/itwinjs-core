/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import * as React from "react";
import { expect } from "chai";
import produce from "immer";
import * as sinon from "sinon";
import { FrontstageManager, setPanelSize, StagePanelDef, StagePanelState, StagePanelZoneDef, StagePanelZonesDef, toPanelSide, UiFramework, Widget, WidgetDef } from "../../appui-react";
import TestUtils from "../TestUtils";
import { StagePanelLocation } from "@itwin/appui-abstract";
import { createNineZoneState } from "@itwin/appui-layout-react";
import { FrontstageDef } from "../../appui-react/frontstage/FrontstageDef";

describe("StagePanelDef", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("Defaults, widgetDefs & widgetCount", () => {
    const panelDef = new StagePanelDef();
    panelDef.addWidgetDef(new WidgetDef({
      classId: "Test",
    }));

    expect(panelDef.applicationData).to.be.undefined;
    expect(panelDef.widgetDefs).to.have.lengthOf(1);
    expect(panelDef.widgetCount).to.eq(1);
    expect(panelDef.getSingleWidgetDef()).to.not.be.undefined;
  });

  it("applicationData", () => {
    const panelDef = new StagePanelDef();
    panelDef.panelState = StagePanelState.Open;
    panelDef.initializeFromProps({ resizable: false, applicationData: "AppData" });
    expect(panelDef.applicationData).to.eq("AppData");
  });

  it("should emit onPanelStateChangedEvent", () => {
    const spy = sinon.spy();
    FrontstageManager.onPanelStateChangedEvent.addListener(spy);
    const panelDef = new StagePanelDef();
    panelDef.panelState = StagePanelState.Minimized;
    expect(spy).to.be.calledOnceWithExactly(sinon.match({ panelDef, panelState: StagePanelState.Minimized }));
  });

  it("should default to Open state", () => {
    const panelDef = new StagePanelDef();
    expect(panelDef.panelState).to.eq(StagePanelState.Open);
  });

  it("should initialize panel zones", () => {
    const panelDef = new StagePanelDef();
    panelDef.initializeFromProps({ resizable: false, panelZones: {} });
    expect(panelDef.panelZones).to.exist;
  });

  it("should initialize pinned", () => {
    const panelDef = new StagePanelDef();
    panelDef.initializeFromProps({ resizable: false, pinned: false });
    expect(panelDef.pinned).to.false;
  });

  it("should emit onPanelSizeChangedEvent", () => {
    const spy = sinon.spy();
    FrontstageManager.onPanelSizeChangedEvent.addListener(spy);
    const panelDef = new StagePanelDef();
    panelDef.size = 200;
    expect(spy).to.be.calledOnceWithExactly(sinon.match({ panelDef, size: 200 }));
  });

  it("should respect min/max size", () => {
    const frontstageDef = new FrontstageDef();
    const nineZoneState = createNineZoneState();
    frontstageDef.nineZoneState = nineZoneState;
    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    const panelDef = new StagePanelDef();
    panelDef.size = 150;
    panelDef.size.should.eq(200);
  });

  it("should not invoke onPanelSizeChangedEvent", () => {
    const frontstageDef = new FrontstageDef();
    const nineZoneState = createNineZoneState();
    frontstageDef.nineZoneState = nineZoneState;
    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    const panelDef = new StagePanelDef();
    panelDef.size = 200;
    panelDef.size.should.eq(200);

    const spy = sinon.spy(FrontstageManager.onPanelSizeChangedEvent, "emit");
    panelDef.size = 150;
    panelDef.size.should.eq(200);
    sinon.assert.notCalled(spy);
  });

  it("should collapse panel when panelState is Minimized", () => {
    const frontstageDef = new FrontstageDef();
    const nineZoneState = createNineZoneState();
    frontstageDef.nineZoneState = nineZoneState;
    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    const panelDef = new StagePanelDef();
    sinon.stub(panelDef, "location").get(() => StagePanelLocation.Right);
    panelDef.panelState = StagePanelState.Minimized;

    frontstageDef.nineZoneState.panels.right.collapsed.should.true;
  });

  it("should collapse panel when panelState is Off", () => {
    const frontstageDef = new FrontstageDef();
    const nineZoneState = createNineZoneState();
    frontstageDef.nineZoneState = nineZoneState;
    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    const panelDef = new StagePanelDef();
    sinon.stub(panelDef, "location").get(() => StagePanelLocation.Right);
    panelDef.panelState = StagePanelState.Off;

    frontstageDef.nineZoneState.panels.right.collapsed.should.true;
  });

  it("should expand panel when panelState is Open", () => {
    const frontstageDef = new FrontstageDef();
    const nineZoneState = produce(createNineZoneState(), (draft) => {
      draft.panels.right.collapsed = true;
    });
    frontstageDef.nineZoneState = nineZoneState;
    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    const panelDef = new StagePanelDef();
    panelDef.initializeFromProps({
      resizable: true,
      defaultState: StagePanelState.Minimized,
    });
    sinon.stub(panelDef, "location").get(() => StagePanelLocation.Right);
    panelDef.panelState = StagePanelState.Open;

    frontstageDef.nineZoneState.panels.right.collapsed.should.false;
  });

  it("should returns panel zone widgets", () => {
    const panelDef = new StagePanelDef();
    const panelZonesDef = new StagePanelZonesDef();
    const start = new StagePanelZoneDef();
    const end = new StagePanelZoneDef();
    const s1 = new WidgetDef({});
    const e1 = new WidgetDef({});
    const e2 = new WidgetDef({});
    sinon.stub(panelZonesDef, "start").get(() => start);
    sinon.stub(panelZonesDef, "end").get(() => end);

    sinon.stub(start, "widgetDefs").get(() => [s1]);
    sinon.stub(end, "widgetDefs").get(() => [e1, e2]);

    sinon.stub(panelDef, "panelZones").get(() => panelZonesDef);
    panelDef.widgetDefs.should.eql([s1, e1, e2]);
  });
});

describe("StagePanelZonesDef", () => {
  it("should initialize start", () => {
    const sut = new StagePanelZonesDef();
    sut.initializeFromProps({ start: { widgets: [<Widget key="w1" id="w1" />] } }, StagePanelLocation.Left);
    expect(sut.start.widgetCount).to.eq(1);
  });

  it("should initialize middle", () => {
    const sut = new StagePanelZonesDef();
    sut.initializeFromProps({ middle: { widgets: [<Widget key="w1" id="w1" />] } }, StagePanelLocation.Left);
    expect(sut.middle.widgetCount).to.eq(1);
  });

  it("should initialize end", () => {
    const sut = new StagePanelZonesDef();
    sut.initializeFromProps({ end: { widgets: [<Widget key="w1" id="w1" />] } }, StagePanelLocation.Left);
    expect(sut.end.widgetCount).to.eq(1);
  });
});

describe("StagePanelZoneDef", () => {
  it("should initialize stable widgets", () => {
    const sut = new StagePanelZoneDef();
    sut.initializeFromProps({ widgets: [<Widget />] }, StagePanelLocation.Left, "start"); // eslint-disable-line react/jsx-key
    expect(sut.widgetCount).to.eq(1);
    expect(sut.widgetDefs[0].id).to.eq("uifw-spz-Left-start-0");
  });
});

describe("toPanelSide", () => {
  it("should return 'left'", () => {
    toPanelSide(StagePanelLocation.Left).should.eq("left");
  });

  it("should return 'right'", () => {
    toPanelSide(StagePanelLocation.Right).should.eq("right");
  });

  it("should return 'bottom'", () => {
    toPanelSide(StagePanelLocation.Bottom).should.eq("bottom");
  });

  it("should return 'bottom'", () => {
    toPanelSide(StagePanelLocation.BottomMost).should.eq("bottom");
  });

  it("should return 'top'", () => {
    toPanelSide(StagePanelLocation.Top).should.eq("top");
  });

  it("should return 'top'", () => {
    toPanelSide(StagePanelLocation.TopMost).should.eq("top");
  });
});

describe("setPanelSize", () => {
  it("should reset size", () => {
    let nineZone = createNineZoneState();
    nineZone = produce(nineZone, (draft) => {
      draft.panels.left.size = 200;
    });
    const sut = setPanelSize(nineZone, "left", undefined);
    (sut.panels.left.size === undefined).should.true;
  });
});
