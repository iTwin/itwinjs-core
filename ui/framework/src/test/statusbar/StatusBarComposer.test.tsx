/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import { IModelApp, NoRenderApp } from "@bentley/imodeljs-frontend";

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
import { StatusBarItemsManager } from "../../ui-framework/statusbar/StatusBarItemsManager";
import { StatusBarSection, PluginUiProvider, ToolbarItemInsertSpec, CommonStatusBarItem, StageUsage, AbstractStatusBarItemUtilities, PluginUiManager, StatusbarLabelSide } from "@bentley/ui-abstract";
import { FooterIndicator } from "@bentley/ui-ninezone";

describe("StatusBarComposer", () => {
  class TestUiProvider implements PluginUiProvider {
    public readonly id = "TestUiProvider";
    public provideToolbarItems(_toolBarId: string): ToolbarItemInsertSpec[] {
      return [];
    }

    public static statusBarItemIsVisible = true;

    public provideStatusbarItems(_stageId: string, stageUsage: StageUsage): CommonStatusBarItem[] {
      const statusBarItems: CommonStatusBarItem[] = [];

      if (stageUsage === StageUsage.General) {
        statusBarItems.push(
          AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "test status bar from plugin",
            () => {
              // tslint:disable-next-line: no-console
              console.log("Got Here!");
            }));

        statusBarItems.push(
          AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello"));

        const label2 = AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel2", StatusBarSection.Center, 120, "icon-hand-2", "Hello2", StatusbarLabelSide.Left);
        statusBarItems.push(label2);

        statusBarItems.push(
          AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem2", StatusBarSection.Center, 110, "icon-visibility-hide-2", "toggle items",
            () => {
              TestUiProvider.statusBarItemIsVisible = !TestUiProvider.statusBarItemIsVisible;
              UiFramework.pluginStatusBarItemsManager.setIsVisible("PluginTest:StatusBarItem1", TestUiProvider.statusBarItemIsVisible);
              UiFramework.pluginStatusBarItemsManager.setLabel("PluginTest:StatusBarLabel1", TestUiProvider.statusBarItemIsVisible ? "Hello" : "Goodbye");
            }));
      }
      return statusBarItems;
    }
  }

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode(): React.ReactNode {
      return (
        <StatusBarComposer itemsManager={UiFramework.statusBarManager.getItemsManager("test")!} />
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
    NoRenderApp.startup();

    UiFramework.statusBarManager.addItemsManager("test", new StatusBarItemsManager());
    UiFramework.statusBarManager.addItemsManager("test2", new StatusBarItemsManager());

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
    IModelApp.shutdown();
  });

  beforeEach(() => {
    UiFramework.statusBarManager.getItemsManager("test")!.removeAll();
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
    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("item1", StatusBarSection.Left, 1, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("item2", StatusBarSection.Center, 1, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("item3", StatusBarSection.Right, 1, <AppStatusBarComponent />),
    ];

    const itemsManager = new StatusBarItemsManager();
    itemsManager.add(items);
    expect(itemsManager.items.length).to.eq(3);

    const wrapper = mount(<StatusBarComposer itemsManager={itemsManager} />);

    const leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.length).to.eq(1);
    expect(leftItems.find(AppStatusBarComponent).length).to.eq(1);

    const centerItems = wrapper.find("div.uifw-statusbar-center");
    expect(centerItems.length).to.eq(1);
    expect(centerItems.find(AppStatusBarComponent).length).to.eq(1);

    const rightItems = wrapper.find("div.uifw-statusbar-right");
    expect(rightItems.length).to.eq(1);
    expect(rightItems.find(AppStatusBarComponent).length).to.eq(1);

    wrapper.unmount();
  });

  it("StatusBarComposer should support changing props", () => {
    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("item1", StatusBarSection.Left, 1, <AppStatusBarComponent />),
    ];

    const itemsManager = new StatusBarItemsManager();
    itemsManager.add(items);
    expect(itemsManager.items.length).to.eq(1);

    const wrapper = mount(<StatusBarComposer itemsManager={itemsManager} />);

    const leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.length).to.eq(1);
    expect(leftItems.find(AppStatusBarComponent).length).to.eq(1);

    const items2: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("item2", StatusBarSection.Center, 1, <AppStatusBarComponent />),
    ];

    const itemsManager2 = new StatusBarItemsManager();
    itemsManager2.add(items2);
    expect(itemsManager2.items.length).to.eq(1);

    wrapper.setProps({ itemsManager: itemsManager2 });
    wrapper.update();

    const centerItems = wrapper.find("div.uifw-statusbar-center");
    expect(centerItems.length).to.eq(1);
    expect(centerItems.find(AppStatusBarComponent).length).to.eq(1);

    wrapper.unmount();
  });

  it("StatusBarComposer should sort items", () => {
    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("item1", StatusBarSection.Left, 10, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("item2", StatusBarSection.Left, 5, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("item3", StatusBarSection.Left, 1, <AppStatusBarComponent />),
    ];

    const itemsManager = new StatusBarItemsManager();
    itemsManager.add(items);
    expect(itemsManager.items.length).to.eq(3);

    const wrapper = mount(<StatusBarComposer itemsManager={itemsManager} />);

    const leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.length).to.eq(1);
    expect(leftItems.find(AppStatusBarComponent).length).to.eq(3);

    wrapper.unmount();
  });

  it("StatusBarComposer should support withStatusBarField components ", () => {
    // tslint:disable-next-line: variable-name
    const ActivityCenter = withStatusFieldProps(ActivityCenterField);

    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("item1", StatusBarSection.Left, 10, <ActivityCenter />),
    ];

    const itemsManager = new StatusBarItemsManager();
    itemsManager.add(items);
    expect(itemsManager.items.length).to.eq(1);

    const wrapper = mount(<StatusBarComposer itemsManager={itemsManager} />);

    const leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.length).to.eq(1);
    expect(leftItems.find(ActivityCenterField).length).to.eq(1);

    wrapper.unmount();
  });

  it("StatusBarComposer should support withMessageCenter components ", () => {
    // tslint:disable-next-line: variable-name
    const MessageCenter = withMessageCenterFieldProps(MessageCenterField);

    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("item1", StatusBarSection.Left, 10, <MessageCenter />),
    ];

    const itemsManager = new StatusBarItemsManager();
    itemsManager.add(items);
    expect(itemsManager.items.length).to.eq(1);

    const wrapper = mount(<StatusBarComposer itemsManager={itemsManager} />);

    const leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.length).to.eq(1);
    expect(leftItems.find(MessageCenterField).length).to.eq(1);

    wrapper.unmount();
  });

  it("StatusBarComposer should support item.isVisible", () => {
    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 10, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("test2", StatusBarSection.Left, 5, <AppStatusBarComponent />, { isVisible: false }),
    ];

    const itemsManager = new StatusBarItemsManager();
    itemsManager.add(items);
    expect(itemsManager.items.length).to.eq(2);

    const wrapper = mount(<StatusBarComposer itemsManager={itemsManager} />);

    let leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.find(AppStatusBarComponent).length).to.eq(1);

    itemsManager.setIsVisible("test2", true);
    wrapper.update();
    leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.find(AppStatusBarComponent).length).to.eq(2);

    wrapper.unmount();
  });

  it("StatusBarComposer should support plugin items", async () => {
    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 10, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("test2", StatusBarSection.Left, 5, <AppStatusBarComponent />, { isVisible: false }),
    ];

    const uiProvider = new TestUiProvider();
    PluginUiManager.register(uiProvider);

    const itemsManager = new StatusBarItemsManager();
    itemsManager.add(items);
    expect(itemsManager.items.length).to.eq(2);

    const wrapper = mount(<StatusBarComposer itemsManager={itemsManager} pluginItemsManager={UiFramework.pluginStatusBarItemsManager} />);

    let leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.find(AppStatusBarComponent).length).to.eq(1);

    itemsManager.setIsVisible("test2", true);
    wrapper.update();
    leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.find(AppStatusBarComponent).length).to.eq(2);

    let centerItems = wrapper.find("div.uifw-statusbar-center");
    expect(centerItems.find(FooterIndicator).length).to.eq(2);

    UiFramework.pluginStatusBarItemsManager.setIsVisible("PluginTest:StatusBarLabel1", false);
    wrapper.update();

    centerItems = wrapper.find("div.uifw-statusbar-center");
    expect(centerItems.find(FooterIndicator).length).to.eq(1);

    UiFramework.pluginStatusBarItemsManager.setIsVisible("PluginTest:StatusBarLabel1", true);
    wrapper.update();
    centerItems = wrapper.find("div.uifw-statusbar-center");
    expect(centerItems.find(FooterIndicator).length).to.eq(2);

    PluginUiManager.unregister(uiProvider.id);
    wrapper.update();

    await TestUtils.flushAsyncOperations();

    // tslint:disable-next-line: no-console
    // console.log(wrapper.debug());

    // centerItems = wrapper.find("div.uifw-statusbar-center");
    // expect(centerItems.find(FooterIndicator).length).to.eq(0);

    wrapper.unmount();
  });

});
