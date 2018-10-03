/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { FrontstageProps, ZoneState, WidgetState, ConfigurableUiManager, WidgetControl, ConfigurableCreateInfo, FrontstageManager, FrontstageComposer, ContentGroup, ContentLayoutDef } from "../../src";

describe("StackedWidget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  class TestWidget extends WidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = (
        <div>
          <span>This is the Test Widget</span>
        </div>
      );
    }
  }

  it("Producing a StackedWidget", () => {

    const myContentGroup: ContentGroup = new ContentGroup({
      contents: [{ classId: "TestContentControl2" }],
    });

    const myContentLayout: ContentLayoutDef = new ContentLayoutDef({
      id: "SingleContent",
      descriptionKey: "UiFramework:tests.singleContent",
      priority: 100,
    });

    const frontstageProps: FrontstageProps = {
      id: "StackedWidget-Frontstage",
      defaultToolId: "PlaceLine",
      defaultLayout: myContentLayout,
      contentGroup: myContentGroup,

      centerRight: {
        defaultState: ZoneState.Minimized,
        allowsMerging: true,
        widgetProps: [
          {
            classId: "StackedWidgetTestWidget",
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
          {
            classId: "StackedWidgetTestWidget",
            defaultState: WidgetState.Open,
            iconClass: "icon-placeholder",
            labelKey: "SampleApp:Test.my-label",
          },
        ],
      },
    };

    ConfigurableUiManager.registerControl("StackedWidgetTestWidget", TestWidget);
    ConfigurableUiManager.loadFrontstage(frontstageProps);

    FrontstageManager.setActiveFrontstageDef(undefined);

    const wrapper = mount(<FrontstageComposer />);

    const frontstageDef = ConfigurableUiManager.findFrontstageDef("StackedWidget-Frontstage");
    expect(frontstageDef).to.not.be.undefined;
    FrontstageManager.setActiveFrontstageDef(frontstageDef);
    wrapper.update();

    const stackedWidget = wrapper.find("div.nz-widget-stacked");
    expect(stackedWidget.length).to.eq(1);

    const tabs = wrapper.find("div.nz-widget-rectangular-tab-tab");
    expect(tabs.length).to.eq(2);

    // NEEDSWORK - not working
    tabs.at(0).simulate("click");
    wrapper.update();

    // tslint:disable-next-line:no-console
    // console.log(wrapper.debug());

    // NEEDSWORK - not working
    tabs.at(1).simulate("click");
    wrapper.update();

    // tslint:disable-next-line:no-console
    // console.log(wrapper.debug());

    wrapper.unmount();
  });

});
