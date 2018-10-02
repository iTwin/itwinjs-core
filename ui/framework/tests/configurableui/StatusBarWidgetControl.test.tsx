/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";

import TestUtils from "../TestUtils";
import {
  StatusBarWidgetControl,
  ConfigurableCreateInfo,
  MessageCenterField,
  ConfigurableUIManager,
  IStatusBar,
  StatusBarFieldId,
  ZoneDef,
  WidgetState,
  StatusBar,
  ZoneState,
} from "../../src/index";

describe("StatusBarWidgetControl", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode(statusBar: IStatusBar, isInFooterMode: boolean, openWidget: StatusBarFieldId): React.ReactNode {
      return (
        <>
          <MessageCenterField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
        </>
      );
    }
  }

  let statusBarZoneDef: ZoneDef;

  before(async () => {
    await TestUtils.initializeUiFramework();

    ConfigurableUIManager.unregisterControl("AppStatusBar");
    ConfigurableUIManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);

    statusBarZoneDef = new ZoneDef({
      defaultState: ZoneState.Open,
      allowsMerging: false,
      widgetProps: [
        {
          classId: "AppStatusBar",
          defaultState: WidgetState.Open,
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:Test.my-label",
          isFreeform: false,
          isStatusBar: true,
        },
      ],
    });

  });

  it("StatusBarWidgetControl should be instantiated", () => {
    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);
    wrapper.unmount();
  });

});
