/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import TestUtils from "../TestUtils";
import { ZoneDef, ZoneState, WidgetDef, ZoneLocation } from "../../ui-framework";
import { expect } from "chai";

describe("ZoneDef", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("Defaults, widgetDefs & widgetCount", () => {
    const zoneDef = new ZoneDef();
    zoneDef.addWidgetDef(new WidgetDef({
      classId: "Test",
    }));

    expect(zoneDef.applicationData).to.be.undefined;
    expect(zoneDef.widgetDefs).to.have.lengthOf(1);
    expect(zoneDef.widgetCount).to.eq(1);
    expect(zoneDef.getOnlyWidgetDef()).to.not.be.undefined;
    expect(zoneDef.isToolSettings).to.be.false;
    expect(zoneDef.isStatusBar).to.be.false;
    expect(zoneDef.allowsMerging).to.be.false;
  });

  it("applicationData, allowsMerging, mergeWithZone", () => {
    const zoneDef = new ZoneDef();
    zoneDef.zoneState = ZoneState.Open;
    zoneDef.allowsMerging = true;
    zoneDef.applicationData = "AppData";
    zoneDef.mergeWithZone = ZoneLocation.CenterRight;

    zoneDef.addWidgetDef(new WidgetDef({
      classId: "Test",
      isToolSettings: true,
      isStatusBar: true,
    }));

    expect(zoneDef.applicationData).to.eq("AppData");
    expect(zoneDef.mergeWithZone).to.eq(ZoneLocation.CenterRight);
    expect(zoneDef.isToolSettings).to.be.true;
    expect(zoneDef.isStatusBar).to.be.true;
    expect(zoneDef.allowsMerging).to.be.true;
  });

  it("addWidgetDef, widgetDefs & getOnlyWidgetDef", () => {
    const zoneDef = new ZoneDef();
    zoneDef.zoneState = ZoneState.Open;
    zoneDef.allowsMerging = false;
    zoneDef.applicationData = "AppData";

    zoneDef.addWidgetDef(new WidgetDef({
      classId: "Test",
    }));

    zoneDef.addWidgetDef(new WidgetDef({
      id: "IdTest",
      classId: "Test2",
      fillZone: true,
    }));

    expect(zoneDef.widgetDefs).to.have.lengthOf(2);
    expect(zoneDef.getOnlyWidgetDef()).to.be.undefined;
    expect(zoneDef.isToolSettings).to.be.false;
    expect(zoneDef.isStatusBar).to.be.false;
    expect(zoneDef.findWidgetDef("IdTest")).to.not.be.undefined;
    expect(zoneDef.shouldFillZone).to.be.true;
  });

});
