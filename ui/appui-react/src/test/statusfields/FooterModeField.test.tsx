/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { WidgetState } from "@itwin/appui-abstract";
import { FooterSeparator } from "@itwin/appui-layout-react";
import {
  ConfigurableCreateInfo, ConfigurableUiControlType, FooterModeField, StatusBar, StatusBarWidgetControl, StatusBarWidgetControlArgs, WidgetDef,
} from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("FooterModeField", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode({ isInFooterMode, onOpenWidget, openWidget }: StatusBarWidgetControlArgs): React.ReactNode {
      if (openWidget) { }
      return (
        <>
          <FooterModeField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget}> <FooterSeparator /> </FooterModeField>
        </>
      );
    }
  }

  let widgetControl: StatusBarWidgetControl | undefined;

  before(async () => {
    await TestUtils.initializeUiFramework();

    const statusBarWidgetDef = new WidgetDef({
      classId: AppStatusBarWidgetControl,
      defaultState: WidgetState.Open,
      isFreeform: false,
      isStatusBar: true,
    });
    widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should mount with isInFooterMode", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);
    expect(wrapper.find(FooterSeparator).length).to.eq(1);
  });

  it("should mount with isInFooterMode=false", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={false} />);
    expect(wrapper.find(FooterSeparator).length).to.eq(0);
  });

  it("should change with Props change", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);
    expect(wrapper.find(FooterSeparator).length).to.eq(1);
    wrapper.setProps({ isInFooterMode: false });
    wrapper.update();
    expect(wrapper.find(FooterSeparator).length).to.eq(0);
  });

});
