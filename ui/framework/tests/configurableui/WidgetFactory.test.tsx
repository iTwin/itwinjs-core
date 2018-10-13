/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { AnyWidgetProps, WidgetDefFactory, ToolWidgetDef, NavigationWidgetDef } from "../../src/index";

describe("WidgetFactory", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("appButtonId support", () => {
    const props: AnyWidgetProps = {
      classId: "ToolWidget",
      appButtonId: "SampleApp.BackstageToggle",
      horizontalIds: ["tool1", "tool2", "my-group1"],
      verticalIds: ["item4", "my-group2"],
    };

    const widgetDef = WidgetDefFactory.create(props);

    expect(widgetDef).to.be.instanceof(ToolWidgetDef);
  });

  it("navigationAidId support", () => {
    const props: AnyWidgetProps = {
      classId: "NavigationWidget",
      navigationAidId: "StandardRotationNavigationAid",
      horizontalIds: ["item5", "item6", "item7", "item8"],
    };

    const widgetDef = WidgetDefFactory.create(props);

    expect(widgetDef).to.be.instanceof(NavigationWidgetDef);
  });

});
