/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import {
  StatusBarWidgetControl,
  ConfigurableCreateInfo,
  MessageCenterField,
  WidgetState,
  StatusBar,
  AppNotificationManager,
  WidgetDef,
  ConfigurableUiControlType,
  StatusBarWidgetControlArgs,
  StatusBarSpaceBetween,
  StatusBarLeftSection,
  StatusBarCenterSection,
  StatusBarRightSection,
} from "../../ui-framework";

import {
  NotifyMessageDetails,
  OutputMessagePriority,
  OutputMessageType,
  ActivityMessageDetails,
  ActivityMessageEndReason,
} from "@bentley/imodeljs-frontend";

import {
  MessageHyperlink,
  MessageButton,
  Message,
  MessageLayout,
  Toast,
  MessageProgress,
} from "@bentley/ui-ninezone";

describe("StatusBar", () => {

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
  let notifications: AppNotificationManager;

  before(async () => {
    await TestUtils.initializeUiFramework();

    const statusBarWidgetDef = new WidgetDef({
      classId: AppStatusBarWidgetControl,
      defaultState: WidgetState.Open,
      isFreeform: false,
      isStatusBar: true,
    });
    widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;

    notifications = new AppNotificationManager();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("StatusBar should mount", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);
    wrapper.unmount();
  });

  it("StatusBar should render a Toast message", async () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.None, "A brief message.", "A detailed message.");
    notifications.outputMessage(details);
    wrapper.update();

    expect(wrapper.find(Toast).length).to.eq(1);
    expect(wrapper.find(Message).length).to.eq(1);
    expect(wrapper.find(MessageLayout).length).to.eq(1);

    wrapper.unmount();
  });

  it("StatusBar should render a Toast message and animate out", async () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Warning, "A brief message.", "A detailed message.");
    notifications.outputMessage(details);
    wrapper.update();

    expect(wrapper.find(Toast).length).to.eq(1);

    const toast = wrapper.find(".nz-toast");
    expect(toast.length).to.eq(1);
    toast.simulate("transitionEnd");
    wrapper.update();

    expect(wrapper.find(".nz-toast").length).to.eq(0);

    wrapper.unmount();
  });

  it("StatusBar should render a Sticky message", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "A brief message.", "A detailed message.", OutputMessageType.Sticky);
    notifications.outputMessage(details);
    wrapper.update();

    expect(wrapper.find(Message).length).to.eq(1);
    expect(wrapper.find(MessageLayout).length).to.eq(1);
    expect(wrapper.find(MessageButton).length).to.eq(1);

    wrapper.unmount();
  });

  it("Sticky message should close on button click", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Error, "A brief message.", "A detailed message.", OutputMessageType.Sticky);
    notifications.outputMessage(details);
    wrapper.update();

    expect(wrapper.find(MessageButton).length).to.eq(1);

    wrapper.find(MessageButton).simulate("click");
    wrapper.update();
    expect(wrapper.find(Message).length).to.eq(0);

    wrapper.unmount();
  });

  it("StatusBar should render an Activity message", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const details = new ActivityMessageDetails(true, true, false);
    notifications.setupActivityMessage(details);
    notifications.outputActivityMessage("Message text", 50);
    wrapper.update();

    expect(wrapper.find(Message).length).to.eq(1);
    expect(wrapper.find(MessageProgress).length).to.eq(1);

    notifications.endActivityMessage(ActivityMessageEndReason.Completed);
    wrapper.update();
    expect(wrapper.find(Message).length).to.eq(0);

    wrapper.unmount();
  });

  it("Activity message should be canceled", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    notifications.outputActivityMessage("Message text", 50);
    wrapper.update();
    expect(wrapper.find(Message).length).to.eq(1);

    wrapper.find(MessageHyperlink).simulate("click");
    wrapper.update();
    expect(wrapper.find(Message).length).to.eq(0);

    wrapper.unmount();
  });

  it("Activity message should be dismissed", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    notifications.outputActivityMessage("Message text", 50);
    wrapper.update();
    expect(wrapper.find(Message).length).to.eq(1);

    wrapper.find(MessageButton).simulate("click");
    wrapper.update();
    expect(wrapper.find(Message).length).to.eq(0);

    wrapper.unmount();
  });

  it("StatusBarSpaceBetween should render correctly", () => {
    const wrapper = mount(<StatusBarSpaceBetween>Hello</StatusBarSpaceBetween>);
    expect(wrapper.find("div.uifw-statusbar-space-between").length).to.eq(1);
    wrapper.unmount();
  });

  it("StatusBarLeftSection should render correctly", () => {
    const wrapper = mount(<StatusBarLeftSection>Hello</StatusBarLeftSection>);
    expect(wrapper.find("div.uifw-statusbar-left").length).to.eq(1);
    wrapper.unmount();
  });

  it("StatusBarCenterSection should render correctly", () => {
    const wrapper = mount(<StatusBarCenterSection>Hello</StatusBarCenterSection>);
    expect(wrapper.find("div.uifw-statusbar-center").length).to.eq(1);
    wrapper.unmount();
  });

  it("StatusBarRightSection should render correctly", () => {
    const wrapper = mount(<StatusBarRightSection>Hello</StatusBarRightSection>);
    expect(wrapper.find("div.uifw-statusbar-right").length).to.eq(1);
    wrapper.unmount();
  });

});
