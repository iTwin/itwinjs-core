/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { WidgetState } from "@bentley/ui-abstract";
import { ConfigurableCreateInfo, ConfigurableUiControlType, WidgetControl, WidgetDef, WidgetProps } from "../../ui-framework.js";
import TestUtils from "../TestUtils.js";

describe("WidgetControl", () => {

  class TestWidget extends WidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div />;
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  const widgetProps: WidgetProps = {
    id: "test-widget",
    classId: TestWidget,
    defaultState: WidgetState.Hidden,
  };

  it("registerControl & widgetControl using same classId", () => {
    const widgetDef: WidgetDef = new WidgetDef(widgetProps);
    const widgetControl = widgetDef.getWidgetControl(ConfigurableUiControlType.Widget);

    expect(widgetControl).to.not.be.undefined;
    if (widgetControl) {
      expect(widgetControl.widgetDef).to.eq(widgetDef);

      const testId = "test-widget";
      expect(widgetControl.uniqueId).to.eq(testId);
      expect(widgetControl.name).to.eq(testId);
      expect(widgetControl.controlId).to.eq(testId);
    }
  });

  it("setWidgetState", () => {
    const widgetDef: WidgetDef = new WidgetDef(widgetProps);
    const widgetControl = widgetDef.getWidgetControl(ConfigurableUiControlType.Widget);

    expect(widgetControl).to.not.be.undefined;
    if (widgetControl) {
      expect(widgetDef.isActive).to.eq(false);
      widgetControl.setWidgetState(WidgetState.Open);
      expect(widgetDef.isVisible).to.eq(true);
      expect(widgetDef.isActive).to.eq(true);
    }
  });

});
