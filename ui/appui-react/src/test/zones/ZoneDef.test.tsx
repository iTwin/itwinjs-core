/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import { WidgetDef, ZoneDef, ZoneLocation, ZoneState } from "../../appui-react";
import TestUtils from "../TestUtils";

describe("ZoneDef", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("Defaults, widgetDefs & widgetCount", () => {
    const zoneDef = new ZoneDef();
    zoneDef.addWidgetDef(new WidgetDef({
      classId: "Test",
    }));

    expect(zoneDef.applicationData).to.be.undefined;
    expect(zoneDef.widgetDefs).to.have.lengthOf(1);
    expect(zoneDef.widgetCount).to.eq(1);
    expect(zoneDef.getSingleWidgetDef()).to.not.be.undefined;
    expect(zoneDef.isToolSettings).to.be.false;
    expect(zoneDef.isStatusBar).to.be.false;
    expect(zoneDef.allowsMerging).to.be.false;
  });

  it("applicationData, allowsMerging, mergeWithZone", () => {
    const zoneDef = new ZoneDef();
    zoneDef.initializeFromProps({
      defaultState: ZoneState.Open,
      allowsMerging: true,
      applicationData: "AppData",
      mergeWithZone: ZoneLocation.CenterRight,
    });

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

  it("addWidgetDef, widgetDefs & getSingleWidgetDef", () => {
    const zoneDef = new ZoneDef();
    zoneDef.initializeFromProps({
      defaultState: ZoneState.Open,
      allowsMerging: false,
      applicationData: "AppData",
    });

    zoneDef.addWidgetDef(new WidgetDef({
      classId: "Test",
    }));

    zoneDef.addWidgetDef(new WidgetDef({
      id: "IdTest",
      classId: "Test2",
      fillZone: true,
    }));

    expect(zoneDef.widgetDefs).to.have.lengthOf(2);
    expect(zoneDef.getSingleWidgetDef()).to.be.undefined;
    expect(zoneDef.isToolSettings).to.be.false;
    expect(zoneDef.isStatusBar).to.be.false;
    expect(zoneDef.findWidgetDef("IdTest")).to.not.be.undefined;
    expect(zoneDef.shouldFillZone).to.be.true;
  });

});
