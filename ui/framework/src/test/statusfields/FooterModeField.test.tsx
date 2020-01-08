/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import {
  StatusBar,
  StatusBarWidgetControl,
  WidgetState,
  ConfigurableCreateInfo,
  ConfigurableUiControlType,
  WidgetDef,
  StatusBarWidgetControlArgs,
  FooterModeField,
} from "../../ui-framework";
import { FooterSeparator } from "@bentley/ui-ninezone";

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
    wrapper.unmount();
  });

  it("should mount with isInFooterMode=false", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={false} />);
    expect(wrapper.find(FooterSeparator).length).to.eq(0);
    wrapper.unmount();
  });

  it("should change with Props change", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);
    expect(wrapper.find(FooterSeparator).length).to.eq(1);
    wrapper.setProps({ isInFooterMode: false });
    wrapper.update();
    expect(wrapper.find(FooterSeparator).length).to.eq(0);
    wrapper.unmount();
  });

});
