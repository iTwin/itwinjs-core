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
  StatusBar,
  WidgetDef,
  ConfigurableUiControlType,
  StatusBarComposer,
  StatusBarItem,
  StatusBarItemUtilities,
  MessageCenterField,
  withStatusFieldProps,
  withMessageCenterFieldProps,
  ActivityCenterField,
  SyncUiEventDispatcher,
  WidgetState,
} from "../../ui-framework";
import { StatusBarSection, UiItemsProvider, CommonStatusBarItem, StageUsage, AbstractStatusBarItemUtilities, UiItemsManager, StatusBarLabelSide, ConditionalBooleanValue } from "@bentley/ui-abstract";

describe("StatusBarComposer", () => {
  class TestUiProvider implements UiItemsProvider {
    public readonly id = "TestUiProvider";

    public static statusBarItemIsVisible = true;
    public static uiSyncEventId = "appuiprovider:statusbar-item-visibility-changed";

    public static triggerSyncRefresh = () => {
      TestUiProvider.statusBarItemIsVisible = false;
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(TestUiProvider.uiSyncEventId);
    }

    public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {

      const statusBarItems: CommonStatusBarItem[] = [];
      const hiddenCondition = new ConditionalBooleanValue(() => !TestUiProvider.statusBarItemIsVisible, [TestUiProvider.uiSyncEventId]);

      if (stageUsage === StageUsage.General) {
        statusBarItems.push(
          AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "test status bar from plugin", () => { }));
        statusBarItems.push(
          AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 105, "icon-hand-2-condition", "Hello", undefined, { isHidden: hiddenCondition }));
        statusBarItems.push(
          AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel2", StatusBarSection.Center, 120, "icon-hand-2", "Hello2", StatusBarLabelSide.Left));
        statusBarItems.push(
          AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem2", StatusBarSection.Center, 110, "icon-visibility-hide-2", "toggle items", () => { }));
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
        <StatusBarComposer items={[]} />
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

    expect(items.length).to.eq(3);

    const wrapper = mount(<StatusBarComposer items={items} />);

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

    expect(items.length).to.eq(1);

    const wrapper = mount(<StatusBarComposer items={items} />);

    const leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.length).to.eq(1);
    expect(leftItems.find(AppStatusBarComponent).length).to.eq(1);

    const items2: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("item2", StatusBarSection.Center, 1, <AppStatusBarComponent />),
    ];

    expect(items2.length).to.eq(1);

    wrapper.setProps({ items: items2 });
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

    expect(items.length).to.eq(3);

    const wrapper = mount(<StatusBarComposer items={items} />);

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

    expect(items.length).to.eq(1);
    const wrapper = mount(<StatusBarComposer items={items} />);

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

    expect(items.length).to.eq(1);

    const wrapper = mount(<StatusBarComposer items={items} />);

    const leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.length).to.eq(1);
    expect(leftItems.find(MessageCenterField).length).to.eq(1);

    wrapper.unmount();
  });

  it("StatusBarComposer should support item.isVisible", () => {
    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 10, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("test2", StatusBarSection.Left, 5, <AppStatusBarComponent />, { isHidden: true }),
    ];

    expect(items.length).to.eq(2);

    const wrapper = mount(<StatusBarComposer items={items} />);

    let leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.find(AppStatusBarComponent).length).to.eq(1);

    // defaultItemsManager.setIsVisible("test2", true);
    // wrapper.update();
    leftItems = wrapper.find("div.uifw-statusbar-left");
    // expect(leftItems.find(AppStatusBarComponent).length).to.eq(2);

    wrapper.unmount();
  });

  it("StatusBarComposer should support plugin items", async () => {
    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 10, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("test2", StatusBarSection.Left, 5, <AppStatusBarComponent />, { isHidden: true }),
    ];

    const uiProvider = new TestUiProvider();
    expect(items.length).to.eq(2);

    const wrapper = mount(<StatusBarComposer items={items} />);

    let addonItem = wrapper.find("div.icon-visibility-hide-2");
    expect(addonItem.exists()).to.be.false;

    UiItemsManager.register(uiProvider);

    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.find(AppStatusBarComponent).length).to.eq(1);

    // tslint:disable-next-line: no-console
    // console.log(wrapper.debug());

    const addonItem1 = wrapper.find("div.icon-visibility-hide-2");
    expect(addonItem1.exists()).to.be.true;
    const addonItem2 = wrapper.find("i.icon-hand-2");
    expect(addonItem2.exists()).to.be.true;

    UiItemsManager.unregister(uiProvider.id);
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    addonItem = wrapper.find("div.icon-visibility-hide-2");
    expect(addonItem.exists()).to.be.false;

    wrapper.unmount();
  });

  it("StatusBarComposer should support addon items loaded before component", async () => {
    const items: StatusBarItem[] = [
      StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 10, <AppStatusBarComponent />),
      StatusBarItemUtilities.createStatusBarItem("test2", StatusBarSection.Left, 5, <AppStatusBarComponent />, { isHidden: true }),
    ];

    const uiProvider = new TestUiProvider();

    UiItemsManager.register(uiProvider);
    const wrapper = mount(<StatusBarComposer items={items} />);

    const leftItems = wrapper.find("div.uifw-statusbar-left");
    expect(leftItems.find(AppStatusBarComponent).length).to.eq(1);

    // tslint:disable-next-line: no-console
    // console.log(wrapper.debug());

    let addonItem1 = wrapper.find("div.icon-visibility-hide-2");
    expect(addonItem1.exists()).to.be.true;
    let addonItem2 = wrapper.find("i.icon-hand-2");
    expect(addonItem2.exists()).to.be.true;
    let addonItem3 = wrapper.find("i.icon-hand-2-condition");
    expect(addonItem3.exists()).to.be.true;

    TestUiProvider.triggerSyncRefresh();

    await TestUtils.flushAsyncOperations();
    wrapper.update();

    addonItem1 = wrapper.find("div.icon-visibility-hide-2");
    expect(addonItem1.exists()).to.be.true;
    addonItem2 = wrapper.find("i.icon-hand-2");
    expect(addonItem2.exists()).to.be.true;
    addonItem3 = wrapper.find("i.icon-hand-2-condition");
    expect(addonItem3.exists()).to.be.false;

    UiItemsManager.unregister(uiProvider.id);
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    addonItem1 = wrapper.find("div.icon-visibility-hide-2");
    expect(addonItem1.exists()).to.be.false;

    wrapper.unmount();
  });

});
