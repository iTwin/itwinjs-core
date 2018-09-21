/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";

import TestUtils from "../../TestUtils";
import {
  MessageCenterField,
  StatusBarWidgetControl,
  StatusBar,
  ZoneDef,
  ConfigurableUiManager,
  ZoneState,
  WidgetState,
  ConfigurableCreateInfo,
  IStatusBar,
  StatusBarFieldId,
  MessageManager,
} from "../../../src";
import { NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";

describe("MessageCenter", () => {

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

  it("Message Center should support all message types", () => {
    MessageManager.clearMessages();
    expect(MessageManager.messages.length).to.eq(0);

    const infoMessage = new NotifyMessageDetails(OutputMessagePriority.Info, "Message text.");
    MessageManager.addMessage(infoMessage);
    const warningMessage = new NotifyMessageDetails(OutputMessagePriority.Warning, "Message text.");
    MessageManager.addMessage(warningMessage);
    const errorMessage = new NotifyMessageDetails(OutputMessagePriority.Error, "Message text.");
    MessageManager.addMessage(errorMessage);
    const fatalMessage = new NotifyMessageDetails(OutputMessagePriority.Fatal, "Message text.");
    MessageManager.addMessage(fatalMessage);
    expect(MessageManager.messages.length).to.eq(4);

    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);

    wrapper.find("div.nz-balloon").simulate("click"); // Opens it
    wrapper.update();

    expect(wrapper.find("i.icon-info").length).to.eq(1);
    expect(wrapper.find("i.icon-status-warning").length).to.eq(1);
    expect(wrapper.find("i.icon-status-error").length).to.eq(1);
    expect(wrapper.find("i.icon-status-rejected").length).to.eq(1);

    wrapper.find("div.nz-balloon").simulate("click"); // Closes it
    wrapper.update();

    wrapper.unmount();
  });

  it("Message Center should close", () => {
    MessageManager.clearMessages();
    expect(MessageManager.messages.length).to.eq(0);

    const infoMessage = new NotifyMessageDetails(OutputMessagePriority.Info, "Message text.");
    MessageManager.addMessage(infoMessage);
    expect(MessageManager.messages.length).to.eq(1);

    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);

    wrapper.find("div.nz-balloon").simulate("click");
    wrapper.update();

    const buttons = wrapper.find("div.nz-footer-message-content-dialog-button");
    expect(buttons.length).to.eq(2);

    buttons.at(1).simulate("click");
    wrapper.update();

    wrapper.unmount();
  });

  it("Message Center should change tabs", () => {
    MessageManager.clearMessages();
    expect(MessageManager.messages.length).to.eq(0);

    const infoMessage = new NotifyMessageDetails(OutputMessagePriority.Info, "Message text.");
    MessageManager.addMessage(infoMessage);
    const errorMessage = new NotifyMessageDetails(OutputMessagePriority.Error, "Message text.");
    MessageManager.addMessage(errorMessage);
    expect(MessageManager.messages.length).to.eq(2);

    const wrapper = mount(<StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />);

    wrapper.find("div.nz-balloon").simulate("click");
    wrapper.update();

    const tabs = wrapper.find("div.nz-footer-messageCenter-tab");
    expect(tabs.length).to.eq(2);

    tabs.at(1).simulate("click"); // Change tab
    wrapper.update();

    tabs.at(0).simulate("click"); // Change tab back
    wrapper.update();

    wrapper.unmount();
  });

  // nz-footer-messageCenter-tab

});
