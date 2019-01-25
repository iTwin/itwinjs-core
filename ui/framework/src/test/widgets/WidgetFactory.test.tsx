/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { AnyWidgetProps, WidgetDefFactory, ToolWidgetDef, NavigationWidgetDef, WidgetDef } from "../../ui-framework";

describe("WidgetFactory", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("appButton support", () => {
    const props: AnyWidgetProps = {
      classId: "ToolWidget",
      appButton: undefined,
    };

    const widgetDef = WidgetDefFactory.create(props);

    expect(widgetDef).to.be.instanceof(ToolWidgetDef);
  });

  it("navigationAidId support", () => {
    const props: AnyWidgetProps = {
      classId: "NavigationWidget",
      navigationAidId: "StandardRotationNavigationAid",
    };

    const widgetDef = WidgetDefFactory.create(props);

    expect(widgetDef).to.be.instanceof(NavigationWidgetDef);
  });

  it("basic support", () => {
    const props: AnyWidgetProps = {
      classId: "BasicWidget",
    };

    const widgetDef = WidgetDefFactory.create(props);

    expect(widgetDef).to.be.instanceof(WidgetDef);
  });

});
