/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";

import TestUtils from "../TestUtils";
import {
  StatusBarWidgetControl,
  ConfigurableCreateInfo,
  MessageCenterField,
  ConfigurableUiManager,
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

    ConfigurableUiManager.unregisterControl("AppStatusBar");
    ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);

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
