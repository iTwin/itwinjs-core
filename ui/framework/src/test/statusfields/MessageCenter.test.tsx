/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { WidgetState } from "@itwin/appui-abstract";
import { FooterPopup } from "@itwin/appui-layout-react";
import {
  ConfigurableCreateInfo, ConfigurableUiControlType, ConfigurableUiManager, MessageCenterField, MessageManager, StatusBar, StatusBarWidgetControl,
  StatusBarWidgetControlArgs, WidgetDef,
} from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("MessageCenter", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode({ isInFooterMode, onOpenWidget, openWidget, toastTargetRef }: StatusBarWidgetControlArgs): React.ReactNode {
      return (
        <>
          <MessageCenterField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} targetRef={toastTargetRef} />
        </>
      );
    }
  }

  let widgetControl: StatusBarWidgetControl | undefined;

  before(async () => {
    await TestUtils.initializeUiFramework();

    ConfigurableUiManager.unregisterControl("AppStatusBar");
    ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);

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

    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    wrapper.find("div.nz-balloon").simulate("click"); // Opens it
    wrapper.update();

    expect(wrapper.find("i.icon-info").length).to.eq(1);
    expect(wrapper.find("i.icon-status-warning").length).to.eq(1);
    expect(wrapper.find("i.icon-status-error").length).to.eq(1);
    expect(wrapper.find("i.icon-status-rejected").length).to.eq(1);

    wrapper.find("div.nz-balloon").simulate("click"); // Closes it
    wrapper.update();
  });

  it("Message Center should change tabs", () => {
    MessageManager.clearMessages();
    expect(MessageManager.messages.length).to.eq(0);

    const infoMessage = new NotifyMessageDetails(OutputMessagePriority.Info, "Brief text.", "Detail text");
    MessageManager.addMessage(infoMessage);
    const errorMessage = new NotifyMessageDetails(OutputMessagePriority.Error, "Message text.");
    MessageManager.addMessage(errorMessage);
    expect(MessageManager.messages.length).to.eq(2);

    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    wrapper.find("div.nz-balloon").simulate("click");
    wrapper.update();

    const tabs = wrapper.find("div.nz-footer-messageCenter-tab");
    expect(tabs.length).to.eq(2);

    tabs.at(1).simulate("click"); // Change tab
    wrapper.update();

    tabs.at(0).simulate("click"); // Change tab back
    wrapper.update();
  });

  it("Message Center should close on outside click", () => {
    const wrapper = mount<StatusBar>(<StatusBar widgetControl={widgetControl} isInFooterMode />);
    const footerPopup = wrapper.find(FooterPopup);

    const statusBarInstance = wrapper.instance();
    statusBarInstance.setState(() => ({ openWidget: "test-widget" }));

    const outsideClick = new MouseEvent("");
    sinon.stub(outsideClick, "target").get(() => document.createElement("div"));
    footerPopup.prop("onOutsideClick")!(outsideClick);

    expect(statusBarInstance.state.openWidget).null;
  });

  it("Message Center should not close on outside click", () => {
    const wrapper = mount<StatusBar>(<StatusBar widgetControl={widgetControl} isInFooterMode />);
    const footerPopup = wrapper.find(FooterPopup);

    const statusBarInstance = wrapper.instance();
    statusBarInstance.setState(() => ({ openWidget: "test-widget" }));

    const outsideClick = new MouseEvent("");
    footerPopup.prop("onOutsideClick")!(outsideClick);

    expect(statusBarInstance.state.openWidget).eq("test-widget");
  });

  it("Message Center should open on OpenMessageCenterEvent", () => {
    const wrapper = mount<StatusBar>(<StatusBar widgetControl={widgetControl} isInFooterMode />);

    const statusBarInstance = wrapper.instance();
    expect(statusBarInstance.state.openWidget).null;

    MessageManager.onOpenMessageCenterEvent.emit({});
    expect(statusBarInstance.state.openWidget).not.null;
  });

  // nz-footer-messageCenter-tab

});
