/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { WidgetState } from "@itwin/appui-abstract";
import type {
  ConfigurableCreateInfo, StatusBarWidgetControlArgs} from "../../appui-react";
import { ConfigurableUiControlType, MessageCenterField, StatusBar, StatusBarWidgetControl, WidgetDef,
} from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("StatusBarWidgetControl", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode({ isInFooterMode, onOpenWidget, openWidget }: StatusBarWidgetControlArgs): React.ReactNode {
      return (
        <>
          <MessageCenterField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
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

  it("StatusBarWidgetControl should be instantiated", () => {
    expect(widgetControl).to.not.be.undefined;
    if (widgetControl)
      expect(widgetControl.getType()).to.eq(ConfigurableUiControlType.StatusBarWidget);

    mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);
  });

});
