/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Provider } from "react-redux";
import { MockRender } from "@bentley/imodeljs-frontend";
import { WidgetState } from "@bentley/ui-abstract";
import { ConfigurableCreateInfo, ConfigurableUiControlType } from "../../ui-framework/configurableui/ConfigurableUiControl";
import { StatusBar } from "../../ui-framework/statusbar/StatusBar";
import { StatusBarWidgetControl, StatusBarWidgetControlArgs } from "../../ui-framework/statusbar/StatusBarWidgetControl";
import { SectionsStatusField } from "../../ui-framework/statusfields/SectionsField";
import { WidgetDef } from "../../ui-framework/widgets/WidgetDef";
import TestUtils, { mount } from "../TestUtils";

describe("SectionsField", () => {
  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode({ isInFooterMode, onOpenWidget, openWidget }: StatusBarWidgetControlArgs): React.ReactNode {
      return (
        <>
          <SectionsStatusField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
        </>
      );
    }
  }

  let widgetControl: StatusBarWidgetControl | undefined;

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();

    const statusBarWidgetDef = new WidgetDef({
      classId: AppStatusBarWidgetControl,
      defaultState: WidgetState.Open,
      isFreeform: false,
      isStatusBar: true,
    });
    widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("should render", () => {
    mount(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);
  });

  it("should open/close on click", () => {
    const wrapper = mount(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);

    // Simulate a click to open the pop-up dialog
    wrapper.find("div.uifw-indicator-icon").simulate("click"); // Opens it
    wrapper.update();

    expect(wrapper.find("div.uifw-sections-footer-contents").length).to.eq(1);

    wrapper.find("div.uifw-indicator-icon").simulate("click"); // Closes it
    wrapper.update();
  });

});
