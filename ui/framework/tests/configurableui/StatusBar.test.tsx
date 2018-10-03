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
  ConfigurableUiManager,
  IStatusBar,
  StatusBarFieldId,
  ZoneDef,
  WidgetState,
  StatusBar,
  ZoneState,
  AppNotificationManager,
} from "../../src/index";

import {
  NotifyMessageDetails,
  OutputMessagePriority,
  OutputMessageType,
  ActivityMessageDetails,
  ActivityMessageEndReason,
} from "@bentley/imodeljs-frontend";

import Hyperlink from "@bentley/ui-ninezone/lib/footer/message/content/Hyperlink";
import MessageButton from "@bentley/ui-ninezone/lib/footer/message/content/Button";

describe("StatusBar", () => {

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
  let notifications: AppNotificationManager;

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

    notifications = new AppNotificationManager();
  });

  it("StatusBar should mount", () => {
    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);
    wrapper.unmount();
  });

  it("StatusBar should render a Toast message", () => {
    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Warning, "A brief message.");
    notifications.outputMessage(details);

    wrapper.unmount();
  });

  it("StatusBar should render a Sticky message", () => {
    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "A brief message.", undefined, OutputMessageType.Sticky);
    notifications.outputMessage(details);

    wrapper.unmount();
  });

  it("Sticky message should closed", () => {
    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Error, "A brief message.", undefined, OutputMessageType.Sticky);
    notifications.outputMessage(details);

    wrapper.update();
    wrapper.find(MessageButton).simulate("click");

    wrapper.unmount();
  });

  it("StatusBar should render a Modal message", () => {
    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Fatal, "A brief message.", undefined, OutputMessageType.Alert);
    notifications.outputMessage(details);

    wrapper.unmount();
  });

  it("StatusBar should render an Activity message", () => {
    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);

    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    notifications.outputActivityMessage("Message text", 50);
    notifications.endActivityMessage(ActivityMessageEndReason.Completed);

    wrapper.unmount();
  });

  it("Activity message should be canceled", () => {
    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);

    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    notifications.outputActivityMessage("Message text", 50);

    wrapper.update();
    wrapper.find(Hyperlink).simulate("click");

    wrapper.unmount();
  });

  it("Activity message should be dismissed", () => {
    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);

    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    notifications.outputActivityMessage("Message text", 50);

    wrapper.update();
    wrapper.find(MessageButton).simulate("click");

    wrapper.unmount();
  });

});
