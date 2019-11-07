/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import {
  StatusBarWidgetControl,
  ConfigurableCreateInfo,
  WidgetState,
  StatusBar,
  WidgetDef,
  ConfigurableUiControlType,
  StatusBarComposer,
  StatusBarItem,
  StatusBarItemUtilities,
  UiFramework,
  MessageCenterField,
  withStatusFieldProps,
  withMessageCenterFieldProps,
  ActivityCenterField,
} from "../../ui-framework";
import { StatusBarSection } from "../../ui-framework/statusbar/StatusBarItem";

describe("StatusBarComposer", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode(): React.ReactNode {
      return (
        <StatusBarComposer />
      );
    }
  }

  class AppStatusBarComponent extends React.PureComponent {
    public render() {
      return <div />;
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

  beforeEach(() => {
    UiFramework.statusBarManager.itemsManager.removeAll();
  });

  it("StatusBarComposer should be instantiated", () => {
    expect(widgetControl).to.not.be.undefined;
    if (widgetControl)
      expect(widgetControl.getType()).to.eq(ConfigurableUiControlType.StatusBarWidget);

    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const statusBarComposer = wrapper.find(StatusBarComposer);
    expect(statusBarComposer.length).to.eq(1);
    expect(wrapper.find("div.uifw-statusbar-space-between").length).to.eq(1);

    wrapper.unmount();
  });

  it("StatusBarComposer should render items", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("test2", StatusBarSection.Center, 1, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("test3", StatusBarSection.Right, 1, <AppStatusBarComponent />),
    ];

    UiFramework.statusBarManager.itemsManager.add(items);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(3);

    wrapper.update();
    expect(wrapper.find("div.uifw-statusbar-left").length).to.eq(1);
    expect(wrapper.find("div.uifw-statusbar-center").length).to.eq(1);
    expect(wrapper.find("div.uifw-statusbar-right").length).to.eq(1);

    wrapper.unmount();
  });

  it("StatusBarComposer should sort items", () => {
    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 10, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("test2", StatusBarSection.Left, 5, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("test3", StatusBarSection.Left, 1, <AppStatusBarComponent />),
    ];

    UiFramework.statusBarManager.itemsManager.add(items);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(3);

    wrapper.update();
    const leftItems = wrapper.find("div.uifw-statusbar-left");

    expect(leftItems.length).to.eq(1);
    expect(wrapper.find("div.uifw-statusbar-center").length).to.eq(0);
    expect(wrapper.find("div.uifw-statusbar-right").length).to.eq(0);

    expect(leftItems.find(AppStatusBarComponent).length).to.eq(3);

    wrapper.unmount();
  });

  it("StatusBarComposer should support withStatusBarField components ", () => {
    // tslint:disable-next-line: variable-name
    const ActivityCenter = withStatusFieldProps(ActivityCenterField);

    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 10, <ActivityCenter />),
    ];

    UiFramework.statusBarManager.itemsManager.add(items);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(1);

    wrapper.update();
    const leftItems = wrapper.find("div.uifw-statusbar-left");

    expect(leftItems.length).to.eq(1);

    expect(leftItems.find(ActivityCenterField).length).to.eq(1);

    wrapper.unmount();
  });

  it("StatusBarComposer should support withMessageCenter components ", () => {
    // tslint:disable-next-line: variable-name
    const MessageCenter = withMessageCenterFieldProps(MessageCenterField);

    const wrapper = mount(<StatusBar widgetControl={widgetControl} isInFooterMode={true} />);

    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 10, <MessageCenter />),
    ];

    UiFramework.statusBarManager.itemsManager.add(items);
    expect(UiFramework.statusBarManager.itemsManager.items.length).to.eq(1);

    wrapper.update();
    const leftItems = wrapper.find("div.uifw-statusbar-left");

    expect(leftItems.length).to.eq(1);

    expect(leftItems.find(MessageCenterField).length).to.eq(1);

    wrapper.unmount();
  });

});
