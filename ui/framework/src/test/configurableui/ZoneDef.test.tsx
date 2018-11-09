/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import TestUtils from "../TestUtils";
import { ZoneDef, ZoneState, WidgetDef, ZoneLocation } from "../../index";
import { expect } from "chai";

describe("ZoneDef", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("Defaults, widgetDefs & widgetCount", () => {
    const zoneDef = new ZoneDef(
      {
        defaultState: ZoneState.Minimized,
        allowsMerging: false,
        widgetProps: [
          {
            classId: "Test",
          },
        ],
      },
    );

    expect(zoneDef.applicationData).to.be.undefined;
    expect(zoneDef.widgetDefs).to.have.lengthOf(1);
    expect(zoneDef.widgetCount).to.eq(1);
    expect(zoneDef.getOnlyWidgetDef()).to.not.be.undefined;
    expect(zoneDef.isToolSettings).to.be.false;
    expect(zoneDef.isStatusBar).to.be.false;
    expect(zoneDef.allowsMerging).to.be.false;
  });

  it("applicationData, allowsMerging, mergeWithZone", () => {
    const zoneDef = new ZoneDef(
      {
        defaultState: ZoneState.Open,
        allowsMerging: true,
        applicationData: "AppData",
        mergeWithZone: ZoneLocation.CenterRight,
        widgetProps: [
          {
            classId: "Test",
            isToolSettings: true,
            isStatusBar: true,
          },
        ],
      },
    );

    expect(zoneDef.applicationData).to.eq("AppData");
    expect(zoneDef.mergeWithZone).to.eq(ZoneLocation.CenterRight);
    expect(zoneDef.isToolSettings).to.be.true;
    expect(zoneDef.isStatusBar).to.be.true;
    expect(zoneDef.allowsMerging).to.be.true;
  });

  it("addWidgetDef, widgetDefs & getOnlyWidgetDef", () => {
    const zoneDef = new ZoneDef(
      {
        defaultState: ZoneState.Open,
        allowsMerging: false,
        applicationData: "AppData",
        widgetProps: [
          {
            classId: "Test",
          },
        ],
      },
    );

    zoneDef.addWidgetDef(new WidgetDef({
      classId: "Test2",
    }));

    expect(zoneDef.widgetDefs).to.have.lengthOf(2);
    expect(zoneDef.getOnlyWidgetDef()).to.be.undefined;
    expect(zoneDef.isToolSettings).to.be.false;
    expect(zoneDef.isStatusBar).to.be.false;
  });

  it("findWidgetDef", () => {
    const zoneDef = new ZoneDef(
      {
        defaultState: ZoneState.Open,
        allowsMerging: false,
        applicationData: "AppData",
        widgetProps: [
          {
            id: "IdTest",
            classId: "Test",
          },
        ],
      },
    );

    expect(zoneDef.findWidgetDef("IdTest")).to.not.be.undefined;
  });

});
