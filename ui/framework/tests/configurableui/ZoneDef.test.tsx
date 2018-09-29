/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import TestUtils from "../TestUtils";
import { ZoneDef, ZoneState, WidgetDef } from "../../src/index";
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

    expect(zoneDef.isDefaultOpen).to.be.false;
    expect(zoneDef.applicationData).to.be.undefined;
    expect(zoneDef.widgetDefs).to.have.lengthOf(1);
    expect(zoneDef.widgetCount).to.eq(1);
    expect(zoneDef.getOnlyWidgetDef()).to.not.be.undefined;
    expect(zoneDef.isToolSettings).to.be.false;
    expect(zoneDef.isStatusBar).to.be.false;
  });

  it("applicationData", () => {
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

    expect(zoneDef.applicationData).to.eq("AppData");
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
    expect(zoneDef.isDefaultOpen).to.be.true;

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

  it("clearDefaultOpenUsed", () => {
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

    const widgetDef = zoneDef.findWidgetDef("IdTest");
    expect(widgetDef).to.not.be.undefined;
    if (widgetDef)
      widgetDef.defaultOpenUsed = true;

    zoneDef.clearDefaultOpenUsed();
    zoneDef.widgetDefs.map((wd: WidgetDef) => {
      expect(wd.defaultOpenUsed).to.be.false;
    });
  });

});
