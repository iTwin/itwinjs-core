/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";

import TestUtils from "../../TestUtils";
import {
  ActivityCenterField,
  StatusBarWidgetControl,
  IStatusBar,
  StatusBarFieldId,
  WidgetState,
  ConfigurableUiControlType,
  WidgetDef,
  ConfigurableCreateInfo,
  StatusBar,
  MessageManager,
} from "../../..";

describe("ActivityCenter", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode(statusBar: IStatusBar, isInFooterMode: boolean, openWidget: StatusBarFieldId): React.ReactNode {
      return (
        <>
          <ActivityCenterField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
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

  it("Status Bar with ActivityCenterField should mount", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);
    wrapper.unmount();
  });

  it("MessageManager.onActivityMessageUpdatedEvent should be handled", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);
    const message = "Test";
    const percentage = 50;
    MessageManager.setupActivityMessageValues(message, percentage);
    const field = wrapper.find(ActivityCenterField).at(0);
    expect(field.state("title")).to.eq(message);
    expect(field.state("percentage")).to.eq(percentage);
    expect(field.state("isActivityMessageVisible")).to.be.true;
    wrapper.unmount();
  });

  it("MessageManager.onActivityMessageCancelledEvent should be handled", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    MessageManager.setupActivityMessageValues("Test", 50);
    const field = wrapper.find(ActivityCenterField).at(0);
    expect(field.state("isActivityMessageVisible")).to.be.true;

    MessageManager.endActivityMessage(false);
    expect(field.state("isActivityMessageVisible")).to.be.false;

    wrapper.unmount();
  });

  it("click should be handled", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    MessageManager.setupActivityMessageValues("Test", 50);
    wrapper.update();

    const field = wrapper.find(ActivityCenterField).at(0);
    expect(field.state("isActivityMessageVisible")).to.be.true;

    const clickable = wrapper.find("div.open-activity-message");
    clickable.simulate("click");
    expect(field.state("isActivityMessageVisible")).to.be.true;

    wrapper.unmount();
  });

});
