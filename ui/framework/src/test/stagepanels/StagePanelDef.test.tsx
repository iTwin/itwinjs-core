/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import produce from "immer";
import * as sinon from "sinon";
import { FrontstageManager, setPanelSize, StagePanelDef, StagePanelState, StagePanelZoneDef, StagePanelZonesDef, toPanelSide, Widget, WidgetDef } from "../../ui-framework";
import TestUtils from "../TestUtils";
import { StagePanelLocation } from "@bentley/ui-abstract";
import { createNineZoneState } from "@bentley/ui-ninezone";

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
});

describe("StagePanelZonesDef", () => {
  it("should initialize start", () => {
    const sut = new StagePanelZonesDef();
    sut.initializeFromProps({ start: { widgets: [] } }, StagePanelLocation.Left);
    expect(sut.start).to.exist;
  });

  it("should initialize middle", () => {
    const sut = new StagePanelZonesDef();
    sut.initializeFromProps({ middle: { widgets: [] } }, StagePanelLocation.Left);
    expect(sut.middle).to.exist;
  });

  it("should initialize end", () => {
    const sut = new StagePanelZonesDef();
    sut.initializeFromProps({ end: { widgets: [] } }, StagePanelLocation.Left);
    expect(sut.end).to.exist;
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
