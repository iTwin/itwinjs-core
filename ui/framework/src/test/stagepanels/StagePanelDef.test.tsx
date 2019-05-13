/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import TestUtils from "../TestUtils";
import { StagePanelDef, StagePanelState, WidgetDef } from "../../ui-framework";
import { expect } from "chai";

describe("StagePanelDef", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
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
    panelDef.applicationData = "AppData";
    expect(panelDef.applicationData).to.eq("AppData");
  });

});
